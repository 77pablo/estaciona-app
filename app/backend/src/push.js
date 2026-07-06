// ============================================================================
// Estaciona — Web Push real (background). Avisos aunque la app esté cerrada:
//   · alarma anti-multa (por tiempo)
//   · avísame cuando sea gratis (por tiempo)
//   · vigilar cupo (evento: la gente confirma cupo o el operador lo pone en vivo)
// ----------------------------------------------------------------------------
// Requiere claves VAPID en el entorno (VAPID_PUBLIC / VAPID_PRIVATE). Sin ellas
// queda DESACTIVADO y no rompe nada: la app sigue avisando dentro de sí misma.
// En iPhone el push solo llega con la app INSTALADA (agregada a inicio), iOS 16.4+.
// ============================================================================

import webpush from 'web-push';
import { run, all, get } from './db.js';

const PUB = process.env.VAPID_PUBLIC || '';
const PRIV = process.env.VAPID_PRIVATE || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:pdanielespinozavega@gmail.com';
export let pushActivo = false;
try {
  if (PUB && PRIV) { webpush.setVapidDetails(SUBJECT, PUB, PRIV); pushActivo = true; }
} catch (e) { console.warn('[push] claves VAPID inválidas:', e.message); }
export function vapidPublic() { return pushActivo ? PUB : ''; }

export async function guardarSub(sub) {
  if (!pushActivo || !sub || !sub.endpoint) return false;
  await run('DELETE FROM push_subs WHERE endpoint = ?', [sub.endpoint]);
  await run('INSERT INTO push_subs (endpoint, sub, ts) VALUES (?, ?, ?)', [sub.endpoint, JSON.stringify(sub), Date.now()]);
  return true;
}

async function limpiarEndpoint(endpoint) {
  await run('DELETE FROM push_subs WHERE endpoint = ?', [endpoint]);
  await run('DELETE FROM push_jobs WHERE endpoint = ?', [endpoint]);
  await run('DELETE FROM push_watch WHERE endpoint = ?', [endpoint]);
}

// Envía a un endpoint; si la suscripción expiró (404/410), la limpia.
async function enviar(endpoint, payload) {
  const row = await get('SELECT sub FROM push_subs WHERE endpoint = ?', [endpoint]);
  if (!row) return;
  let sub; try { sub = JSON.parse(row.sub); } catch { return; }
  try { await webpush.sendNotification(sub, JSON.stringify(payload)); }
  catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) await limpiarEndpoint(endpoint); }
}

// Agenda un aviso por tiempo. tipo: 'alarma' | 'gratis'.
export async function agendar(tipo, sub, id, nombre, cuando) {
  if (!pushActivo || !(await guardarSub(sub)) || !Number.isFinite(cuando)) return false;
  if (tipo === 'alarma') await run('DELETE FROM push_jobs WHERE tipo = ? AND endpoint = ?', [tipo, sub.endpoint]);   // una sola alarma activa
  else await run('DELETE FROM push_jobs WHERE tipo = ? AND endpoint = ? AND id = ?', [tipo, sub.endpoint, id || null]);   // reemplaza el del mismo lugar
  await run('INSERT INTO push_jobs (tipo, endpoint, id, nombre, cuando, sono, ts) VALUES (?, ?, ?, ?, ?, 0, ?)', [tipo, sub.endpoint, id || null, nombre || null, Math.round(cuando), Date.now()]);
  return true;
}
export async function cancelarAgendados(tipo, endpoint) {
  if (endpoint) await run('DELETE FROM push_jobs WHERE tipo = ? AND endpoint = ?', [tipo, endpoint]);
}

export async function vigilar(sub, id, nombre) {
  if (!pushActivo || !(await guardarSub(sub)) || !id) return false;
  await run('DELETE FROM push_watch WHERE endpoint = ? AND id = ?', [sub.endpoint, id]);
  await run('INSERT INTO push_watch (endpoint, id, nombre, ts) VALUES (?, ?, ?, ?)', [sub.endpoint, id, nombre || null, Date.now()]);
  return true;
}
export async function noVigilar(endpoint, id) {
  if (endpoint && id) await run('DELETE FROM push_watch WHERE endpoint = ? AND id = ?', [endpoint, id]);
}

// Tick del agendador (cada ~1 min). `hayCupo(id)=>Promise<bool>` lo provee el
// server (usa señal de la gente + cupo en vivo del operador).
export async function tickPush(hayCupo) {
  if (!pushActivo) return;
  const ahora = Date.now();
  // 1) Avisos por tiempo vencidos (alarma / gratis).
  const jobs = await all('SELECT seq, tipo, endpoint, nombre FROM push_jobs WHERE sono = 0 AND cuando <= ? ORDER BY cuando LIMIT 200', [ahora]);
  for (const j of jobs) {
    const payload = j.tipo === 'gratis'
      ? { title: 'Estaciona 🅿️', body: `${j.nombre || 'Un lugar'} — ahora suele ser gratis 🎉`, tag: 'estaciona-gratis', url: '/app' }
      : j.tipo === 'recordatorio'
      ? { title: 'Estaciona 🅿️', body: `Revisa ${j.nombre || 'el lugar'} — ¿hay cupo?`, tag: 'estaciona-recordatorio', url: '/app' }
      : { title: 'Estaciona 🅿️', body: `Vuelve a tu auto — ${j.nombre || 'tu estacionamiento'} 🅿️`, tag: 'estaciona-alarma', url: '/app' };
    await enviar(j.endpoint, payload);
    await run('UPDATE push_jobs SET sono = 1 WHERE seq = ?', [j.seq]);
  }
  await run('DELETE FROM push_jobs WHERE sono = 1 AND cuando < ?', [ahora - 2 * 3600000]);   // poda
  // 2) Vigilancias de cupo (evento).
  const watches = await all('SELECT endpoint, id, nombre FROM push_watch');
  if (watches.length && typeof hayCupo === 'function') {
    const estado = {};
    for (const id of [...new Set(watches.map((w) => w.id))]) { try { estado[id] = await hayCupo(id); } catch { estado[id] = false; } }
    for (const w of watches) {
      if (!estado[w.id]) continue;
      await enviar(w.endpoint, { title: 'Estaciona 🅿️', body: `¡Hay cupo en ${w.nombre || 'el lugar que vigilas'}! 🅿️`, tag: 'estaciona-cupo', url: '/app' });
      await run('DELETE FROM push_watch WHERE endpoint = ? AND id = ?', [w.endpoint, w.id]);
    }
  }
}
