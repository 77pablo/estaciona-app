// ============================================================================
// Estaciona — Aportes de la gente (precios + comentarios) — ahora en SQLite.
// ----------------------------------------------------------------------------
// Persiste en la base (db.js). Migra automáticamente aportes.json si existe.
// ============================================================================

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ready, run, all, get } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ID_OK = (id) => typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id);

const mediana = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

// Migración cacheada en una promesa (corre UNA vez aunque haya requests concurrentes).
let _migP = null;
function migrar() {
  return _migP || (_migP = (async () => {
    if (!ready) return;
    const row = await get('SELECT COUNT(*) AS c FROM aportes');
    if (row && row.c > 0) return;
    try {
      const arr = JSON.parse(await readFile(process.env.APORTES_PATH || join(__dirname, '..', 'aportes.json'), 'utf8'));
      for (const a of arr) if (a && ID_OK(a.id)) await run('INSERT INTO aportes(id, precio, texto, ts) VALUES(?, ?, ?, ?)', [a.id, a.precio ?? null, a.texto ?? null, a.ts || Date.now()]);
      console.log(`[aportes] migrados ${arr.length} desde JSON a SQLite`);
    } catch { /* sin JSON: nada que migrar */ }
  })());
}

// Registra un aporte. precio (CLP/hora) y/o texto (comentario). Devuelve ok.
export async function registrarAporte(id, precio, texto) {
  await migrar();
  if (!ID_OK(id)) return false;
  const p = Number(precio);
  const precioOk = Number.isFinite(p) && p > 0 && p <= 20000 ? Math.round(p) : null;
  const t = typeof texto === 'string' ? texto.trim().slice(0, 280) : '';
  if (precioOk == null && !t) return false;            // aporte vacío
  await run('INSERT INTO aportes(id, precio, texto, ts) VALUES(?, ?, ?, ?)', [id, precioOk, t || null, Date.now()]);
  await run('DELETE FROM aportes WHERE rowid NOT IN (SELECT rowid FROM aportes ORDER BY ts DESC LIMIT 20000)');
  return true;
}

// Resumen por id: { [id]: { precioReportado:mediana, nPrecios, nComentarios } }.
export async function resumenAportes() {
  await migrar();
  const map = {};
  const precios = await all('SELECT id, precio FROM aportes WHERE precio IS NOT NULL');
  const porId = {};
  for (const r of precios) (porId[r.id] || (porId[r.id] = [])).push(r.precio);
  for (const id in porId) map[id] = { precioReportado: mediana(porId[id]), nPrecios: porId[id].length, nComentarios: 0 };
  const coms = await all('SELECT id, COUNT(*) AS c FROM aportes WHERE texto IS NOT NULL GROUP BY id');
  for (const r of coms) (map[r.id] || (map[r.id] = { precioReportado: null, nPrecios: 0, nComentarios: 0 })).nComentarios = r.c;
  return map;
}

// Precios reportados (panel admin), ordenado desc por nº de reportes.
export async function preciosReportados() {
  const m = await resumenAportes();
  return Object.entries(m)
    .filter(([, v]) => v.nPrecios > 0)
    .map(([id, v]) => ({ id, precioReportado: v.precioReportado, nPrecios: v.nPrecios }))
    .sort((a, b) => b.nPrecios - a.nPrecios);
}

// Comentarios recientes (panel admin).
export async function comentariosRecientes(n = 80) {
  await migrar();
  return await all('SELECT id, texto, ts FROM aportes WHERE texto IS NOT NULL ORDER BY ts DESC LIMIT ?', [n]);
}

// Elimina comentarios/aportes de un id en un ts exacto (moderación). Devuelve cuántos borró.
export async function eliminarAporte(id, ts) {
  await migrar();
  const r = await run('DELETE FROM aportes WHERE id = ? AND ts = ?', [id, ts]);
  return r.changes;
}

// Aportes de un lugar (detalle): comentarios + precio reportado.
export async function aportesDe(id) {
  await migrar();
  const comentarios = await all('SELECT texto, ts FROM aportes WHERE id = ? AND texto IS NOT NULL ORDER BY ts DESC', [id]);
  const precios = (await all('SELECT precio FROM aportes WHERE id = ? AND precio IS NOT NULL', [id])).map((r) => r.precio);
  return { comentarios, precioReportado: mediana(precios), nPrecios: precios.length };
}
