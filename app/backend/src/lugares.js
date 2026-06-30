// ============================================================================
// Estaciona — Lugares reportados por la gente (crowdsource estilo Waze)
// ----------------------------------------------------------------------------
// Cuando un estacionamiento NO está en el mapa, cualquiera puede agregarlo (sin
// cuenta): nombre, ubicación (un pin), si es pago o gratis y un precio aprox.
// Se guarda como una ficha normal con verificado:false y reportado:true, y
// aparece en la lista y el mapa de su ciudad. Se modera en /admin (borrar los
// falsos / spam).
//
// Persistencia: igual que votos/aportes/fotos — la env var LUGARES_PATH apunta
// al volumen (Railway); si no, archivo local (se borra en cada redeploy).
// ============================================================================

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ZONAS } from './data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = process.env.LUGARES_PATH || join(__dirname, '..', 'lugares.json');
let _dirOk = false, _avisoFallo = false;

// Índice ciudad -> zona: valida la ciudad reportada (debe existir en el dataset
// para que el selector/filtro la muestren) y hereda su región.
const ZONA_POR_NOMBRE = {};
for (const z of ZONAS) ZONA_POR_NOMBRE[z.nombre] = z;

// Helpers para el dedupe (nombre normalizado + distancia aproximada en metros).
const normNombre = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
function distM(aLat, aLng, bLat, bLng) {
  const dLat = (aLat - bLat) * 111000;
  const dLng = (aLng - bLng) * 111000 * Math.cos(aLat * Math.PI / 180);
  return Math.hypot(dLat, dLng);
}

let lugares = [];
let cargaPromise = null;
let _cola = Promise.resolve();    // cola: serializa las escrituras (sin carreras sobre el archivo)

// Carga idempotente: se cachea la promesa (sin ventana de carrera al arrancar).
function cargar() {
  return cargaPromise ??= readFile(FILE, 'utf8')
    .then((txt) => { lugares = JSON.parse(txt) || []; })
    .catch(() => { lugares = []; });
}
// Encola la escritura: cada una corre DESPUÉS de la anterior (aunque alguna falle),
// así dos POST casi simultáneos no escriben el mismo .tmp a la vez (evita JSON
// corrupto → catch→[] → pérdida silenciosa de TODOS los lugares).
function guardar() {
  _cola = _cola.then(escribir, escribir);
  return _cola;
}
async function escribir() {
  // .tmp ÚNICO por escritura (pid+aleatorio) + rename atómico. Se serializa con
  // la cola, así que el contenido siempre es el `lugares` más reciente.
  const tmp = `${FILE}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  const datos = JSON.stringify(lugares);
  try {
    if (!_dirOk) { await mkdir(dirname(FILE), { recursive: true }); _dirOk = true; }   // crea el dir del volumen si falta
    await writeFile(tmp, datos); await rename(tmp, FILE);
  } catch (e) {
    if (!_avisoFallo) { _avisoFallo = true; console.warn(`[lugares] no pude escribir en ${FILE}: ${e.message} — los lugares NO persisten`); }
  }
}

// Registra un lugar reportado. Devuelve { ok, id } o { ok:false, error }.
export async function registrarLugar(d) {
  await cargar();
  d = d || {};
  const nombre = String(d.nombre ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (nombre.length < 2) return { ok: false, error: 'nombre' };
  const lat = Number(d.lat), lng = Number(d.lng);
  // Chile (continental + insular) aproximado: descarta coords basura / fuera del país.
  if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -56 || lat > -17 || lng < -110 || lng > -66) return { ok: false, error: 'ubicacion' };
  const ciudad = String(d.ciudad ?? '');
  const zona = ZONA_POR_NOMBRE[ciudad];
  if (!zona) return { ok: false, error: 'ciudad' };
  const tipo = d.tipo === 'calle' ? 'calle' : 'privado';
  const gratis = !!d.gratis;
  // Pago sin precio = null (lo afina la comunidad reportando precio después).
  let precioHora = null;
  if (!gratis && d.precioHora != null && d.precioHora !== '') {
    const ph = Number(d.precioHora);
    if (Number.isFinite(ph) && ph > 0 && ph <= 20000) precioHora = Math.round(ph);
  }
  const direccion = String(d.direccion ?? '').trim().slice(0, 120) || `${ciudad} (reportado)`;
  // Dedupe: mismo nombre normalizado + a menos de ~60 m ya reportado en esa ciudad.
  const nn = normNombre(nombre);
  if (lugares.some((l) => l.ciudad === ciudad && normNombre(l.nombre) === nn && distM(lat, lng, l.lat, l.lng) < 60)) {
    return { ok: false, error: 'duplicado' };
  }
  const ts = Date.now();
  const id = `x-rep-${ts}-${Math.random().toString(36).slice(2, 7)}`;
  const ficha = {
    id, tipo, ciudad, region: zona.region, categoria: null, nombre, direccion,
    lat, lng, precioHora: gratis ? 0 : precioHora, precioMin: null, fraccion: null,
    gratis: gratis ? 'Gratis siempre' : null, horario: null,
    verificado: false, fuente: null,
    atributos: { techado: false, ev: false, accesible: false, camaras: false },
    reportado: true, ts,
  };
  lugares.push(ficha);
  if (lugares.length > 5000) lugares = lugares.slice(-5000);   // poda para no crecer infinito
  await guardar();
  return { ok: true, id };
}

// Fichas reportadas de una ciudad (para fusionarlas con el dataset en el server).
export async function lugaresDe(ciudad) {
  await cargar();
  return lugares.filter((l) => l.ciudad === ciudad);
}
// Lista reciente (nuevos primero) para el panel de moderación.
export async function lugaresRecientes(n = 80) {
  await cargar();
  return lugares.slice(-n).reverse().map((l) => ({
    id: l.id, nombre: l.nombre, ciudad: l.ciudad, direccion: l.direccion,
    lat: l.lat, lng: l.lng, gratis: l.precioHora === 0, precioHora: l.precioHora, ts: l.ts,
  }));
}
// Total acumulado (contador del panel admin / monitoreo de persistencia).
export async function contarLugares() {
  await cargar();
  return lugares.length;
}
// Elimina un lugar reportado por id (moderación). Devuelve true si borró algo.
export async function eliminarLugar(id) {
  await cargar();
  const antes = lugares.length;
  lugares = lugares.filter((l) => l.id !== id);
  if (lugares.length === antes) return false;
  await guardar();
  return true;
}
