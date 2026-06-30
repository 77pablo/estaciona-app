// ============================================================================
// Estaciona — Destacados (estacionamientos patrocinados / publicidad)
// ----------------------------------------------------------------------------
// Monetización del piloto: un operador paga y su estacionamiento aparece
// DESTACADO (arriba de la lista + pin e insignia "Destacado"). Lo gestiona Abel
// desde /admin (agregar/quitar, con vencimiento opcional). SIEMPRE marcado como
// publicidad, de forma honesta (no altera la disponibilidad ni el precio real).
//
// Persistencia: env DESTACADOS_PATH (volumen Railway) o archivo local.
// ============================================================================

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = process.env.DESTACADOS_PATH || join(__dirname, '..', 'destacados.json');
let _dirOk = false, _avisoFallo = false;

let destacados = [];          // [{ id, etiqueta, hasta:ts|null, ts }]
let cargaPromise = null;
let _cola = Promise.resolve();

function cargar() {
  return cargaPromise ??= readFile(FILE, 'utf8')
    .then((txt) => { destacados = JSON.parse(txt) || []; })
    .catch(() => { destacados = []; });
}
function guardar() { _cola = _cola.then(escribir, escribir); return _cola; }
async function escribir() {
  const tmp = `${FILE}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  const txt = JSON.stringify(destacados);
  try {
    if (!_dirOk) { await mkdir(dirname(FILE), { recursive: true }); _dirOk = true; }
    await writeFile(tmp, txt); await rename(tmp, FILE);
  } catch (e) {
    if (!_avisoFallo) { _avisoFallo = true; console.warn(`[destacados] no pude escribir en ${FILE}: ${e.message} — NO persiste`); }
  }
}

const activo = (d) => !d.hasta || d.hasta > Date.now();

// Agrega o actualiza un destacado. dias>0 => vence en N días; si no, sin vencimiento.
export async function agregarDestacado(id, etiqueta, dias) {
  await cargar();
  if (!id || typeof id !== 'string') return { ok: false, error: 'id' };
  const et = String(etiqueta || 'Destacado').trim().slice(0, 40) || 'Destacado';
  const n = Number(dias);
  const hasta = Number.isFinite(n) && n > 0 ? Date.now() + n * 86400000 : null;
  const ex = destacados.find((d) => d.id === id);
  if (ex) { ex.etiqueta = et; ex.hasta = hasta; ex.ts = Date.now(); }
  else destacados.push({ id, etiqueta: et, hasta, ts: Date.now() });
  await guardar();
  return { ok: true };
}
export async function quitarDestacado(id) {
  await cargar();
  const antes = destacados.length;
  destacados = destacados.filter((d) => d.id !== id);
  if (destacados.length === antes) return false;
  await guardar();
  return true;
}
// Mapa id -> etiqueta de los destacados ACTIVOS (para marcar el snapshot).
export async function mapaDestacados() {
  await cargar();
  const m = {};
  for (const d of destacados) if (activo(d)) m[d.id] = d.etiqueta || 'Destacado';
  return m;
}
// Lista para el panel admin (con estado activo/vencido y fecha).
export async function listarDestacados() {
  await cargar();
  return destacados.slice().sort((a, b) => b.ts - a.ts).map((d) => ({
    id: d.id, etiqueta: d.etiqueta || 'Destacado', hasta: d.hasta || null, activo: activo(d),
  }));
}
