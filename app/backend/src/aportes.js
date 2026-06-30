// ============================================================================
// Estaciona — APORTES de la gente (estilo Waze): precios reportados + comentarios
// ----------------------------------------------------------------------------
// Crowdsource sin cuenta. Cada aporte: { id, precio?, texto?, ts }.
// Se guarda en JSON con escritura atómica. Para que PERSISTA entre redeploys de
// Railway hay que montar un volumen y apuntar APORTES_PATH ahí (ej. /data/aportes.json).
// ============================================================================

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = process.env.APORTES_PATH || join(__dirname, '..', 'aportes.json');
let _dirOk = false, _avisoFallo = false;

let aportes = [];
let cargaPromise = null;
let _cola = Promise.resolve();   // serializa escrituras (sin carreras sobre el archivo)

// id válido = slug del dataset (sin comillas/símbolos) → evita corromper el JSON
// y cierra el XSS por id en el panel admin (el id se muestra en onclick).
const ID_OK = (id) => typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id);

function cargar() {
  return cargaPromise ??= readFile(FILE, 'utf8')
    .then((txt) => { aportes = JSON.parse(txt) || []; })
    .catch(() => { aportes = []; });
}
// Cola: cada escritura corre DESPUÉS de la anterior, con .tmp ÚNICO → sin carrera
// que corrompa el JSON (evita pérdida total de aportes vía catch→[]).
function guardar() { _cola = _cola.then(escribir, escribir); return _cola; }
async function escribir() {
  const tmp = `${FILE}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  const datos = JSON.stringify(aportes);
  try {
    if (!_dirOk) { await mkdir(dirname(FILE), { recursive: true }); _dirOk = true; }   // crea el dir del volumen si falta
    await writeFile(tmp, datos); await rename(tmp, FILE);
  } catch (e) {
    if (!_avisoFallo) { _avisoFallo = true; console.warn(`[aportes] no pude escribir en ${FILE}: ${e.message} — los aportes NO persisten`); }
  }
}

// Registra un aporte. precio (número CLP/hora) y/o texto (comentario). Devuelve ok.
export async function registrarAporte(id, precio, texto) {
  await cargar();
  if (!ID_OK(id)) return false;
  const p = Number(precio);
  const precioOk = Number.isFinite(p) && p > 0 && p <= 20000 ? Math.round(p) : null;
  const t = typeof texto === 'string' ? texto.trim().slice(0, 280) : '';
  if (precioOk == null && !t) return false;            // aporte vacío
  aportes.push({ id, precio: precioOk, texto: t || null, ts: Date.now() });
  if (aportes.length > 20000) aportes = aportes.slice(-20000);
  await guardar();
  return true;
}

const mediana = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

// Resumen liviano por id (para la lista/detalle): precio reportado + conteos.
export async function resumenAportes() {
  await cargar();
  const map = {};
  for (const a of aportes) {
    const r = map[a.id] || (map[a.id] = { precios: [], nComentarios: 0 });
    if (a.precio != null) r.precios.push(a.precio);
    if (a.texto) r.nComentarios++;
  }
  const out = {};
  for (const [id, r] of Object.entries(map)) {
    out[id] = {
      precioReportado: mediana(r.precios),   // mediana de lo reportado por la gente
      nPrecios: r.precios.length,
      nComentarios: r.nComentarios,
    };
  }
  return out;
}

// --- Panel admin ---
// Precios reportados por la gente, por lugar (para cosechar a precios-reales.js).
// Cada uno: { id, precioReportado (mediana), nPrecios }. Ordenado por más reportes.
export async function preciosReportados() {
  const r = await resumenAportes();
  return Object.entries(r)
    .filter(([, v]) => v.precioReportado != null)
    .map(([id, v]) => ({ id, precioReportado: v.precioReportado, nPrecios: v.nPrecios }))
    .sort((a, b) => b.nPrecios - a.nPrecios);
}

// --- Moderación ---
// Comentarios recientes de TODO el país (para el panel admin). Máx n.
export async function comentariosRecientes(n = 80) {
  await cargar();
  return aportes.filter((a) => a.texto).sort((a, b) => b.ts - a.ts).slice(0, n)
    .map((a) => ({ id: a.id, texto: a.texto, ts: a.ts }));
}
// Borra un aporte por (id del lugar + ts). Devuelve cuántos borró.
export async function eliminarAporte(id, ts) {
  await cargar();
  const antes = aportes.length;
  aportes = aportes.filter((a) => !(a.id === id && a.ts === ts));
  if (aportes.length !== antes) await guardar();
  return antes - aportes.length;
}

// Detalle completo de un lugar: comentarios recientes (máx 30).
export async function aportesDe(id) {
  await cargar();
  const propios = aportes.filter((a) => a.id === id);
  const comentarios = propios.filter((a) => a.texto).sort((a, b) => b.ts - a.ts).slice(0, 30)
    .map((a) => ({ texto: a.texto, ts: a.ts }));
  const precios = propios.filter((a) => a.precio != null).map((a) => a.precio);
  return { comentarios, precioReportado: mediana(precios), nPrecios: precios.length };
}
