// ============================================================================
// Estaciona — Reseñas de la gente (estrellas 1-5 + comentario opcional)
// ----------------------------------------------------------------------------
// Las opiniones PROPIAS de Estaciona (no de Google): cada persona califica un
// estacionamiento con estrellas y, si quiere, deja un comentario. Persisten en
// la base (db.js, Postgres/Neon en prod o SQLite local). Es un dato 100% de la
// comunidad, legal y que crece con el uso — el foso real de la app.
// ============================================================================

import { ready, run, all } from './db.js';

const ID_OK = (id) => typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id);
// Quita '<' '>' y caracteres de control (defensa en profundidad, igual que aportes).
const limpiarTexto = (s) => String(s).replace(/[<>]/g, '').replace(/[\x00-\x1f\x7f]/g, ' ');

// Registra una reseña: estrellas (1-5, obligatorio) + texto (opcional). Devuelve ok.
export async function registrarResena(id, estrellas, texto) {
  if (!ready) return false;                       // DB no cargó: no fingir que se guardó
  if (!ID_OK(id)) return false;
  const e = Math.round(Number(estrellas));
  if (!Number.isInteger(e) || e < 1 || e > 5) return false;   // estrellas fuera de rango
  const t = typeof texto === 'string' ? limpiarTexto(texto).trim().slice(0, 280) : '';
  await run('INSERT INTO resenas(id, estrellas, texto, ts) VALUES(?, ?, ?, ?)', [id, e, t || null, Date.now()]);
  await run('DELETE FROM resenas WHERE rowid NOT IN (SELECT rowid FROM resenas ORDER BY ts DESC LIMIT 20000)');
  return true;
}

// Resumen por id: { [id]: { promedio, n } } (promedio con 1 decimal). Se adjunta
// a cada ficha en /api/estacionamientos, igual que los votos y el precio reportado.
export async function resumenResenas() {
  const map = {};
  const rows = await all('SELECT id, COUNT(*) AS n, SUM(estrellas) AS suma FROM resenas GROUP BY id');
  for (const r of rows) {
    if (!r.n) continue;
    map[r.id] = { promedio: Math.round((r.suma / r.n) * 10) / 10, n: r.n };
  }
  return map;
}

// Reseñas de un lugar (para el detalle): estrellas + texto + fecha, más recientes primero.
export async function resenasDe(id) {
  const filas = await all('SELECT estrellas, texto, ts FROM resenas WHERE id = ? ORDER BY ts DESC', [id]);
  const n = filas.length;
  const promedio = n ? Math.round((filas.reduce((s, f) => s + f.estrellas, 0) / n) * 10) / 10 : null;
  return { resenas: filas, promedio, n };
}

// Reseñas recientes (panel admin de moderación).
export async function resenasRecientes(n = 80) {
  return await all('SELECT id, estrellas, texto, ts FROM resenas ORDER BY ts DESC LIMIT ?', [n]);
}

// Elimina una reseña de un id en un ts exacto (moderación). Devuelve cuántas borró.
export async function eliminarResena(id, ts) {
  const r = await run('DELETE FROM resenas WHERE id = ? AND ts = ?', [id, ts]);
  return r.changes;
}
