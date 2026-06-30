// ============================================================================
// Estaciona — Destacados (patrocinados / publicidad) — ahora en SQLite (db.js).
// ----------------------------------------------------------------------------
// Migra automáticamente destacados.json si existe. premium + tagline opcional.
// ============================================================================

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ready, run, all, get } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let _migrado = false;
async function migrar() {
  if (_migrado || !ready) return; _migrado = true;
  const row = await get('SELECT COUNT(*) AS c FROM destacados');
  if (row && row.c > 0) return;
  try {
    const arr = JSON.parse(await readFile(process.env.DESTACADOS_PATH || join(__dirname, '..', 'destacados.json'), 'utf8'));
    for (const d of arr) if (d && typeof d.id === 'string') await run('INSERT OR REPLACE INTO destacados(id, etiqueta, premium, tagline, hasta, ts) VALUES(?, ?, ?, ?, ?, ?)', [d.id, d.etiqueta || 'Destacado', d.premium ? 1 : 0, d.tagline || null, d.hasta || null, d.ts || Date.now()]);
    console.log(`[destacados] migrados ${arr.length} desde JSON a SQLite`);
  } catch { /* sin JSON: nada que migrar */ }
}

// Agrega o actualiza un destacado. dias>0 => vence en N días; premium + tagline opcional.
export async function agregarDestacado(id, etiqueta, dias, premium, tagline) {
  await migrar();
  if (!id || typeof id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(id)) return { ok: false, error: 'id' };
  const et = String(etiqueta || 'Destacado').trim().slice(0, 40) || 'Destacado';
  const n = Number(dias);
  const hasta = Number.isFinite(n) && n > 0 ? Date.now() + n * 86400000 : null;
  const tag = String(tagline || '').trim().slice(0, 80) || null;
  await run('INSERT OR REPLACE INTO destacados(id, etiqueta, premium, tagline, hasta, ts) VALUES(?, ?, ?, ?, ?, ?)', [id, et, premium ? 1 : 0, tag, hasta, Date.now()]);
  return { ok: true };
}
export async function quitarDestacado(id) {
  await migrar();
  await run('DELETE FROM destacados WHERE id = ?', [id]);
  const r = await get('SELECT changes() AS c');
  return !!(r && r.c > 0);
}
// Mapa id -> {etiqueta, premium, tagline} de los ACTIVOS (para el snapshot).
export async function mapaDestacados() {
  await migrar();
  const rows = await all('SELECT id, etiqueta, premium, tagline FROM destacados WHERE hasta IS NULL OR hasta > ?', [Date.now()]);
  const m = {};
  for (const d of rows) m[d.id] = { etiqueta: d.etiqueta || 'Destacado', premium: !!d.premium, tagline: d.tagline || null };
  return m;
}
// Lista para el panel admin (con estado activo/vencido).
export async function listarDestacados() {
  await migrar();
  const ahora = Date.now();
  const rows = await all('SELECT id, etiqueta, premium, tagline, hasta FROM destacados ORDER BY ts DESC');
  return rows.map((d) => ({ id: d.id, etiqueta: d.etiqueta || 'Destacado', premium: !!d.premium, tagline: d.tagline || null, hasta: d.hasta || null, activo: !d.hasta || d.hasta > ahora }));
}
