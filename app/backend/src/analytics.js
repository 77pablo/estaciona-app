// ============================================================================
// Estaciona — Analítica de uso ANÓNIMA y agregada (privacy-friendly)
// ----------------------------------------------------------------------------
// Solo CONTEOS: cuántas veces ocurre cada evento (abrir app, buscar, ver
// detalle, reportar…), por día y por ciudad. NO guarda IP, NI cookies, NI nada
// que identifique a una persona. Pensado para saber si la app se usa y mejorarla.
//
// Persistencia: env ANALYTICS_PATH (volumen Railway) o archivo local. Para no
// golpear el disco en cada evento, se acumula en memoria y se vuelca cada pocos
// segundos (se puede perder algún conteo si el proceso muere justo antes; es
// aceptable para estadística).
// ============================================================================

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = process.env.ANALYTICS_PATH || join(__dirname, '..', 'analytics.json');
let _dirOk = false, _avisoFallo = false;

// Eventos permitidos (lista blanca: ignora cualquier otro que llegue).
const EVENTOS = new Set([
  'pageview',        // se abrió la app
  'search',          // se usó el buscador
  'ciudad',          // se cambió de ciudad
  'detalle',         // se abrió el detalle de un lugar
  'comollegar',      // se tocó "Cómo llegar"
  'reporte_lugar',   // se reportó un lugar nuevo
  'reporte_precio',  // se reportó un precio
  'comentario',      // se dejó un comentario
  'foto',            // se subió una foto
  'voto',            // se votó disponibilidad
]);
const MAX_DIAS = 120;       // poda: conserva ~4 meses de historial diario
const MAX_CIUDADES = 600;   // tope defensivo del mapa por ciudad

let datos = null;           // { total, porEvento, porDia, porCiudad }
let cargaPromise = null;
let _cola = Promise.resolve();
let _dirty = false, _flushTimer = null;

function vacio() { return { total: 0, porEvento: {}, porDia: {}, porCiudad: {} }; }

function cargar() {
  return cargaPromise ??= readFile(FILE, 'utf8')
    .then((txt) => { datos = JSON.parse(txt) || vacio(); })
    .catch(() => { datos = vacio(); });
}

// Fecha local de Chile (YYYY-MM-DD) sin depender de la zona del servidor.
function hoyChile() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return p; // en-CA da "YYYY-MM-DD"
}

// Vuelca a disco como mucho cada ~4 s (escritura atómica .tmp + rename, serializada).
function programarFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => { _flushTimer = null; if (_dirty) { _dirty = false; guardar(); } }, 4000);
  if (_flushTimer.unref) _flushTimer.unref();   // no mantener vivo el proceso solo por esto
}
function guardar() {
  _cola = _cola.then(escribir, escribir);
  return _cola;
}
async function escribir() {
  const tmp = `${FILE}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  const txt = JSON.stringify(datos);
  try {
    if (!_dirOk) { await mkdir(dirname(FILE), { recursive: true }); _dirOk = true; }
    await writeFile(tmp, txt); await rename(tmp, FILE);
  } catch (e) {
    if (!_avisoFallo) { _avisoFallo = true; console.warn(`[analytics] no pude escribir en ${FILE}: ${e.message} — las estadísticas NO persisten`); }
  }
}

// Registra un evento anónimo. `ciudad` es opcional (solo para conteo por ciudad).
export async function registrarEvento(tipo, ciudad) {
  await cargar();
  if (!EVENTOS.has(tipo)) return;
  const dia = hoyChile();
  datos.total++;
  datos.porEvento[tipo] = (datos.porEvento[tipo] || 0) + 1;
  (datos.porDia[dia] || (datos.porDia[dia] = {}))[tipo] = (datos.porDia[dia][tipo] || 0) + 1;
  if (ciudad && typeof ciudad === 'string') {
    const c = ciudad.slice(0, 60);
    if (datos.porCiudad[c] != null || Object.keys(datos.porCiudad).length < MAX_CIUDADES) {
      datos.porCiudad[c] = (datos.porCiudad[c] || 0) + 1;
    }
  }
  // Poda de días viejos.
  const dias = Object.keys(datos.porDia).sort();
  if (dias.length > MAX_DIAS) for (const d of dias.slice(0, dias.length - MAX_DIAS)) delete datos.porDia[d];
  _dirty = true; programarFlush();
}

// Resumen para el panel /admin: totales, hoy, últimos 7 días y top ciudades.
export async function resumenAnalytics() {
  await cargar();
  const hoy = hoyChile();
  const dias = Object.keys(datos.porDia).sort();
  const ultimos7 = dias.slice(-7);
  const sum = (obj) => Object.values(obj || {}).reduce((a, b) => a + b, 0);
  const hoyTotal = sum(datos.porDia[hoy]);
  const semanaTotal = ultimos7.reduce((a, d) => a + sum(datos.porDia[d]), 0);
  const topCiudades = Object.entries(datos.porCiudad).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const serie = ultimos7.map((d) => ({ dia: d, total: sum(datos.porDia[d]), detalle: datos.porDia[d] }));
  return {
    total: datos.total,
    porEvento: datos.porEvento,
    hoy: { dia: hoy, total: hoyTotal, detalle: datos.porDia[hoy] || {} },
    semana: semanaTotal,
    ultimos7: serie,
    topCiudades,
  };
}
