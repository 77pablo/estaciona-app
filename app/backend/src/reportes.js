// ============================================================================
// Estaciona — Reportes de problemas de un lugar (crowdsource de CORRECCIÓN)
// ----------------------------------------------------------------------------
// La gente avisa cuando una ficha está mal: cerrada para siempre, ya no existe,
// precio equivocado o datos incorrectos. Persiste en la base de datos (db.js) y
// se revisa en /admin para corregir o borrar la ficha. NO cambia nada solo — es
// una señal para el moderador (mantiene la honestidad de los datos).
// ============================================================================

import { ready, run, all, get } from './db.js';

const ID_OK = (id) => typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id);
// Motivos cerrados (el frontend ofrece exactamente estos).
const MOTIVOS = new Set(['cerrado', 'no-existe', 'precio', 'datos', 'otro']);

// Registra un reporte. Devuelve true si se guardó.
export async function registrarReporte(id, motivo) {
  if (!ready) return false;                            // DB no cargó: no fingir que se guardó
  if (!ID_OK(id) || !MOTIVOS.has(motivo)) return false;
  await run('INSERT INTO reportes(id, motivo, ts) VALUES(?, ?, ?)', [id, motivo, Date.now()]);
  // Poda: conserva los 20.000 más recientes.
  await run('DELETE FROM reportes WHERE rowid NOT IN (SELECT rowid FROM reportes ORDER BY ts DESC LIMIT 20000)');
  return true;
}

// Total acumulado (contador del panel admin).
export async function contarReportes() {
  const r = await get('SELECT COUNT(*) AS c FROM reportes');
  return r ? r.c : 0;
}

// Reportes AGRUPADOS por ficha (para el panel admin): 1 fila por lugar con el
// desglose de motivos y el total, ordenados por el aviso más reciente. Así 40
// avisos de la misma ficha no inundan el feed. Devuelve máx n lugares.
export async function reportesRecientes(n = 80) {
  // GROUP BY id, motivo → contamos por motivo; luego re-agrupamos por lugar en JS.
  // Ventana n*5 (máx 5 motivos por ficha) garantiza n lugares completos.
  const filas = await all(
    'SELECT id, motivo, COUNT(*) AS n, MAX(ts) AS ts FROM reportes GROUP BY id, motivo ORDER BY MAX(ts) DESC LIMIT ?',
    [n * 5],
  );
  const porId = new Map();
  for (const f of filas) {
    let g = porId.get(f.id);
    if (!g) { g = { id: f.id, ts: f.ts, n: 0, motivos: {} }; porId.set(f.id, g); }
    g.n += f.n;
    g.motivos[f.motivo] = (g.motivos[f.motivo] || 0) + f.n;
    if (f.ts > g.ts) g.ts = f.ts;
  }
  return [...porId.values()].sort((a, b) => b.ts - a.ts).slice(0, n);
}

// Borra TODOS los reportes de una ficha (el moderador la resolvió de raíz).
export async function eliminarReporte(id) {
  const r = await run('DELETE FROM reportes WHERE id = ?', [id]);
  return r.changes;
}
