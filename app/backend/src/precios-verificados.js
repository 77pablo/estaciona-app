// ============================================================================
// Estaciona — Precios VERIFICADOS fijados por el admin (Abel) desde /admin
// ----------------------------------------------------------------------------
// Guardados en la base de datos: se pueden agregar/quitar EN CALIENTE, sin
// editar código ni redesplegar (a diferencia de precios-reales.js, que es el
// archivo fuente permanente para lo que ya no cambia). Pisan la estimación y
// marcan la ficha como verificada, con su fuente. En el pipeline, el precio del
// OPERADOR dueño tiene prioridad sobre este (ver server.js).
// Cache corto en memoria: /api/estacionamientos se pollea cada 6 s y estos
// precios son pocos (decenas), así no se lee la DB en cada request.
// ============================================================================

import { ready, run, all } from './db.js';

const ID_OK = (id) => typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id);
let _cache = null;
let _cacheTs = 0;
let _epoch = 0;      // sube en cada escritura; invalida lecturas en vuelo
const TTL = 30000;   // 30 s

// Fija (o actualiza) el precio verificado de una ficha. precioMin es opcional
// (cobro por minuto, Ley 20.967). Devuelve true si se guardó.
export async function setPrecioVerificado(id, { precioHora, precioMin, fuente } = {}) {
  if (!ready || !ID_OK(id)) return false;
  const ph = Math.round(Number(precioHora));
  if (!Number.isFinite(ph) || ph < 0 || ph > 100000) return false;
  const pmN = Number(precioMin);
  const pm = Number.isFinite(pmN) && pmN > 0 && pmN <= 100000 ? Math.round(pmN) : null;
  const f = (String(fuente || '').trim() || 'Verificado por Estaciona').slice(0, 80);
  await run('INSERT OR REPLACE INTO precio_verificado (id, precio_hora, precio_min, fuente, ts) VALUES (?, ?, ?, ?, ?)', [id, ph, pm, f, Date.now()]);
  _cache = null; _epoch++;
  return true;
}

export async function quitarPrecioVerificado(id) {
  const r = await run('DELETE FROM precio_verificado WHERE id = ?', [id]);
  _cache = null; _epoch++;
  return r.changes;
}

// Mapa { id -> { precioHora, precioMin, fuente } } para aplicar en el pipeline.
export async function getPreciosVerificados() {
  const ahora = Date.now();
  if (_cache && ahora - _cacheTs < TTL) return _cache;
  const ep = _epoch;   // si alguien fija/quita mientras leemos, NO cacheamos lo viejo
  const filas = ready ? await all('SELECT id, precio_hora, precio_min, fuente FROM precio_verificado') : [];
  const m = {};
  for (const f of filas) m[f.id] = { precioHora: f.precio_hora, precioMin: f.precio_min, fuente: f.fuente };
  if (_epoch === ep) { _cache = m; _cacheTs = ahora; }   // no hubo escritura en el medio
  return m;
}

// Para el panel /admin: lista con fecha, más recientes primero.
export async function listarPreciosVerificados() {
  const filas = ready ? await all('SELECT id, precio_hora AS precioHora, precio_min AS precioMin, fuente, ts FROM precio_verificado ORDER BY ts DESC LIMIT 500') : [];
  return filas || [];
}
