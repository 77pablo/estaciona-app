// ============================================================================
// Estaciona — Analítica de uso ANÓNIMA y agregada — ahora en SQLite (db.js).
// ----------------------------------------------------------------------------
// Solo CONTEOS por evento/día/ciudad. Sin IP, sin cookies. Migra automáticamente
// analytics.json si existe.
// ============================================================================

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ready, run, all, get } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const EVENTOS = new Set([
  'pageview', 'search', 'ciudad', 'detalle', 'comollegar',
  'reporte_lugar', 'reporte_precio', 'comentario', 'foto', 'voto', 'resena',
]);

function hoyChile() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

// Eventos que además cuentan POR LUGAR (para mostrarle a un operador destacado
// cuánta gente vio su ficha / pidió cómo llegar). Solo conteos, sin datos personales.
const EVENTOS_LUGAR = new Set(['detalle', 'comollegar']);
const ID_OK = (id) => typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id);

// Migración cacheada en una promesa: corre UNA sola vez aunque lleguen requests
// concurrentes durante el readFile (antes podía perder incrementos por el REPLACE).
let _migP = null;
function migrar() {
  return _migP || (_migP = (async () => {
    if (!ready) return;
    const row = await get('SELECT COUNT(*) AS c FROM an_evento');
    if (row && row.c > 0) return;
    try {
      const j = JSON.parse(await readFile(process.env.ANALYTICS_PATH || join(__dirname, '..', 'analytics.json'), 'utf8'));
      for (const [tipo, n] of Object.entries(j.porEvento || {})) await run('INSERT OR REPLACE INTO an_evento(tipo, n) VALUES(?, ?)', [tipo, n]);
      for (const [dia, obj] of Object.entries(j.porDia || {})) for (const [tipo, n] of Object.entries(obj || {})) await run('INSERT OR REPLACE INTO an_dia(dia, tipo, n) VALUES(?, ?, ?)', [dia, tipo, n]);
      for (const [ciudad, n] of Object.entries(j.porCiudad || {})) await run('INSERT OR REPLACE INTO an_ciudad(ciudad, n) VALUES(?, ?)', [ciudad, n]);
      console.log('[analytics] migrado desde JSON a SQLite');
    } catch { /* sin JSON: nada que migrar */ }
  })());
}

// Registra un evento anónimo. `ciudad` e `id` opcionales (conteo por ciudad / por lugar).
export async function registrarEvento(tipo, ciudad, id) {
  await migrar();
  if (!EVENTOS.has(tipo)) return;
  const dia = hoyChile();
  await run('INSERT INTO an_evento(tipo, n) VALUES(?, 1) ON CONFLICT(tipo) DO UPDATE SET n = n + 1', [tipo]);
  await run('INSERT INTO an_dia(dia, tipo, n) VALUES(?, ?, 1) ON CONFLICT(dia, tipo) DO UPDATE SET n = n + 1', [dia, tipo]);
  if (ciudad && typeof ciudad === 'string') {
    const c = ciudad.slice(0, 60);
    await run('INSERT INTO an_ciudad(ciudad, n) VALUES(?, 1) ON CONFLICT(ciudad) DO UPDATE SET n = n + 1', [c]);
  }
  if (EVENTOS_LUGAR.has(tipo) && ID_OK(id)) {
    await run('INSERT INTO an_lugar(id, tipo, n) VALUES(?, ?, 1) ON CONFLICT(id, tipo) DO UPDATE SET n = n + 1', [id, tipo]);
  }
}

// Vistas por lugar: { [id]: { detalle, comollegar } }. Para el panel de Destacados.
export async function vistasLugar() {
  await migrar();
  const rows = await all('SELECT id, tipo, n FROM an_lugar');
  const m = {};
  for (const r of rows) (m[r.id] || (m[r.id] = { detalle: 0, comollegar: 0 }))[r.tipo] = r.n;
  return m;
}

// Resumen para el panel /admin.
export async function resumenAnalytics() {
  await migrar();
  // Poda: el detalle por día solo se usa para los "últimos 7 días"; conserva ~180
  // días y borra lo más viejo para que la tabla no crezca sin límite (los totales
  // viven en an_evento/an_ciudad, que no se podan).
  const corte = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - 180 * 86400000));
  await run('DELETE FROM an_dia WHERE dia < ?', [corte]);
  const evRows = await all('SELECT tipo, n FROM an_evento');
  const porEvento = {}; let total = 0;
  for (const r of evRows) { porEvento[r.tipo] = r.n; total += r.n; }
  const diaRows = await all('SELECT dia, tipo, n FROM an_dia');
  const porDia = {};
  for (const r of diaRows) (porDia[r.dia] || (porDia[r.dia] = {}))[r.tipo] = r.n;
  const hoy = hoyChile();
  const dias = Object.keys(porDia).sort();
  const ultimos7keys = dias.slice(-7);
  const sum = (obj) => Object.values(obj || {}).reduce((a, b) => a + b, 0);
  const ultimos7 = ultimos7keys.map((d) => ({ dia: d, total: sum(porDia[d]), detalle: porDia[d] }));
  const ciuRows = await all('SELECT ciudad, n FROM an_ciudad ORDER BY n DESC LIMIT 12');
  return {
    total,
    porEvento,
    hoy: { dia: hoy, total: sum(porDia[hoy]), detalle: porDia[hoy] || {} },
    semana: ultimos7keys.reduce((a, d) => a + sum(porDia[d]), 0),
    ultimos7,
    topCiudades: ciuRows.map((r) => [r.ciudad, r.n]),
  };
}
