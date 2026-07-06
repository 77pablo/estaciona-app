// ============================================================================
// Estaciona — Operadores B2B: código de acceso + cupo EN VIVO.
// ----------------------------------------------------------------------------
// El admin (Abel) genera un CÓDIGO por estacionamiento del dataset. Con ese
// código, el operador entra a /operador y marca cuántos cupos tiene libres.
// Ese dato alimenta el nivel #1 de disponibilidad ("en vivo · oficial", vía
// ocupacion-live.js → resolverDisponibilidad). Solo manda si es reciente
// (≤30 min): un dato viejo no debe dominar (el cupo ya pudo cambiar).
// ============================================================================

import { run, all, get } from './db.js';
import { idExiste } from './engine.js';
import { randomBytes } from 'node:crypto';

const FRESCO_MIN = 30;   // el cupo del operador manda solo si es de hace ≤30 min

// Código legible de 8 caracteres, sin letras/números confusos (0/O, 1/I, etc.).
function nuevoCodigo() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const b = randomBytes(8);
  let c = '';
  for (let i = 0; i < 8; i++) c += abc[b[i] % abc.length];
  return c;
}

// Admin: crea (o reusa) el código de un estacionamiento del dataset. null si el id no existe.
export async function crearCodigoOperador(id, nombre) {
  if (!idExiste(id)) return null;
  const ya = await get('SELECT codigo FROM operadores WHERE id = ?', [id]);
  if (ya) return ya.codigo;   // ya tenía uno: no acumular
  const codigo = nuevoCodigo();
  await run('INSERT INTO operadores (codigo, id, nombre, ts) VALUES (?, ?, ?, ?)', [codigo, id, nombre || null, Date.now()]);
  return codigo;
}

export async function operadorPorCodigo(codigo) {
  if (!/^[A-Z0-9]{4,16}$/.test(codigo || '')) return null;
  return await get('SELECT codigo, id, nombre FROM operadores WHERE codigo = ?', [codigo]);
}

// Operador: setea cupos libres (0..100000) y, opcional, el umbral "quedan pocos".
export async function setCupoOperador(codigo, libres, umbral) {
  const op = await operadorPorCodigo(codigo);
  if (!op) return null;
  const n = Number(libres);
  if (!Number.isFinite(n) || n < 0 || n > 100000) return null;
  const u = Number.isFinite(Number(umbral)) ? Math.max(0, Math.min(100000, Math.round(Number(umbral)))) : null;
  await run('DELETE FROM cupo_operador WHERE id = ?', [op.id]);
  await run('INSERT INTO cupo_operador (id, libres, umbral, ts) VALUES (?, ?, ?, ?)', [op.id, Math.round(n), u, Date.now()]);
  return op.id;
}

// Cupo en vivo FRESCO para los ids pedidos → { [id]: { libres, minAgo, umbralBajo } }.
export async function getCupoLive(ids) {
  if (!ids || !ids.length) return {};
  const set = new Set(ids);
  const rows = await all('SELECT id, libres, umbral, ts FROM cupo_operador');
  const out = {}; const ahora = Date.now();
  for (const r of rows) {
    if (!set.has(r.id)) continue;
    const minAgo = (ahora - r.ts) / 60000;
    if (minAgo > FRESCO_MIN) continue;   // viejo: no mandar
    out[r.id] = { libres: r.libres, minAgo, umbralBajo: (r.umbral ?? 5) };
  }
  return out;
}

// Admin: listar y borrar.
export async function listarOperadores() {
  return await all('SELECT o.codigo, o.id, o.nombre, o.ts, c.libres AS libres, c.ts AS cupoTs FROM operadores o LEFT JOIN cupo_operador c ON c.id = o.id ORDER BY o.ts DESC');
}
export async function eliminarOperador(codigo) {
  const op = await operadorPorCodigo(codigo);
  if (!op) return false;
  await run('DELETE FROM operadores WHERE codigo = ?', [codigo]);
  await run('DELETE FROM cupo_operador WHERE id = ?', [op.id]);
  return true;
}
