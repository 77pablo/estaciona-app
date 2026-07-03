// ============================================================================
// Estaciona — Votos de la gente ("¿había cupo aquí?") — ahora en SQLite (db.js).
// ----------------------------------------------------------------------------
// Persiste en la base de datos (SQLite vía node:sqlite). La primera vez migra
// automáticamente el votos.json antiguo si existe (para no perder datos).
// ============================================================================

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ready, run, all, get } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ID_OK = (id) => typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id);

// Importa una sola vez el JSON antiguo si la tabla está vacía. Migración cacheada
// en una promesa para que corra UNA sola vez aunque lleguen requests concurrentes.
let _migP = null;
function migrar() {
  return _migP || (_migP = (async () => {
    if (!ready) return;
    const row = await get('SELECT COUNT(*) AS c FROM votos');
    if (row && row.c > 0) return;
    try {
      const arr = JSON.parse(await readFile(process.env.VOTOS_PATH || join(__dirname, '..', 'votos.json'), 'utf8'));
      for (const v of arr) if (v && ID_OK(v.id)) await run('INSERT INTO votos(id, ok, ts) VALUES(?, ?, ?)', [v.id, v.ok ? 1 : 0, v.ts || Date.now()]);
      console.log(`[votos] migrados ${arr.length} desde JSON a SQLite`);
    } catch { /* no había JSON: nada que migrar */ }
  })());
}

// Registra un voto (ok = true → "había cupo"; false → "no había").
export async function registrarVoto(id, ok) {
  await migrar();
  if (!ready) return false;             // DB no cargó: no fingir que se guardó
  if (!ID_OK(id)) return false;
  await run('INSERT INTO votos(id, ok, ts) VALUES(?, ?, ?)', [id, ok ? 1 : 0, Date.now()]);
  // Poda: conserva los 5000 más recientes.
  await run('DELETE FROM votos WHERE rowid NOT IN (SELECT rowid FROM votos ORDER BY ts DESC LIMIT 5000)');
  return true;
}

// Total de votos acumulados (contador del panel admin).
export async function contarVotos() {
  await migrar();
  const r = await get('SELECT COUNT(*) AS c FROM votos');
  return r ? r.c : 0;
}

// Conteo por lugar en las últimas `horas` horas: { [id]: {up, down} }.
export async function tallyReciente(horas = 3) {
  await migrar();
  const desde = Date.now() - horas * 3600000;
  const rows = await all(
    `SELECT id,
            SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) AS up,
            SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS down
     FROM votos WHERE ts >= ? GROUP BY id`, [desde]);
  const map = {};
  for (const r of rows) map[r.id] = { up: r.up, down: r.down };
  return map;
}

// Señal de cupo PONDERADA POR FRESCURA (últimos `ventanaMin` min). Un voto
// reciente pesa mucho más que uno viejo (peso lineal 1→0 dentro de la ventana),
// porque el cupo cambia rápido. Devuelve por id: conteos crudos { up, down },
// el voto más nuevo (ultimoTs) y un score ponderado { wUp, wDown }. Con eso,
// resolverDisponibilidad() decide si el reporte de la gente "manda" sobre el
// semáforo estimado. Es la base de la capa en vivo tipo Waze.
export async function senalReciente(ventanaMin = 45) {
  await migrar();
  const desde = Date.now() - ventanaMin * 60000;
  const rows = await all('SELECT id, ok, ts FROM votos WHERE ts >= ? ORDER BY ts DESC', [desde]);
  const ahora = Date.now();
  const map = {};
  for (const r of rows) {
    const peso = Math.max(0, 1 - (ahora - r.ts) / 60000 / ventanaMin);   // 1 (recién) → 0 (borde)
    const m = map[r.id] || (map[r.id] = { up: 0, down: 0, wUp: 0, wDown: 0, ultimoTs: 0 });
    if (r.ok) { m.up++; m.wUp += peso; } else { m.down++; m.wDown += peso; }
    if (r.ts > m.ultimoTs) m.ultimoTs = r.ts;
  }
  return map;
}
