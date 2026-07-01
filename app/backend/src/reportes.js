// ============================================================================
// Estaciona — Reportes de problemas de un lugar (crowdsource de CORRECCIÓN)
// ----------------------------------------------------------------------------
// La gente avisa cuando una ficha está mal: cerrada para siempre, ya no existe,
// precio equivocado o datos incorrectos. Persiste en la base de datos (db.js) y
// se revisa en /admin para corregir o borrar la ficha. NO cambia nada solo — es
// una señal para el moderador (mantiene la honestidad de los datos).
// ============================================================================

import { run, all, get } from './db.js';

const ID_OK = (id) => typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id);
// Motivos cerrados (el frontend ofrece exactamente estos).
export const MOTIVOS = new Set(['cerrado', 'no-existe', 'precio', 'datos', 'otro']);

// Registra un reporte. Devuelve true si se guardó.
export async function registrarReporte(id, motivo) {
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

// Reportes recientes de todo el país (para el panel admin). Máx n.
export async function reportesRecientes(n = 80) {
  return await all('SELECT id, motivo, ts FROM reportes ORDER BY ts DESC LIMIT ?', [n]);
}

// Borra un reporte puntual (por id + ts).
export async function eliminarReporte(id, ts) {
  const r = await run('DELETE FROM reportes WHERE id = ? AND ts = ?', [id, ts]);
  return r.changes;
}
