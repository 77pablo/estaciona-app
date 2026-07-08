// ============================================================================
// Estaciona — Feedback de usuarios (sugerencias / reportar problema)
// ----------------------------------------------------------------------------
// Canal directo para que testers y usuarios manden sugerencias o avisen de un
// error de la app (distinto de "reportar un lugar" mal: eso es reportes.js). Se
// guarda en la base de datos y se lee en /admin. Sin cuenta ni datos personales:
// solo el texto + un contexto técnico opcional (ciudad/página/versión) que ayuda
// a reproducir. Útil sobre todo en la etapa beta previa al lanzamiento.
// ============================================================================

import { ready, run, all, get } from './db.js';

const MAX_TEXTO = 1000;      // un mensaje, no un ensayo (anti-abuso)
const MAX_CONTEXTO = 300;

// Registra un feedback. Devuelve true si se guardó.
export async function registrarFeedback(texto, contexto) {
  if (!ready) return false;
  const t = String(texto || '').trim().slice(0, MAX_TEXTO);
  if (t.length < 2) return false;                         // vacío / basura
  const ctx = String(contexto || '').trim().slice(0, MAX_CONTEXTO) || null;
  await run('INSERT INTO feedback(texto, contexto, ts) VALUES(?, ?, ?)', [t, ctx, Date.now()]);
  // Poda: conserva los 5.000 más recientes.
  await run('DELETE FROM feedback WHERE rowid NOT IN (SELECT rowid FROM feedback ORDER BY ts DESC LIMIT 5000)');
  return true;
}

// Total acumulado (contador del panel admin).
export async function contarFeedback() {
  const r = await get('SELECT COUNT(*) AS c FROM feedback');
  return r ? r.c : 0;
}

// Los más recientes (para el panel admin). Devuelve [{ id, texto, contexto, ts }].
export async function feedbackReciente(n = 60) {
  const filas = await all('SELECT rowid AS id, texto, contexto, ts FROM feedback ORDER BY ts DESC LIMIT ?', [n]);
  return filas || [];
}

// Borra un feedback ya atendido.
export async function eliminarFeedback(id) {
  const r = await run('DELETE FROM feedback WHERE rowid = ?', [Number(id)]);
  return r.changes;
}
