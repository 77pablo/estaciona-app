// ============================================================================
// Estaciona — Lista de espera por ciudad ("avísame cuando lleguen").
// ----------------------------------------------------------------------------
// Para ciudades aún sin datos: la gente deja su interés (y, opcional, su email
// para avisarle al lanzar). Sirve para (a) responder "te avisamos" y (b) que el
// equipo priorice dónde expandir según la demanda real. Persiste en db.js.
// ============================================================================

import { run, all } from './db.js';

// Sanea la ciudad: texto corto y razonable (no confiar en el cliente).
const CIUDAD_OK = (c) => typeof c === 'string' && c.trim().length >= 2 && c.trim().length <= 60;
// Email básico y opcional (vacío = solo cuenta la demanda, sin contacto).
const EMAIL_OK = (e) => !e || (typeof e === 'string' && e.length <= 120 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));

// Registra el interés en una ciudad. Devuelve true si se guardó.
export async function registrarInteres(ciudad, email, ts = Date.now()) {
  const c = (ciudad || '').trim();
  const e = (email || '').trim().toLowerCase();
  if (!CIUDAD_OK(c) || !EMAIL_OK(e)) return false;
  await run('INSERT INTO interes_ciudad (ciudad, email, ts) VALUES (?, ?, ?)', [c, e || null, ts]);
  return true;
}

// Resumen de demanda por ciudad (para priorizar expansión). Uso interno/admin.
export async function resumenInteres() {
  return await all(
    'SELECT ciudad, COUNT(*) AS n, COUNT(email) AS con_email, MAX(ts) AS ultimo FROM interes_ciudad GROUP BY ciudad ORDER BY n DESC',
  );
}
