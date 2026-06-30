// ============================================================================
// Estaciona — Frontend (vanilla JS, sin frameworks)
// ----------------------------------------------------------------------------
// Cubre las 12 funciones de la v1 + lote de arreglos para acercarlo a público:
// geolocalización real, buscador, filtros completos, estados de carga/error,
// lista que no "salta", detalle que se actualiza, alarma con permiso en su
// momento, y aviso de tarifa referencial.
// Favoritos y "mi auto" se guardan en el teléfono (localStorage), sin cuenta.
// ============================================================================

const $ = (s) => document.querySelector(s);
const API = '/api/estacionamientos';

// Antirrebote: agrupa ráfagas de llamadas (p. ej. teclear en el buscador) en una
// sola tras `ms` de calma. Evita re-filtrar la lista y redibujar los pines del
// mapa en cada pulsación. Devuelve la función envuelta (misma firma).
function debounce(fn, ms) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

// Estado en memoria.
let DATA = [];
let CENTRO = { lat: -38.7359, lng: -72.5905, nombre: 'Temuco' };
const CENTRO_DEFAULT = { ...CENTRO };   // copia inmutable de Temuco (ciudad casa); CENTRO sí se sobrescribe por ciudad
let ZONAS = [];                    // ciudades con datos (del backend)
let REGIONES = [];                 // 16 regiones de Chile, orden norte→sur (del backend)
let MAPTILER_KEY = '';             // key de MapTiler (del backend); vacío => tiles OSM
let TOMTOM_KEY = '';               // key de TomTom (del backend); vacío => ETA estimada
let ciudadActual = 'Temuco';       // ciudad que se está mirando ahora
let USER = { ...CENTRO };          // "estás aquí" (Temuco por defecto)
let map = null, markers = {}, meMarker = null;
let markerLayer = null;             // dónde viven los pines: clúster (si hay lib) o el propio mapa
let CLUSTER = false;                // true si leaflet.markercluster cargó (agrupa pines)
let miniMap = null;                 // mini-mapa de la vista "Mi auto"
let selectedId = null;
let watchId = null;                 // seguimiento de ubicación (watchPosition)
let query = '';
let orden = 'cercania';            // orden de la lista: 'cercania' | 'precio'
let cargado = false;
let cargaSeq = 0;                  // contador de cargas: descarta respuestas viejas (carrera)
let sinConexionAvisado = false;    // evita spamear el toast "Sin conexión" cada 6s
let _focoPrevio = null;            // foco previo del detalle, para restaurarlo al cerrarlo
let _focoModal = null;             // foco previo del modal (separado: un modal puede abrirse SOBRE el detalle)
let detalleAbiertoId = null;
let filtros = {
  gratis: false, barato: false, techado: false, abierto: false,
  ev: false, accesible: false, soloPublicos: false, tipo: 'todos', distMax: 0,
};

// Lugares de Favoritos (Casa/Trabajo). Por defecto son sectores de Temuco, pero
// el usuario los puede fijar a su dirección real (se guarda solo en el teléfono).
const LUGARES_DEF = {
  casa: { nombre: 'Casa', lat: -38.7385, lng: -72.6150 },
  trabajo: { nombre: 'Trabajo', lat: -38.7300, lng: -72.5850 },
};
function cargarLugares() {
  try {
    const g = JSON.parse(localStorage.getItem('estaciona_lugares') || 'null') || {};
    return {
      casa: { ...LUGARES_DEF.casa, ...(g.casa || {}) },
      trabajo: { ...LUGARES_DEF.trabajo, ...(g.trabajo || {}) },
    };
  } catch { return { casa: { ...LUGARES_DEF.casa }, trabajo: { ...LUGARES_DEF.trabajo } }; }
}
let LUGARES = cargarLugares();
function guardarLugar(k, lat, lng, etiqueta) {
  LUGARES[k] = { nombre: LUGARES_DEF[k].nombre, lat, lng, etiqueta: etiqueta || null, set: true };
  localStorage.setItem('estaciona_lugares', JSON.stringify(LUGARES));
}

// --- Utilidades -------------------------------------------------------------
const CLP = (n) => n === 0 ? 'Gratis' : '$' + new Intl.NumberFormat('es-CL').format(Math.round(n));
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function haversine(a, b) {
  const R = 6371000, rad = (x) => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
// Escapa texto para insertarlo seguro en innerHTML (datos de OSM/Nominatim).
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

// --- Íconos lineales modernos (trazo fino, heredan el color del texto) -------
const ICONS = {
  parking:'<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M9.5 16.5v-9h3.4a2.7 2.7 0 0 1 0 5.4H9.5"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.1-4.1"/>',
  filters:'<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="10" cy="7" r="2.3" fill="currentColor"/><circle cx="15" cy="12" r="2.3" fill="currentColor"/><circle cx="8" cy="17" r="2.3" fill="currentColor"/>',
  pin:'<path d="M12 21s6.5-5.4 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15.6 12 21 12 21Z"/><circle cx="12" cy="10.5" r="2.3"/>',
  locate:'<circle cx="12" cy="12" r="6.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  refresh:'<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M20.5 4v4.3h-4.3"/>',
  car:'<path d="M5 13l1.4-4.2A2 2 0 0 1 8.3 7.4h7.4a2 2 0 0 1 1.9 1.4L19 13"/><path d="M4 13h16v3.5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1V16H7.5v.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V13Z"/><path d="M7.5 15.6h.01M16.5 15.6h.01"/>',
  truck:'<path d="M14 17.5V6.5a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h1"/><path d="M14 8.5h3.6a1 1 0 0 1 .8.4l2.4 3.1a1 1 0 0 1 .2.6v4a1 1 0 0 1-1 1h-1"/><path d="M9 18.5h5"/><circle cx="7" cy="18.5" r="1.8"/><circle cx="17" cy="18.5" r="1.8"/>',
  walk:'<circle cx="13" cy="4" r="1.7"/><path d="m9 21 2.2-6.5-1.7-1.5V9.5l3.3-1 1.7 3 2.2 1"/><path d="m12.2 14.5-1 6.5"/>',
  starOutline:'<path d="m12 3.5 2.6 5.3 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8-4.3-4.2 5.9-.8L12 3.5Z"/>',
  starFull:'<path d="m12 3.5 2.6 5.3 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8-4.3-4.2 5.9-.8L12 3.5Z" fill="currentColor"/>',
  arrowLeft:'<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
  arrowRight:'<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  share:'<path d="M21 3 3 10.5l7 2.5 2.5 7L21 3Z"/>',
  home:'<path d="m3 11 9-7 9 7"/><path d="M5.5 9.5V20h13V9.5"/>',
  work:'<rect x="3" y="7.5" width="18" height="12.5" rx="2"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/>',
  wallet:'<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10.5h18"/><circle cx="16.5" cy="14.5" r="1.1" fill="currentColor"/>',
  tag:'<path d="M3 3.5h7L21 14.5l-6.5 6.5L3.5 10.5V3.5Z"/><circle cx="7.3" cy="7.3" r="1.3"/>',
  clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  calc:'<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8 7h8"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5.5-5 2 2-5.5 5-2Z"/>',
  camera:'<rect x="3" y="6.5" width="13" height="11" rx="2.5"/><path d="m16 10.5 5-3v9l-5-3"/>',
  zap:'<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8Z"/>',
  access:'<circle cx="12" cy="3.8" r="1.7"/><path d="M5 8.5h14"/><path d="M12 8v6"/><path d="m8 21 4-7 4 7"/>',
  road:'<path d="M7.5 21 9 3M16.5 21 15 3"/><path d="M12 5v2.5M12 11v2.5M12 17v2.5"/>',
  wifiOff:'<path d="M3 8.5a15 15 0 0 1 5-3.1M21 8.5a15 15 0 0 0-7-3.2"/><path d="M6.5 12a10 10 0 0 1 3-1.6M17.5 12a10 10 0 0 0-2-1.1"/><path d="M9.5 15.3a5 5 0 0 1 5 0"/><path d="M12 19h.01"/><path d="m3 3 18 18"/>',
  check:'<path d="M20 6.5 9.5 17 4 11.5"/>',
  edit:'<path d="M12.5 20H21"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"/>',
  cart:'<circle cx="9.5" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M2.5 4H5l2.2 11.5h10L19 7.5H6"/>',
  bulb:'<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.2 11.1c.5.3.7.8.7 1.4V16h5v-.5c0-.6.2-1.1.7-1.4A6 6 0 0 0 12 3Z"/>',
  traffic:'<rect x="8" y="2.5" width="8" height="19" rx="3"/><circle cx="12" cy="7" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="17" r="1.5"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.3a3 3 0 0 1 0 5.7"/><path d="M15.4 20a5.5 5.5 0 0 0-1.5-3.8"/>',
};
// Devuelve un <svg> inline del ícono pedido (hereda color y se alinea al texto).
function ic(name, size = 18) {
  return `<svg class="ic-svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
const walkMin = (m) => Math.max(1, Math.round(m / 80));
// Tráfico ESTIMADO según la hora local (no es tráfico en vivo). Devuelve la
// velocidad urbana promedio y una etiqueta honesta. Hora punta = más lento.
function trafico() {
  const d = new Date(); const h = d.getHours(); const dia = d.getDay();
  if (dia === 0) return { kmh: 32, nivel: 'fluido' };                 // domingo
  if (h < 7 || h >= 22) return { kmh: 35, nivel: 'fluido' };          // noche
  if ((h >= 8 && h <= 9) || (h >= 13 && h <= 14) || (h >= 18 && h <= 19))
    return { kmh: 15, nivel: 'pesado' };                              // hora punta
  if ((h >= 10 && h <= 12) || (h >= 15 && h <= 17) || h === 20 || h === 21)
    return { kmh: 22, nivel: 'medio' };
  return { kmh: 28, nivel: 'medio' };
}
// Tiempo manejando: distancia ajustada por el tráfico estimado de la hora.
const carMin = (m) => Math.max(1, Math.round(m / 1000 / trafico().kmh * 60));
// Etiqueta honesta del nivel de tráfico estimado (color semáforo).
function trafHTML() {
  const t = trafico();
  const c = t.nivel === 'fluido' ? 'var(--green)' : t.nivel === 'medio' ? 'var(--amber)' : 'var(--red)';
  return `<span style="color:${c};font-weight:700">tráfico est. ${t.nivel}</span>`;
}
// ETA REAL con tráfico en vivo (TomTom Routing). Devuelve {min, delayMin} o null.
// Cachea por id para no gastar cuota de más. Cae a la estimación si falla/sin key.
const _etaCache = {};
async function etaReal(p) {
  if (!TOMTOM_KEY) return null;
  if (_etaCache[p.id]) return _etaCache[p.id];
  try {
    const url = `https://api.tomtom.com/routing/1/calculateRoute/${USER.lat},${USER.lng}:${p.lat},${p.lng}/json?key=${TOMTOM_KEY}&traffic=true&travelMode=car`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const s = (await r.json())?.routes?.[0]?.summary;
    if (!s) return null;
    const res = { min: Math.max(1, Math.round(s.travelTimeInSeconds / 60)), delayMin: Math.round((s.trafficDelayInSeconds || 0) / 60) };
    _etaCache[p.id] = res;
    return res;
  } catch { return null; }
}

// "Gratis real" (calle pública sin cobro) vs "gratis solo para clientes" (lote
// de una tienda). Importante para no confundir: que el usuario no maneje a un
// supermercado creyendo que es estacionamiento público gratis.
// Categorías "no públicas" (hospital, colegio, etc.): ícono + etiqueta para
// mostrarlas distinto. Devuelve '' si es estacionamiento público normal.
const CAT_ICON = { Salud: 'access', Colegio: 'home', Estadio: 'starOutline', Municipal: 'home', Camiones: 'truck', Terminal: 'car', Cultura: 'home' };
function catBadge(p) {
  if (!p.categoria) return '';
  const name = CAT_ICON[p.categoria] || 'pin';
  return `<span class="cat-badge">${ic(name, 12)} ${esc(p.categoria)}</span>`;
}
const esGratisClientes = (p) => p.precioHora === 0 && /cliente/i.test(p.gratisInfo || '');
const esGratisReal = (p) => p.precioHora === 0 && !esGratisClientes(p);
// Texto corto para el pin del mapa. "~" marca precio estimado (no verificado).
function precioCorto(p) {
  if (p.gratisAhora || esGratisReal(p)) return 'Gratis';
  if (esGratisClientes(p)) return 'Clientes';
  return (p.verificado ? '' : '~') + CLP(p.precioHora);
}
// HTML del precio para la lista / favoritos (consciente del tipo de "gratis").
// Si NO está verificado, se muestra como estimación ("~$600 aprox.").
function precioHTML(p) {
  if (p.gratisAhora) return '<span class="free">Gratis ahora</span>';
  if (esGratisReal(p)) return '<span class="free">Gratis</span>';
  if (esGratisClientes(p)) return `<span class="free-cli">${ic('cart', 12)} Solo clientes</span>`;
  if (p.verificado) return `<b>${CLP(p.precioHora)}</b><small>/hr</small>`;
  return `<b class="precio-est-num">~${CLP(p.precioHora)}</b><small>est.</small>`;
}

// --- Cálculo de costo realista (descuenta horas gratis y cerradas) ----------
// Extrae el primer rango "HH:MM–HH:MM" de un texto (horario o regla de gratis).
function rangoTexto(txt) {
  const m = (txt || '').match(/(\d{1,2}):\d{2}\D+(\d{1,2}):\d{2}/);
  return m ? { desde: +m[1], hasta: +m[2] } : null;
}
const enRango = (h, r) => r.desde > r.hasta ? (h >= r.desde || h < r.hasta) : (h >= r.desde && h < r.hasta);
// ¿Es gratis a esta hora/día? (siempre / domingos / rango nocturno).
function gratisEnHora(info, hora, dia) {
  const g = info || '';
  if (/siempre/i.test(g)) return true;
  if (/domingo/i.test(g) && dia === 0) return true;
  const r = rangoTexto(g);
  return r ? enRango(hora, r) : false;
}
// ¿Estás dentro de la ventana en que SÍ se cobra (parquímetro / horario)?
function dentroVentanaPago(horario, hora) {
  if (/24h|libre/i.test(horario || '')) return true;
  const r = rangoTexto(horario);
  return r ? enRango(hora, r) : true;
}
// ¿Se paga en esta hora concreta? (no gratis, dentro de ventana, con tarifa).
function pagaEnHora(precioHora, gratisInfo, horario, hora, dia) {
  if (!precioHora) return false;
  if (gratisEnHora(gratisInfo, hora, dia)) return false;
  return dentroVentanaPago(horario, hora);
}
// Costo de estacionar `horas` enteras desde AHORA (cuenta solo horas que se pagan).
function costoEstimado(p, horas) {
  const ahora = new Date();
  let h = ahora.getHours(), dia = ahora.getDay(), pagadas = 0;
  for (let i = 0; i < horas; i++) {
    if (pagaEnHora(p.precioHora, p.gratisInfo, p.horario, h, dia)) pagadas++;
    if (++h >= 24) { h = 0; dia = (dia + 1) % 7; }
  }
  return { total: pagadas * p.precioHora, pagadas, libres: horas - pagadas };
}
// Costo acumulado real del auto guardado (recorre minuto a minuto por tramos de hora).
function costoTranscurrido(a) {
  if (!a.precioHora) return 0;
  let restante = (Date.now() - a.inicio) / 60000;   // minutos
  let cursor = new Date(a.inicio), costo = 0;
  while (restante > 0.01) {
    const min = Math.min(restante, 60 - cursor.getMinutes());
    if (pagaEnHora(a.precioHora, a.gratisInfo, a.horario, cursor.getHours(), cursor.getDay())) {
      costo += a.precioHora * (min / 60);
    }
    restante -= min;
    cursor = new Date(cursor.getTime() + min * 60000);
  }
  return Math.round(costo);
}

// --- Zonas / ciudades de la región ------------------------------------------
// Ciudad de la región más cercana a un punto (para detectar dónde estás).
function zonaMasCercana(pt) {
  let best = null, bd = Infinity;
  for (const z of ZONAS) {
    const d = haversine(pt, z);
    if (d < bd) { bd = d; best = z; }
  }
  return { zona: best, dist: bd };
}
// Llena el selector del header con las ciudades, agrupadas por región (N→S).
function poblarSelectorCiudades() {
  const sel = $('#ciudad-select');
  if (!sel || !ZONAS.length) return;
  // Agrupa las ciudades por región.
  const porRegion = {};
  for (const z of ZONAS) (porRegion[z.region] = porRegion[z.region] || []).push(z);
  // Orden de regiones: el oficial del backend (norte→sur); el resto al final.
  const orden = REGIONES.length ? REGIONES : Object.keys(porRegion);
  const regiones = [...orden, ...Object.keys(porRegion).filter((r) => !orden.includes(r))]
    .filter((r) => porRegion[r]);
  const opt = (z) => `<option value="${esc(z.nombre)}">${esc(z.nombre)} (${z.cantidad})</option>`;
  sel.innerHTML = regiones
    .map((r) => `<optgroup label="${esc(r)}">${porRegion[r].map(opt).join('')}</optgroup>`)
    .join('');
  sel.value = ciudadActual;
  sel.title = `Ciudad: ${ciudadActual}`;   // tooltip con la ciudad completa (por si se trunca)
}
// Ajusta la ciudad actual a la más cercana a un punto (sin mover el mapa).
// Devuelve true si la cambió (el punto está dentro de la región cubierta).
function ciudadPorPunto(pt, maxDist = 40000) {
  const { zona, dist } = zonaMasCercana(pt);
  if (zona && dist < maxDist) {
    ciudadActual = zona.nombre;
    const sel = $('#ciudad-select');
    if (sel) { sel.value = zona.nombre; sel.title = `Ciudad: ${zona.nombre}`; }
    return true;
  }
  return false;
}
// Cambia la ciudad que se está mirando: centra el mapa y filtra la lista.
function cambiarCiudad(nombre, mover = true) {
  const z = ZONAS.find((x) => x.nombre === nombre);
  if (!z) return;
  ciudadActual = nombre;
  const sel = $('#ciudad-select');
  if (sel) { sel.value = nombre; sel.title = `Ciudad: ${nombre}`; }
  if (mover) {
    USER = { lat: z.lat, lng: z.lng };
    if (map) { map.setView([z.lat, z.lng], 15); meMarker?.setLatLng([z.lat, z.lng]); }
  }
  DATA = [];                 // limpia mientras llega la ciudad nueva
  cargar();                  // trae los estacionamientos de esa ciudad
}

// --- localStorage (datos en el teléfono) ------------------------------------
const LS = {
  // Favoritos: se guarda el OBJETO del lugar (no solo el id) para poder mostrarlo
  // aunque estés mirando otra ciudad. Tolera el formato viejo (solo id string).
  getFavs: () => { try { return JSON.parse(localStorage.getItem('estaciona_favs') || '[]'); } catch { return []; } },
  isFav: (id) => LS.getFavs().some((f) => (f.id || f) === id),
  toggleFav: (p) => {
    const id = p.id || p;
    const f = LS.getFavs();
    const i = f.findIndex((x) => (x.id || x) === id);
    if (i >= 0) f.splice(i, 1);
    else f.push({ id, nombre: p.nombre, ciudad: p.ciudad, lat: p.lat, lng: p.lng, precioHora: p.precioHora, gratisInfo: p.gratisInfo, direccion: p.direccion, tipo: p.tipo });
    localStorage.setItem('estaciona_favs', JSON.stringify(f));
    return f.some((x) => (x.id || x) === id);
  },
  getAuto: () => { try { return JSON.parse(localStorage.getItem('estaciona_miauto') || 'null'); } catch { return null; } },
  setAuto: (a) => localStorage.setItem('estaciona_miauto', JSON.stringify(a)),
  clearAuto: () => localStorage.removeItem('estaciona_miauto'),
  // Recordatorios "Avísame": avisos locales para revisar un lugar a cierta hora.
  getRecs: () => { try { return JSON.parse(localStorage.getItem('estaciona_recs') || '[]'); } catch { return []; } },
  setRecs: (r) => localStorage.setItem('estaciona_recs', JSON.stringify(r)),
};

// --- Mapa -------------------------------------------------------------------
// Capa de tiles base. Usa MapTiler (plan con cuota, aguanta tráfico real) si hay
// key; si no, cae a los tiles gratis de OSM (sirve en local / sin configurar).
function baseTileLayer() {
  if (MAPTILER_KEY) {
    return L.tileLayer(
      `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
      {
        maxZoom: 20,
        crossOrigin: true,
        attribution: '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    );
  }
  return osmTileLayer();
}

// Tiles gratis de OpenStreetMap (respaldo y modo sin key).
function osmTileLayer() {
  return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });
}

// --- Capa de TRÁFICO en vivo (TomTom). Overlay de calles verde/amarillo/rojo. ---
let trafficLayer = null;
function toggleTrafico() {
  if (!map || !TOMTOM_KEY) { toast('Tráfico no disponible'); return; }
  const btn = document.querySelector('.leaflet-traffic-btn');
  if (trafficLayer) {                       // apagar
    map.removeLayer(trafficLayer); trafficLayer = null;
    if (btn) btn.classList.remove('on');
    return;
  }
  trafficLayer = L.tileLayer(               // estilo "relative0-dark": calza con el mapa oscuro
    `https://api.tomtom.com/traffic/map/4/tile/flow/relative0-dark/{z}/{x}/{y}.png?key=${TOMTOM_KEY}`,
    { maxZoom: 22, opacity: 0.9, zIndex: 10, className: 'traffic-tiles' },
  );
  let errs = 0;
  trafficLayer.on('tileerror', () => {      // si TomTom no autoriza/falla: se quita y avisa
    if (++errs < 3) return;
    if (trafficLayer) { map.removeLayer(trafficLayer); trafficLayer = null; }
    if (btn) btn.classList.remove('on');
    toast('Tráfico no disponible (activa "Maps API" en TomTom)');
  });
  trafficLayer.addTo(map);
  if (btn) btn.classList.add('on');
  toast('Tráfico en vivo activado 🚦');
}

// Capa satelital híbrida (satélite + nombres de calles) de MapTiler. La clase
// 'sat-tiles' evita que el filtro oscuro invierta las fotos (CSS).
function satTileLayer() {
  return L.tileLayer(
    `https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`,
    {
      maxZoom: 20, crossOrigin: true, className: 'sat-tiles',
      attribution: '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  );
}

// --- Capa del mapa: calle <-> satélite ---
let baseLayer = null;
let mapModo = 'calle';   // 'calle' | 'satelite'
function capaPara(modo) {
  return (modo === 'satelite' && MAPTILER_KEY) ? satTileLayer() : baseTileLayer();
}
function setCapaMapa(modo) {
  if (!map) return;
  mapModo = modo;
  if (baseLayer) map.removeLayer(baseLayer);
  const layer = capaPara(modo);
  layer.addTo(map);
  if (layer.bringToBack) layer.bringToBack();
  baseLayer = layer;
  // Respaldo a OSM si MapTiler falla (solo en vista calle).
  if (MAPTILER_KEY && modo !== 'satelite') {
    let errs = 0;
    layer.on('tileerror', () => {
      if (++errs < 4) return;
      layer.off('tileerror');
      if (baseLayer === layer) { map.removeLayer(layer); const o = osmTileLayer(); o.addTo(map); if (o.bringToBack) o.bringToBack(); baseLayer = o; }
    });
  }
  const btn = document.querySelector('.leaflet-sat-btn');
  if (btn) { btn.innerHTML = ic('layers', 20); btn.title = modo === 'satelite' ? 'Ver calles' : 'Ver satélite'; }
}

// Agrega la capa base a un mapa (usado por el mini-mapa). Si es MapTiler y los
// tiles fallan, cae solo a OSM para que el mapa NUNCA se quede gris.
function addBaseLayer(targetMap) {
  const layer = baseTileLayer().addTo(targetMap);
  if (MAPTILER_KEY) {
    let errs = 0;
    layer.on('tileerror', () => {
      if (++errs < 4) return;            // tolera fallos sueltos de red
      layer.off('tileerror');
      targetMap.removeLayer(layer);
      osmTileLayer().addTo(targetMap);
    });
  }
  return layer;
}

function initMap() {
  if (typeof L === 'undefined') {
    $('#map').innerHTML = '<div class="nomap">El mapa necesita internet.<br>Igual puedes ver la lista.</div>';
    return;
  }
  map = L.map('map', { zoomControl: true, zoomSnap: 0.5, wheelPxPerZoomLevel: 90 }).setView([CENTRO.lat, CENTRO.lng], 16);
  setCapaMapa('calle');

  // Capa de pines: si cargó leaflet.markercluster, se agrupan los pines cercanos
  // (clave en el centro de Temuco, muy denso); si no, caen sueltos sobre el mapa.
  CLUSTER = typeof L.markerClusterGroup === 'function';
  if (CLUSTER) {
    markerLayer = L.markerClusterGroup({
      maxClusterRadius: 46,            // declustering temprano: la ubicación exacta importa
      showCoverageOnHover: false,      // sin polígono al pasar el mouse (más limpio)
      spiderfyOnMaxZoom: true,         // abre en abanico los pines que comparten punto
      removeOutsideVisibleBounds: true,
      chunkedLoading: true,
      iconCreateFunction: clusterIcon,
    });
    map.addLayer(markerLayer);
  } else {
    markerLayer = map;                 // respaldo: pines directos al mapa (comportamiento previo)
  }

  meMarker = L.marker([USER.lat, USER.lng], {
    icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [16, 16] }),
  }).addTo(map);

  // Botón flotante "mi ubicación" sobre el mapa (como Google/Waze).
  const GeoCtrl = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd() {
      const b = L.DomUtil.create('button', 'leaflet-geo-btn');
      b.type = 'button'; b.innerHTML = ic('locate', 20); b.title = 'Mi ubicación';
      b.setAttribute('aria-label', 'Usar mi ubicación');
      L.DomEvent.disableClickPropagation(b);
      L.DomEvent.on(b, 'click', () => usarMiUbicacion());
      return b;
    },
  });
  map.addControl(new GeoCtrl());

  // Botón para alternar vista calle <-> satélite (solo si hay MapTiler).
  if (MAPTILER_KEY) {
    const SatCtrl = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const b = L.DomUtil.create('button', 'leaflet-geo-btn leaflet-sat-btn');
        b.type = 'button'; b.innerHTML = ic('layers', 20); b.title = 'Ver satélite';
        b.setAttribute('aria-label', 'Alternar vista satélite');
        L.DomEvent.disableClickPropagation(b);
        L.DomEvent.on(b, 'click', () => setCapaMapa(mapModo === 'satelite' ? 'calle' : 'satelite'));
        return b;
      },
    });
    map.addControl(new SatCtrl());
  }

  // Botón de tráfico en vivo (solo si hay key de TomTom).
  if (TOMTOM_KEY) {
    const TrafCtrl = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const b = L.DomUtil.create('button', 'leaflet-geo-btn leaflet-traffic-btn');
        b.type = 'button'; b.innerHTML = ic('traffic', 20); b.title = 'Tráfico en vivo';
        b.setAttribute('aria-label', 'Mostrar tráfico en vivo');
        L.DomEvent.disableClickPropagation(b);
        L.DomEvent.on(b, 'click', () => toggleTrafico());
        return b;
      },
    });
    map.addControl(new TrafCtrl());
  }

  // Leyenda del semáforo (qué significan los colores de los pines).
  const LegendCtrl = L.Control.extend({
    options: { position: 'bottomleft' },
    onAdd() {
      const d = L.DomUtil.create('div', 'mapa-leyenda');
      d.innerHTML = '<b class="leyenda-tit">Disponibilidad</b><span><i class="dot verde"></i>Suele haber</span><span><i class="dot amarillo"></i>Puede costar</span><span><i class="dot rojo"></i>Difícil</span>';
      // Plegable en pantallas chicas para no tapar el mapa: toca para abrir/cerrar.
      d.addEventListener('click', () => d.classList.toggle('plegada'));
      return d;
    },
  });
  map.addControl(new LegendCtrl());

  // Al cambiar el zoom: re-renderiza iconos (pines se simplifican si está lejos).
  map.on('zoomend', () => updateMarkers(listaFiltrada()));
  // Al mover el mapa: si el centro se aleja del usuario, ofrece "Buscar en esta zona".
  map.on('moveend', onMapMove);
}

// Muestra/oculta el botón "Buscar en esta zona" según cuánto se alejó el centro.
function onMapMove() {
  if (!map) return;
  const c = map.getCenter();
  const d = haversine({ lat: c.lat, lng: c.lng }, USER);
  const btn = $('#btn-zona');
  if (btn) btn.classList.toggle('show', d > 400);
}

// Ícono de un clúster (grupo de pines). Color = mejor disponibilidad del grupo
// (verde > amarillo > rojo > cerrado): de un vistazo se ve "dónde suele haber".
const NIVEL_RANK = { verde: 3, amarillo: 2, rojo: 1, cerrado: 0 };
function clusterIcon(cluster) {
  let best = 'cerrado';
  for (const m of cluster.getAllChildMarkers()) {
    const n = m.nivelEstaciona || 'cerrado';
    if ((NIVEL_RANK[n] || 0) > (NIVEL_RANK[best] || 0)) best = n;
  }
  const n = cluster.getChildCount();
  const size = n < 10 ? 36 : n < 50 ? 42 : 48;
  return L.divIcon({
    className: '',
    html: `<div class="cluster-est ${best}" style="width:${size}px;height:${size}px">${n}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// HTML del pin de un estacionamiento (con estado "seleccionado").
function iconHtml(p) {
  const nivel = p.disponibilidad.nivel;
  const esSel = p.id === selectedId;
  // Mapa alejado (zoom < 15): simplifica a un punto para no saturar de precios.
  // El pin seleccionado siempre conserva su precio para no perderlo de vista.
  const zoom = map ? map.getZoom() : 16;
  if (zoom < 15 && !esSel) return `<div class="pin-dot ${nivel}"></div>`;
  // Pin "P" circular (estilo parkspot); el seleccionado muestra el precio arriba.
  const precio = esSel ? `<span class="pin-precio">${precioCorto(p)}</span>` : '';
  return `<div class="pin-p ${nivel}${esSel ? ' sel' : ''}">${precio}P</div>`;
}

// Seleccionar = centrar el mapa en el lugar y resaltar su pin.
function panselect(p) {
  if (!map) return;
  const prev = selectedId; selectedId = p.id;
  [prev, p.id].forEach((id) => {
    if (id && markers[id]) {
      const pp = DATA.find((x) => x.id === id);
      if (pp) {
        markers[id].setIcon(L.divIcon({ className: '', html: iconHtml(pp), iconSize: [0, 0] }));
        markers[id].setZIndexOffset(zOffset(pp));
      }
    }
  });
  // Si el pin está escondido dentro de un clúster, acerca para revelarlo (anima
  // el zoom y centra solo). Si no, basta con un paneo suave hasta el lugar.
  const mk = markers[p.id];
  if (CLUSTER && mk && markerLayer.getVisibleParent) {
    const vis = markerLayer.getVisibleParent(mk);
    if (vis && vis !== mk) { markerLayer.zoomToShowLayer(mk, () => {}); return; }
  }
  map.panTo([p.lat, p.lng], { animate: true, duration: 0.45 });
}

// Prioridad visual cuando los pines se solapan (el centro de Temuco es denso):
// el seleccionado va arriba del todo; luego los gratis; y entre los pagados,
// el más barato por encima del más caro.
function zOffset(p) {
  let z = (p.gratisAhora || p.precioHora === 0)
    ? 1500
    : Math.max(0, 1200 - Math.min(p.precioHora, 1200));
  if (p.id === selectedId) z += 5000;
  return Math.round(z);
}

function updateMarkers(lista) {
  if (!map) return;
  const vistos = new Set();
  for (const p of lista) {
    vistos.add(p.id);
    const icon = L.divIcon({ className: '', html: iconHtml(p), iconSize: [0, 0] });
    if (markers[p.id]) {
      markers[p.id].setIcon(icon);
      markers[p.id].nivelEstaciona = p.disponibilidad.nivel;   // para colorear el clúster
    } else {
      const mk = L.marker([p.lat, p.lng], { icon });
      mk.nivelEstaciona = p.disponibilidad.nivel;
      mk.on('click', () => abrirMapCard(p.id));
      markers[p.id] = mk;
      markerLayer.addLayer(mk);                  // al clúster (o al mapa, si no hay lib)
    }
    markers[p.id].setZIndexOffset(zOffset(p));
  }
  for (const id of Object.keys(markers)) {
    if (!vistos.has(id)) { markerLayer.removeLayer(markers[id]); delete markers[id]; }
  }
}

// --- Filtrado + orden -------------------------------------------------------
function listaFiltrada() {
  const q = norm(query);
  return DATA
    .map((p) => ({ ...p, dist: haversine(USER, p) }))
    .filter((p) => {
      // Regional: por defecto solo la ciudad elegida (salvo que se busque por texto).
      if (!q && p.ciudad !== ciudadActual) return false;
      if (q && !(norm(p.nombre).includes(q) || norm(p.direccion).includes(q) || norm(p.ciudad).includes(q))) return false;
      // "Gratis" = gratis de verdad (no los "🛒 solo clientes", que solo lo son con compra).
      if (filtros.gratis && !(esGratisReal(p) || p.gratisAhora)) return false;
      if (filtros.barato && !(p.precioHora < 1000)) return false;
      if (filtros.techado && !p.atributos.techado) return false;
      if (filtros.ev && !p.atributos.ev) return false;
      if (filtros.accesible && !p.atributos.accesible) return false;
      if (filtros.abierto && !p.abierto) return false;
      if (filtros.soloPublicos && p.categoria) return false;   // oculta hospitales/colegios/etc.
      if (filtros.tipo !== 'todos' && p.tipo !== filtros.tipo) return false;
      if (filtros.distMax > 0 && p.dist > filtros.distMax) return false;
      return true;
    })
    .sort((a, b) => {
      if (orden === 'precio') {
        // Precio efectivo: gratis (o gratis ahora) cuenta como 0. Empate → cercanía.
        const pa = (a.gratisAhora || a.precioHora === 0) ? 0 : a.precioHora;
        const pb = (b.gratisAhora || b.precioHora === 0) ? 0 : b.precioHora;
        if (pa !== pb) return pa - pb;
      }
      return a.dist - b.dist;
    });
}

// Cuenta filtros activos para el badge del botón ⚙️.
function contarFiltros() {
  let n = 0;
  for (const k of ['gratis', 'barato', 'techado', 'abierto', 'ev', 'accesible', 'soloPublicos']) if (filtros[k]) n++;
  if (filtros.tipo !== 'todos') n++;
  if (filtros.distMax > 0) n++;
  return n;
}
function actualizarBadgeFiltros() {
  const b = $('#filtros-badge');
  if (!b) return;
  const n = contarFiltros();
  b.textContent = n;
  b.hidden = n === 0;
}

// --- Lista ------------------------------------------------------------------
function renderLista() {
  const lista = listaFiltrada();
  updateMarkers(lista);
  const dondeTxt = query ? 'en tu búsqueda' : `en ${ciudadActual}`;
  $('#sheet-count').textContent = `${lista.length} estacionamiento${lista.length === 1 ? '' : 's'} ${dondeTxt}`;

  const sheet = document.querySelector('.sheet');
  const sc = sheet ? sheet.scrollTop : 0;   // preservar scroll (no "saltar")

  if (lista.length === 0) {
    const hayFiltros = contarFiltros() > 0;
    const hayQuery = !!query.trim();
    // Tres casos honestos: (1) búsqueda activa sin match → ofrecer buscarla como
    // dirección en el mapa; (2) filtros sin resultado → limpiar filtros; (3) la
    // ciudad simplemente no tiene datos cargados todavía.
    if (hayQuery) {
      $('#lista').innerHTML = `<div class="empty-big">
        <span class="em">${ic('search', 44)}</span>
        <div class="empty-tit">Sin coincidencias para “${esc(query)}”</div>
        <p>¿Es una dirección o lugar? Búscalo directamente en el mapa.</p>
        <button class="btn btn-primary" style="margin-top:14px" onclick="buscarComoDireccion()">${ic('pin', 16)} Buscar “${esc(query)}” en el mapa</button>
      </div>`;
    } else if (hayFiltros) {
      $('#lista').innerHTML = `<div class="empty-big">
        <span class="em">${ic('search', 44)}</span>
        <div class="empty-tit">Sin resultados con esos filtros</div>
        <p>Ningún estacionamiento cumple los filtros activos. Prueba aflojando alguno.</p>
        <button class="btn btn-primary" style="margin-top:14px" onclick="limpiarFiltros()">${ic('filters', 16)} Limpiar filtros</button>
      </div>`;
    } else {
      $('#lista').innerHTML = `<div class="empty-big">
        <span class="em">${ic('pin', 44)}</span>
        <div class="empty-tit">Aún no tenemos datos de ${esc(ciudadActual)}</div>
        <p>Todavía no cargamos estacionamientos en esta ciudad. Vamos sumando zonas de a poco — prueba con otra ciudad desde el selector de arriba.</p>
      </div>`;
    }
    return;
  }
  // Tráfico estimado de la hora (uno solo para toda la lista): colorea el tiempo en auto.
  const traf = trafico();
  const trafColor = traf.nivel === 'fluido' ? 'var(--green)' : traf.nivel === 'medio' ? 'var(--amber)' : 'var(--red)';
  $('#lista').innerHTML = lista.map((p) => {
    const d = p.disponibilidad, nivel = d.nivel;
    // Disponibilidad = estimación honesta (sin número falso de "cupos en vivo").
    const estadoTxt = nivel === 'cerrado' ? 'Cerrado'
      : nivel === 'verde' ? 'Disponible'
      : nivel === 'amarillo' ? 'Casi lleno' : 'Completo';
    // La barra es un VISUAL del semáforo (no un conteo inventado de cupos).
    const barPct = nivel === 'verde' ? 82 : nivel === 'amarillo' ? 45 : nivel === 'rojo' ? 15 : 6;
    // Confirmaciones REALES de la comunidad (cupo confirmado en las últimas 3 h).
    // Check verde — NO una estrella dorada (eso parecería un rating inventado).
    const votos = p.votos ? `<span class="card-rate" title="${p.votos.up} confirmaron cupo (últimas 3 h)">${ic('check', 12)} ${p.votos.up}</span>` : '';
    return `
      <div class="card ${nivel}${p.id === selectedId ? ' sel' : ''}" data-id="${p.id}" role="button" tabindex="0" aria-label="${esc(p.nombre)}, ver detalle">
        <div class="card-main">
          <div class="card-info">
            <div class="nm"><span class="estado-dot ${nivel}" aria-hidden="true"></span><span class="nm-txt">${esc(p.nombre)}</span>${LS.isFav(p.id) ? ic('starFull', 12) : ''}${catBadge(p)}</div>
            <div class="addr">${esc(p.direccion || p.ciudad || '')}</div>
          </div>
          <div class="price">${precioHTML(p)}</div>
        </div>
        <div class="card-meta">
          <span>${ic('walk', 12)} ${walkMin(p.dist)} min</span>
          <span class="car-eta" style="color:${trafColor}" title="En auto · tráfico est. ${traf.nivel}">${ic('car', 12)} ${carMin(p.dist)} min</span>
          <span>${Math.round(p.dist)} m</span>
          ${votos}
          <span class="badge-disp ${nivel}">${estadoTxt}</span>
        </div>
        <div class="disp-bar" aria-hidden="true"><i class="disp-fill ${nivel}" style="width:${barPct}%"></i></div>
        <div class="card-expand">
          ${featuresHTML(p)}
          <div class="card-actions">
            <button class="btn-reservar" onclick="event.stopPropagation();llevame('${p.id}')">${ic('compass', 16)} Cómo llegar</button>
            <button class="card-vermas" onclick="event.stopPropagation();avisarme('${p.id}')">${ic('clock', 15)} Avísame</button>
          </div>
          <button class="card-detalle" onclick="event.stopPropagation();openDetalle('${p.id}')">Ver detalle completo</button>
        </div>
      </div>`;
  }).join('');

  $('#lista').querySelectorAll('.card').forEach((c) => {
    const sel = () => seleccionarCard(c.dataset.id, c);
    c.addEventListener('click', sel);
    // Las tarjetas son botones a efectos de teclado: Enter/Espacio las expanden.
    c.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sel(); }
    });
  });
  if (sheet) sheet.scrollTop = sc;          // restaurar scroll
}

// Chips de servicios REALES del lugar (para la tarjeta expandida).
function featuresHTML(p) {
  const a = p.atributos || {};
  const f = [];
  if (/24h|libre/i.test(p.horario || '')) f.push('24/7');
  if (a.techado) f.push(`${ic('home', 13)} Techado`);
  if (a.ev) f.push(`${ic('zap', 13)} Carga EV`);
  if (a.accesible) f.push(`${ic('access', 13)} Accesible`);
  if (a.camaras) f.push(`${ic('camera', 13)} Cámaras`);
  return f.length ? `<div class="feat-chips">${f.map((x) => `<span class="feat-chip">${x}</span>`).join('')}</div>` : '';
}

// Tocar una tarjeta la expande (estilo parkspot): muestra features + acciones y
// resalta su pin en el mapa. Tocarla de nuevo la colapsa. El detalle completo
// (votos, fotos, comunidad) sigue disponible con el botón "Ver detalle".
function seleccionarCard(id, card) {
  const yaSel = card.classList.contains('sel');
  $('#lista').querySelectorAll('.card.sel').forEach((c) => c.classList.remove('sel'));
  if (yaSel) return;
  card.classList.add('sel');
  card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  const p = DATA.find((x) => x.id === id);
  if (p) panselect(p);   // centra el mapa y resalta el pin
  cerrarMapCard();       // evita tener la card flotante y la tarjeta expandida a la vez
}

// --- Card flotante sobre el mapa (al tocar un pin, estilo parkspot) ---------
// Precio grande para la card flotante (consciente de gratis/estimado/verificado).
function precioGrande(p) {
  if (p.gratisAhora || esGratisReal(p)) return `<b class="free">Gratis</b>`;
  if (esGratisClientes(p)) return `<b class="free-cli">${ic('cart', 13)} Solo clientes</b>`;
  return `<b>${p.verificado ? '' : '~'}${CLP(p.precioHora)}</b><small>por hora${p.verificado ? '' : ' · est.'}</small>`;
}
function abrirMapCard(id) {
  const p = DATA.find((x) => x.id === id);
  if (!p) return;
  panselect(p);                                                  // centra el mapa + resalta el pin
  $('#lista').querySelectorAll('.card.sel').forEach((c) => c.classList.remove('sel'));  // colapsa la lista
  const d = p.disponibilidad, nivel = d.nivel;
  const estadoTxt = nivel === 'cerrado' ? 'Cerrado'
    : nivel === 'verde' ? 'Disponible' : nivel === 'amarillo' ? 'Casi lleno' : 'Completo';
  const barPct = nivel === 'verde' ? 82 : nivel === 'amarillo' ? 45 : nivel === 'rojo' ? 15 : 6;
  const tipoTxt = p.tipo === 'calle' ? 'En la calle' : (p.atributos?.techado ? 'Techado' : 'Privado');
  const dist = Math.round(haversine(USER, p));   // DATA no trae dist (se calcula en la lista)
  const votos = p.votos ? `${ic('check', 12)} ${p.votos.up} confirman · ` : '';
  const el = $('#mapcard');
  el.innerHTML = `
    <button class="mapcard-x" onclick="cerrarMapCard()" aria-label="Cerrar">${ic('x', 16)}</button>
    <div class="mapcard-nm"><span class="estado-dot ${nivel}" aria-hidden="true"></span><span class="nm-txt">${esc(p.nombre)}</span></div>
    <div class="mapcard-addr">${esc(p.direccion || p.ciudad || '')}</div>
    <div class="mapcard-body">
      <div class="mapcard-precio">${precioGrande(p)}</div>
      <div class="mapcard-disp">
        <div class="mapcard-disp-top"><span>Disponibilidad</span><span class="badge-disp ${nivel}">${estadoTxt}</span></div>
        <div class="disp-bar"><i class="disp-fill ${nivel}" style="width:${barPct}%"></i></div>
        <div class="mapcard-meta">${votos}${dist} m · ${tipoTxt}</div>
      </div>
    </div>
    <div class="mapcard-actions">
      <button class="btn-reservar" onclick="llevame('${p.id}')">${ic('compass', 16)} Cómo llegar</button>
      <button class="card-vermas" onclick="avisarme('${p.id}')">${ic('clock', 15)} Avísame</button>
    </div>`;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('show'));
}
window.cerrarMapCard = function () {
  const el = $('#mapcard');
  if (el) { el.classList.remove('show'); el.hidden = true; }
};

// --- Detalle ----------------------------------------------------------------
function lineaDisponibilidad(p) {
  const d = p.disponibilidad, nivel = d.nivel;
  const etiqueta = nivel === 'cerrado' ? 'Cerrado ahora' : d.label;
  // La etiqueta va en una píldora con el color del semáforo (lectura de un vistazo);
  // el "· disponibilidad estimada" queda como caption honesto, fuera de la píldora.
  const sub = nivel === 'cerrado' ? '' : ' <small>· disponibilidad estimada</small>';
  return `<span class="disp-pill ${nivel}"><span class="dot ${nivel}"></span>${etiqueta}</span>${sub}`;
}

function openDetalle(id) {
  const p = DATA.find((x) => x.id === id);
  if (!p) return;
  detalleAbiertoId = id;
  panselect(p);                 // centrar mapa + resaltar el pin del lugar

  const attrs = [];
  if (p.atributos.techado) attrs.push(ic('home', 14) + ' Techado');
  if (p.atributos.ev) attrs.push(ic('zap', 14) + ' Cargador EV');
  if (p.atributos.accesible) attrs.push(ic('access', 14) + ' Accesible');
  if (p.atributos.camaras) attrs.push(ic('camera', 14) + ' Con cámaras');
  if (attrs.length === 0) attrs.push('Sin servicios extra');

  const precioLinea = esGratisClientes(p)
    ? 'Gratis para clientes (con compra)'
    : p.precioHora === 0
      ? 'Gratis'
      : p.verificado
        ? (p.precioMin
            ? `${CLP(p.precioMin)} / min · equivale a ≈${CLP(p.precioHora)}/hora${p.fuente ? ` <span class="precio-fuente">fuente: ${esc(p.fuente)}</span>` : ''}`
            : `${CLP(p.precioHora)} / hora`)
        : `~${CLP(p.precioHora)} / hora <span class="precio-est">estimado · sin verificar</span>`;
  const fav = LS.isFav(p.id);

  $('#detalle').innerHTML = `
    <div class="det-top">
      <button onclick="cerrarDetalle()" title="Volver" aria-label="Volver">${ic('arrowLeft', 20)}</button>
      <div class="t">${esc(p.nombre)}</div>
      <button class="det-fav${fav ? ' on' : ''}" onclick="toggleFavDetalle('${p.id}')" title="Guardar" aria-label="${fav ? 'Quitar de favoritos' : 'Guardar en favoritos'}">${fav ? ic('starFull', 20) : ic('starOutline', 20)}</button>
      <button onclick="compartir('${p.id}')" title="Compartir" aria-label="Compartir">${ic('share', 19)}</button>
    </div>
    <div class="det-body">
      <div class="det-hero"><span class="hero-ic">${ic(p.tipo === 'calle' ? 'road' : 'parking', 30)}</span><span class="hero-nm">${esc(p.nombre)}</span></div>
      <div class="det-status" id="det-status-line">${lineaDisponibilidad(p)}</div>
      ${p.categoria ? `<div class="aviso-cli">${catBadge(p)} Es un estacionamiento de <b>${esc(p.categoria.toLowerCase())}</b> — puede ser de uso restringido, no público general.</div>` : ''}
      <div class="det-row precio-row"><span class="k">${ic('wallet')}</span><span class="precio-val">${precioLinea}</span></div>
      ${esGratisClientes(p)
        ? `<div class="aviso-cli">${ic('cart', 16)} <b>Gratis solo para clientes</b> — válido con compra en el local, no es estacionamiento público.</div>`
        : p.gratisInfo ? `<div class="det-row"><span class="k">${ic('tag')}</span><span>${esc(p.gratisInfo)}</span></div>` : ''}
      <div class="det-row"><span class="k">${ic('clock')}</span><span>${esc(p.horario)} · ${p.abierto ? '<b style="color:var(--green)">Abierto ahora</b>' : '<b style="color:var(--red)">Cerrado</b>'}</span></div>
      <div class="det-row"><span class="k">${ic('pin')}</span><span>${esc(p.direccion)} · ${Math.round(haversine(USER, p))} m · ${ic('walk', 13)} ${walkMin(haversine(USER, p))} min caminando</span></div>
      <div class="det-row"><span class="k">${ic('car')}</span><span id="det-eta">${carMin(haversine(USER, p))} min en auto · ${trafHTML()}</span></div>
      <div class="attrs">${attrs.map((a) => `<span class="attr">${a}</span>`).join('')}</div>
      ${p.precioHora > 0 ? `
      <div class="calc">
        <h4>${ic('calc', 15)} ¿Cuánto pagaré?</h4>
        Salgo en
        <select id="calc-horas">
          ${[1, 2, 3, 4, 6, 8].map((h) => `<option value="${h}">${h} hora${h > 1 ? 's' : ''}</option>`).join('')}
        </select>
        <div class="total" id="calc-total">${CLP(p.precioHora)}</div>
        <div class="calc-nota" id="calc-nota"></div>
      </div>` : ''}
      <div class="det-row"><span class="k">${ic('users')}</span>
        <span>¿Encontraste cupo aquí?</span>
        <span class="thumbs" style="margin-left:auto;display:flex;gap:6px">
          <button class="vote-si" onclick="confirmarCupo('${p.id}',true)" aria-label="Sí, había cupo">${ic('check', 16)} Sí</button>
          <button class="vote-no" onclick="confirmarCupo('${p.id}',false)" aria-label="No había cupo">${ic('x', 16)} No</button>
        </span></div>
      ${p.votos ? `<div class="votos-info">${ic('users', 14)} Últimas 3 h: <b>${p.votos.up}</b> dijeron que había cupo · <b>${p.votos.down}</b> que no</div>` : ''}
      <p class="disclaimer">${ic('bulb', 15)} ${p.verificado ? 'Precio confirmado.' : '<b>Precio estimado, sin verificar.</b> Es una referencia generada automáticamente — confirma la tarifa real en el lugar.'}</p>

      <div class="fotos-sec">
        <h4>${ic('camera', 15)} Fotos de la gente</h4>
        <div id="fotos-galeria" class="fotos-galeria"></div>
        <button class="btn btn-second" onclick="subirFoto('${p.id}')">${ic('camera', 16)} Subir una foto</button>
      </div>

      <div class="comunidad">
        <h4>${ic('users', 15)} La comunidad</h4>
        ${p.comunidad?.precioReportado ? `<div class="com-precio">${ic('wallet', 14)} La gente reporta <b>~${CLP(p.comunidad.precioReportado)}/hr</b> · ${p.comunidad.nPrecios} reporte${p.comunidad.nPrecios > 1 ? 's' : ''}</div>` : ''}
        <div id="com-lista" class="com-lista"></div>
        <div class="com-acciones">
          <button class="btn btn-second" onclick="reportarPrecio('${p.id}')">${ic('wallet', 16)} Reportar precio</button>
          <button class="btn btn-second" onclick="comentar('${p.id}')">${ic('edit', 16)} Comentar</button>
        </div>
      </div>
    </div>
    <div class="det-actions">
      <button class="btn btn-primary" onclick="llevame('${p.id}')">${ic('compass', 17)} Llévame</button>
      <div class="det-actions-row">
        <button class="btn btn-second" onclick="avisarme('${p.id}')">${ic('clock', 16)} Avísame</button>
        <button class="btn btn-second" onclick="abrirEstacione('${p.id}')">${ic('car', 16)} Estacioné aquí</button>
      </div>
    </div>`;

  const sel = $('#calc-horas');
  if (sel) {
    const upd = () => {
      const { total, libres } = costoEstimado(p, Number(sel.value));
      $('#calc-total').textContent = total === 0 ? 'Gratis' : CLP(total);
      const nota = $('#calc-nota');
      if (nota) nota.textContent = libres > 0 ? `Incluye ${libres} h sin cobro (gratis o cerrado).` : '';
    };
    sel.addEventListener('change', upd); upd();
  }
  // Reemplaza la ETA estimada por la REAL con tráfico (TomTom), si está disponible.
  etaReal(p).then((e) => {
    const el = $('#det-eta');
    if (el && e && detalleAbiertoId === p.id) {
      el.innerHTML = `${e.min} min en auto · <b style="color:var(--green)">tráfico en vivo</b>${e.delayMin > 0 ? ` · +${e.delayMin} min por congestión` : ''}`;
    }
  });

  cargarComentarios(p.id);                    // trae los comentarios de la gente
  cargarFotos(p.id);                          // trae las fotos de la gente

  const det = $('#detalle');
  det.classList.add('open');
  _focoPrevio = document.activeElement;       // recuerda dónde estaba el foco
  det.setAttribute('tabindex', '-1'); det.focus();   // mueve el foco al diálogo (lector de pantalla)
}

// --- Aportes de la comunidad (precios + comentarios) ------------------------
// Fecha relativa clara: "recién", "hace 5 min", "hace 3 h", "ayer", "hace 4 días",
// "hace 2 semanas", "hace 3 meses"… para que cada comentario se sienta vigente.
function fechaCorta(ts) {
  const s = (Date.now() - ts) / 1000;
  if (!Number.isFinite(s) || s < 90) return 'recién';
  const m = s / 60;        if (m < 60) return `hace ${Math.floor(m)} min`;
  const h = m / 60;        if (h < 24) return `hace ${Math.floor(h)} h`;
  const d = h / 24;        if (d < 2) return 'ayer';
  if (d < 7) return `hace ${Math.floor(d)} días`;
  const sem = Math.floor(d / 7); if (d < 30) return sem <= 1 ? 'hace 1 semana' : `hace ${sem} semanas`;
  const mes = Math.floor(d / 30); if (d < 365) return mes <= 1 ? 'hace 1 mes' : `hace ${mes} meses`;
  const ano = Math.floor(d / 365); return ano <= 1 ? 'hace 1 año' : `hace ${ano} años`;
}
// Fecha absoluta legible (es-CL) para el tooltip del comentario.
function fechaAbs(ts) {
  try { return new Date(ts).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return ''; }
}
const _comSkel = '<div class="com-skel skel"></div><div class="com-skel skel"></div>';
async function cargarComentarios(id) {
  const el = $('#com-lista');
  if (el && detalleAbiertoId === id) el.innerHTML = _comSkel;   // mientras carga, esqueleto
  try {
    const r = await fetch(`/api/aportes?id=${encodeURIComponent(id)}`);
    if (!el || detalleAbiertoId !== id) return;
    if (!r.ok) { el.innerHTML = '<div class="com-vacio">No pudimos cargar los comentarios.</div>'; return; }
    const j = await r.json();
    if (detalleAbiertoId !== id) return;
    el.innerHTML = j.comentarios?.length
      ? j.comentarios.map((c) => `<div class="com-item"><span class="com-texto">${esc(c.texto)}</span><span class="com-fecha" title="${esc(fechaAbs(c.ts))}">${fechaCorta(c.ts)}</span></div>`).join('')
      : `<div class="com-vacio">${ic('edit', 16)}<span>Aún no hay comentarios. ¡Sé el primero en contar cómo es!</span></div>`;
  } catch {
    if (el && detalleAbiertoId === id) el.innerHTML = '<div class="com-vacio">Sin conexión: no pudimos cargar los comentarios.</div>';
  }
}
window.reportarPrecio = (id) => {
  const p = DATA.find((x) => x.id === id);
  // Contexto honesto: lo que estimamos hoy y lo que ya reportó la gente.
  const ctx = p && !p.gratisAhora && p.precioHora > 0 && !p.verificado
    ? `<p class="ap-ctx">Hoy estimamos <b>~${CLP(p.precioHora)}/hr</b>${p.comunidad?.precioReportado ? ` · la gente reporta <b>~${CLP(p.comunidad.precioReportado)}/hr</b>` : ''}. Tu dato real ayuda a afinarlo.</p>`
    : '';
  $('#modal').innerHTML = `
    <h3>${ic('wallet', 18)} Reportar precio real</h3>
    <p>¿Cuánto cobran por hora aquí?</p>
    ${ctx}
    <div class="precio-field"><span class="precio-pesos">$</span>
      <input id="ap-precio" type="number" inputmode="numeric" min="1" max="20000" placeholder="1000" aria-label="Precio por hora en pesos" />
      <span class="precio-hora">/ hora</span></div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
      <button class="btn btn-primary" onclick="enviarPrecio('${id}')">Enviar precio</button>
      <button class="btn btn-ghost" onclick="cerrarModal()">Cancelar</button>
    </div>`;
  abrirModal();
  setTimeout(() => {
    const i = $('#ap-precio');
    if (i) { i.focus(); i.addEventListener('keydown', (e) => { if (e.key === 'Enter') enviarPrecio(id); }); }
  }, 60);
};
window.enviarPrecio = (id) => {
  const v = Math.round(Number($('#ap-precio')?.value));
  if (!Number.isFinite(v) || v <= 0) { toast('Pon un precio válido'); return; }
  if (v > 20000) { toast('Ese precio parece muy alto (máx $20.000/hr)'); return; }
  enviarAporte(id, { precio: v });
};
window.comentar = (id) => {
  $('#modal').innerHTML = `
    <h3>${ic('edit', 18)} Agregar comentario</h3>
    <p>Cuenta cómo es: acceso, seguridad, el servicio…</p>
    <input id="ap-texto" type="text" maxlength="280" placeholder="Ej: amplio, seguro, fácil de entrar" />
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
      <button class="btn btn-primary" onclick="enviarComentario('${id}')">Publicar</button>
      <button class="btn btn-ghost" onclick="cerrarModal()">Cancelar</button>
    </div>`;
  abrirModal();
  setTimeout(() => {
    const i = $('#ap-texto');
    if (i) { i.focus(); i.addEventListener('keydown', (e) => { if (e.key === 'Enter') enviarComentario(id); }); }
  }, 60);
};
window.enviarComentario = (id) => {
  const t = ($('#ap-texto')?.value || '').trim();
  if (!t) { toast('Escribe algo'); return; }
  enviarAporte(id, { texto: t });
};
async function enviarAporte(id, body) {
  try {
    const r = await fetch('/api/aporte', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
    const j = await r.json();
    if (j.ok) { cerrarModal(); toast('¡Gracias por tu aporte!'); cargar(); if (detalleAbiertoId === id) openDetalle(id); }
    else toast('No se pudo enviar el aporte');
  } catch { toast('Sin conexión'); }
}

// --- Fotos de la gente ------------------------------------------------------
const _fotoSkel = '<div class="foto-skel skel"></div><div class="foto-skel skel"></div><div class="foto-skel skel"></div>';
async function cargarFotos(id) {
  const el = $('#fotos-galeria');
  if (el && detalleAbiertoId === id) el.innerHTML = _fotoSkel;   // mientras carga, esqueleto
  try {
    const r = await fetch(`/api/fotos?id=${encodeURIComponent(id)}`);
    if (!el || detalleAbiertoId !== id) return;
    if (!r.ok) { el.innerHTML = '<div class="fotos-vacio">No pudimos cargar las fotos.</div>'; return; }
    const { fotos } = await r.json();
    if (detalleAbiertoId !== id) return;
    // Las imágenes rotas se ocultan solas (onerror) para no dejar huecos feos.
    el.innerHTML = fotos?.length
      ? fotos.map((u, i) => `<a class="foto-thumb" href="${esc(u)}" target="_blank" rel="noopener" aria-label="Ver foto ${i + 1} de ${fotos.length}"><img src="${esc(u)}" loading="lazy" decoding="async" alt="Foto del estacionamiento aportada por la comunidad" onerror="this.closest('.foto-thumb').remove()" /></a>`).join('')
      : `<div class="fotos-vacio">${ic('camera', 16)}<span>Aún no hay fotos. ¡Sube la primera!</span></div>`;
  } catch {
    if (el && detalleAbiertoId === id) el.innerHTML = '<div class="fotos-vacio">Sin conexión: no pudimos cargar las fotos.</div>';
  }
}
// Comprime la imagen en el navegador (máx 1000px, JPEG) para que suba liviana.
function comprimirImagen(file, max = 1000, q = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      if (w > max || h > max) { const r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', q));
    };
    img.onerror = reject;
    img.src = url;
  });
}
// --- Moderación automática de imágenes (en el navegador) --------------------
// Antes de subir, una IA liviana (nsfwjs sobre TensorFlow.js) revisa la foto EN
// EL CELULAR. Si parece contenido para adultos (desnudos/porno), se bloquea y NO
// se sube: la imagen nunca sale del teléfono. La librería trae el modelo
// incrustado (~2.7MB) y se baja una sola vez (queda en caché) la 1ª vez que
// alguien sube una foto, para no penalizar la carga normal de la app.
const TFJS_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
const NSFW_URL = 'https://cdn.jsdelivr.net/npm/nsfwjs@4.3.0/dist/browser/nsfwjs.min.js';
let _modeloNSFW = null;            // promesa cacheada del modelo

function cargarScript(src) {
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = ok; s.onerror = () => fail(new Error('no cargó ' + src));
    document.head.appendChild(s);
  });
}
function modeloNSFW() {
  return _modeloNSFW ??= (async () => {
    if (!window.tf) await cargarScript(TFJS_URL);
    if (!window.nsfwjs) await cargarScript(NSFW_URL);
    return window.nsfwjs.load();      // usa el modelo incrustado en la librería
  })();
}
// true si la imagen parece contenido para adultos. Si la IA no carga (sin red o
// CDN bloqueado), devuelve false: preferimos dejar subir antes que romper la
// función para todos (el caso normal — fotos de estacionamientos — pasa igual).
async function fotoInapropiada(dataUrl) {
  try {
    const modelo = await modeloNSFW();
    const img = new Image();
    await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = dataUrl; });
    const pred = await modelo.classify(img);
    const prob = (clase) => pred.find((p) => p.className === clase)?.probability || 0;
    return (prob('Porn') + prob('Hentai') > 0.55) || prob('Sexy') > 0.8;
  } catch { return false; }
}

let _subiendoFoto = false;          // evita subir dos fotos a la vez
window.subirFoto = (id) => {
  if (_subiendoFoto) { toast('Espera, todavía estamos subiendo tu foto…'); return; }
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const file = inp.files?.[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast('Eso no es una imagen'); return; }
    _subiendoFoto = true;
    try {
      // Feedback paso a paso: cada toast refresca el aviso para que la revisión NSFW
      // (que puede tardar al bajar el modelo la 1ª vez) no deje al usuario a ciegas.
      toast('Preparando la foto…');
      const dataUrl = await comprimirImagen(file).catch(() => null);
      if (!dataUrl) { toast('No se pudo procesar la imagen'); return; }
      toast('Revisando la foto…');
      if (await fotoInapropiada(dataUrl)) {
        toast('🚫 Esa foto parece contenido para adultos. No se subió ni salió de tu teléfono.');
        return;
      }
      toast('Subiendo foto…');
      const r = await fetch('/api/foto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, dataUrl }) });
      const j = await r.json();
      if (j.ok) { toast('¡Foto subida! Gracias 📷'); cargarFotos(id); }
      else if (j.motivo) toast('🚫 Foto bloqueada (' + j.motivo + '). No se subió.');
      else toast('No se pudo subir (muy pesada o formato no válido)');
    } catch { toast('Sin conexión'); }
    finally { _subiendoFoto = false; }
  };
  inp.click();
};
window.cerrarDetalle = () => {
  detalleAbiertoId = null;
  // Limpiar selección y devolver el pin a su estilo normal.
  const prev = selectedId; selectedId = null;
  if (prev && markers[prev]) {
    const pp = DATA.find((x) => x.id === prev);
    if (pp) {
      markers[prev].setIcon(L.divIcon({ className: '', html: iconHtml(pp), iconSize: [0, 0] }));
      markers[prev].setZIndexOffset(zOffset(pp));
    }
  }
  $('#detalle').classList.remove('open');
  if (_focoPrevio?.focus) _focoPrevio.focus();    // devuelve el foco a donde estaba
};
window.toggleFavDetalle = (id) => { const p = DATA.find((x) => x.id === id); if (p) LS.toggleFav(p); openDetalle(id); renderLista(); };
window.confirmarCupo = (id, ok) => {
  toast(ok ? '¡Gracias! Confirmado 👍' : 'Gracias, lo anotamos 👎');
  fetch('/api/voto', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ok }),
  }).then(() => cargar()).catch(() => {});   // recarga para reflejar el conteo nuevo
};

// Actualiza solo la línea de disponibilidad si el detalle está abierto.
function refrescarDetalle() {
  if (!detalleAbiertoId) return;
  const p = DATA.find((x) => x.id === detalleAbiertoId);
  const el = $('#det-status-line');
  if (p && el) el.innerHTML = lineaDisponibilidad(p);
}

// --- Llévame / Compartir ----------------------------------------------------
let _rutaDest = null;
window.llevame = (id) => {
  const auto = LS.getAuto();
  const p = DATA.find((x) => x.id === id) || LUGARES[id] || (auto && auto.id === id ? auto : null);
  if (!p) return;
  _rutaDest = p;
  $('#modal').innerHTML = `
    <h3>${ic('compass', 18)} ¿Con qué app te llevo?</h3>
    <p>${esc(p.nombre || 'Tu auto')}${p.direccion ? ' · ' + esc(p.direccion) : ''}</p>
    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-primary" onclick="irRuta('google')">${ic('compass', 17)} Google Maps</button>
      <button class="btn btn-second" onclick="irRuta('waze')">${ic('car', 17)} Waze</button>
      <button class="btn btn-ghost" onclick="cerrarModal()">Cancelar</button>
    </div>`;
  abrirModal();
};
window.irRuta = (app) => {
  const p = _rutaDest;
  if (!p) return;
  const url = app === 'waze'
    ? `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`
    : `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;
  window.open(url, '_blank');
  cerrarModal();
};
// Copia texto al portapapeles con fallback para contextos sin Clipboard API.
// Devuelve una promesa que resuelve true si se logró copiar.
async function copiarTexto(texto) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(texto); return true; }
  } catch (_) { /* sigue al fallback de abajo */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = texto; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, texto.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (_) { return false; }
}
window.compartir = (id) => {
  // Mismo criterio que "Llévame": el lugar puede venir de la lista, de Casa/Trabajo o del auto guardado.
  const auto = LS.getAuto();
  const p = DATA.find((x) => x.id === id) || LUGARES[id] || (auto && auto.id === id ? auto : null);
  if (!p) return;
  const mapsUrl = `https://www.google.com/maps?q=${p.lat},${p.lng}`;
  const texto = `📍 ${p.nombre || 'Estacionamiento'}${p.direccion ? ' · ' + p.direccion : ''}\nUbicación: ${mapsUrl}`;
  const copiar = () => copiarTexto(texto).then((ok) =>
    toast(ok ? 'Enlace copiado 📋' : 'No pude copiar; mantén presionado el link'));
  if (navigator.share) {
    navigator.share({ title: 'Estaciona', text: texto, url: mapsUrl }).catch((e) => {
      if (e && e.name === 'AbortError') return;   // el usuario canceló: no hacemos nada
      copiar();                                    // cualquier otro fallo: caemos a copiar
    });
    return;
  }
  copiar();
};

// --- Estacioné aquí + alarma anti-multa -------------------------------------
let _estacionePend = null, _alarmaSel = null;
window.abrirEstacione = (id) => {
  const p = DATA.find((x) => x.id === id);
  if (!p) return;
  _estacionePend = p; _alarmaSel = 60;   // por defecto: 1 hora (lo más común), editable
  // Si el navegador ya bloqueó las notificaciones, lo decimos con honestidad.
  const bloqueada = 'Notification' in window && Notification.permission === 'denied';
  $('#modal').innerHTML = `
    <h3>${ic('car', 18)} Guardar mi estacionamiento</h3>
    <p>${esc(p.nombre)} · ${esc(p.direccion)}</p>
    <p style="margin-bottom:8px"><b>${ic('clock', 15)} Alarma anti-multa</b> — ¿te aviso en…?</p>
    <div class="opts" id="alarma-opts">
      <button data-min="30">30 min</button>
      <button data-min="60" class="on">1 hora</button>
      <button data-min="90">1,5 h</button>
      <button data-min="120">2 horas</button>
      <button data-min="0">Sin alarma</button>
    </div>
    ${bloqueada ? `<p class="alarma-aviso">${ic('bulb', 13)} Tu navegador bloqueó las notificaciones, pero igual te avisaré dentro de la app.</p>` : ''}
    <button class="btn btn-primary" onclick="guardarEstacione()">Listo</button>
    <button class="btn btn-ghost" onclick="cerrarModal()">Cancelar</button>`;
  $('#alarma-opts').querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      $('#alarma-opts').querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on'); _alarmaSel = Number(b.dataset.min);
    }));
  abrirModal();
};
window.guardarEstacione = () => {
  const p = _estacionePend, min = _alarmaSel || 0;
  // Inteligencia: si el lugar está muy cerca de Casa/Trabajo, no es "tu auto".
  for (const k of ['casa', 'trabajo']) {
    const l = LUGARES[k];
    if (haversine(l, p) < 150) {
      cerrarModal(); cerrarDetalle();
      toast(`Estás en ${l.nombre}, no marqué tu auto`);
      return;
    }
  }
  LS.setAuto({
    id: p.id, nombre: p.nombre, direccion: p.direccion, lat: p.lat, lng: p.lng,
    precioHora: p.precioHora, gratisInfo: p.gratisInfo, horario: p.horario, inicio: Date.now(),
    alarmaTs: min > 0 ? Date.now() + min * 60000 : null, alarmaSonó: false,
  });
  cerrarModal(); cerrarDetalle(); irA('miauto');
  if (min > 0) avisarAlarmaPuesta(min);
  else toast('Guardado ✓');
};
// Formato corto y en es-CL: "30 min", "1 h", "1,5 h", "2 h".
function fmtMin(min) {
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1).replace('.', ',')} h`;
}
// Pide permiso de notificación SOLO ahora (gesto del usuario, con contexto) y
// confirma con un mensaje honesto según el navegador conceda o no el permiso.
function avisarAlarmaPuesta(min) {
  const ok = `Alarma puesta para ${fmtMin(min)} ✓`;
  if (!('Notification' in window)) { toast(ok); return; }
  if (Notification.permission === 'granted') { toast(ok); return; }
  if (Notification.permission === 'denied') { toast('Alarma puesta; te avisaré dentro de la app'); return; }
  Notification.requestPermission()
    .then((perm) => toast(perm === 'granted' ? ok : 'Alarma puesta; te avisaré dentro de la app'))
    .catch(() => toast(ok));
}

// --- Mi auto ----------------------------------------------------------------
// Destruye la instancia del mini-mapa (evita duplicados al re-entrar/re-render).
function destruirMiniMapa() {
  if (miniMap) { miniMap.remove(); miniMap = null; }
}
// Crea el mini-mapa con el pin del auto. Degrada a nada si Leaflet no está.
function crearMiniMapa(a) {
  const el = $('#mini-map');
  if (!el) return;
  if (typeof L === 'undefined') { el.style.display = 'none'; return; }
  miniMap = L.map(el, { zoomControl: false, attributionControl: false, dragging: true, scrollWheelZoom: false })
    .setView([a.lat, a.lng], 16);
  addBaseLayer(miniMap);
  L.marker([a.lat, a.lng], {
    icon: L.divIcon({ className: '', html: `<div class="pin verde">${ic('car', 13)}</div>`, iconSize: [0, 0] }),
  }).addTo(miniMap);
  setTimeout(() => miniMap && miniMap.invalidateSize(), 60);
}

// Estructura de la vista (se construye al entrar o al cambiar el auto guardado).
function renderMiAuto() {
  const a = LS.getAuto(), v = $('#view-miauto');
  destruirMiniMapa();                 // limpia instancia previa antes de recrear
  if (!a) {
    v.innerHTML = `<div class="simple"><div class="empty-big">
      <span class="em">${ic('car', 46)}</span>
      <div class="empty-tit">Aún no estás estacionado</div>
      <p>Cuando dejes el auto, abre un lugar y toca <b>"Estacioné aquí"</b>. Te guardo dónde quedó, con cronómetro y costo estimado.</p>
      <button class="btn btn-primary" style="margin-top:18px" onclick="irA('buscar')">${ic('search', 16)} Buscar dónde estacionar</button>
    </div></div>`;
    return;
  }
  v.innerHTML = `<div class="simple">
    <h2>${ic('car', 22)} Mi auto</h2>
    <div class="miauto-card">
      <div class="ma-loc">
        <span class="ma-loc-ic">${ic('pin', 18)}</span>
        <div class="ma-loc-txt">
          <div class="lbl">Está en</div>
          <div class="big" style="font-size:20px">${esc(a.nombre)}</div>
          <div class="ma-dir">${esc(a.direccion)}</div>
        </div>
      </div>
      <div class="ma-stats">
        <div class="ma-stat">
          <div class="lbl">Llevas <span class="ma-live" title="En vivo" aria-hidden="true"></span></div>
          <div class="big" id="ma-tiempo">—</div>
        </div>
        <div class="ma-stat">
          <div class="lbl">Costo estimado</div>
          <div class="cost" id="ma-costo">—</div>
        </div>
      </div>
      <div class="ma-foot">
        <div class="ma-line" id="ma-alarma">—</div>
        <div class="ma-line" id="ma-eta">—</div>
      </div>
      ${a.precioHora ? `<div class="ma-nota">${ic('bulb', 13)} El costo es una estimación (descuenta horas gratis/cerradas). Confirma la tarifa en el lugar.</div>` : ''}
    </div>
    <div id="mini-map" class="mini-map" aria-label="Mapa con la ubicación de tu auto"></div>
    <div class="ma-acciones">
      <button class="btn btn-primary" onclick="llevame('${a.id}')">${ic('compass', 17)} Volver a mi auto</button>
      <button class="btn btn-second" onclick="compartir('${a.id}')">${ic('share', 16)} Compartir ubicación</button>
      <button class="btn btn-ghost" onclick="terminarAuto()">${ic('check', 16)} Terminar</button>
    </div></div>`;
  crearMiniMapa(a);
  actualizarMiAutoVivo();             // rellena tiempo/costo/alarma/ETA
}

// Actualización "en vivo" (cada segundo): solo refresca cifras, no el mapa.
function actualizarMiAutoVivo() {
  const a = LS.getAuto();
  if (!a || !$('#ma-tiempo')) return;
  const mins = Math.floor((Date.now() - a.inicio) / 60000);
  const hh = Math.floor(mins / 60), mm = mins % 60;
  const costo = costoTranscurrido(a);
  let alarmaTxt = 'Sin alarma', alarmaVencida = false;
  if (a.alarmaTs) {
    const rest = Math.round((a.alarmaTs - Date.now()) / 60000);
    const hora = new Date(a.alarmaTs).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    if (rest > 0) alarmaTxt = `Alarma en ${rest} min · ${hora}`;
    else { alarmaTxt = 'Alarma cumplida'; alarmaVencida = true; }
  }
  const distVuelta = haversine(USER, a);   // ETA caminando de vuelta (~80 m/min)
  const set = (id, txt) => { const e = $(id); if (e) e.textContent = txt; };
  const setHtml = (id, html) => { const e = $(id); if (e) e.innerHTML = html; };
  set('#ma-tiempo', `${hh}h ${mm}min`);
  set('#ma-costo', !a.precioHora ? 'Gratis' : costo === 0 ? 'Gratis ahora' : CLP(costo));
  setHtml('#ma-alarma', `${ic('clock', 14)} ${alarmaTxt}`);
  $('#ma-alarma')?.classList.toggle('urgente', alarmaVencida);   // resalta cuando ya venció
  setHtml('#ma-eta', `${ic('walk', 14)} A ${walkMin(distVuelta)} min caminando (${Math.round(distVuelta)} m)`);
}
window.terminarAuto = () => { LS.clearAuto(); renderMiAuto(); toast('¡Listo, buen viaje! 🚗'); };

// --- Favoritos --------------------------------------------------------------
function renderFavoritos() {
  // Usa el objeto guardado; si es formato viejo (id string), lo busca en la ciudad actual.
  const favs = LS.getFavs().map((f) => (typeof f === 'string' ? DATA.find((p) => p.id === f) : f)).filter(Boolean);
  $('#view-favoritos').innerHTML = `<div class="simple">
    <h2>${ic('starFull', 22)} Favoritos</h2>
    ${filaLugar('casa', ic('home', 20))}
    ${filaLugar('trabajo', ic('work', 20))}
    <h2 style="font-size:14px;color:var(--muted);margin:16px 0 8px">Lugares guardados</h2>
    ${favs.length ? favs.map((p) => `
      <div class="fav-item" data-id="${p.id}"><span class="ic">${ic(p.tipo === 'calle' ? 'road' : 'parking', 21)}</span>
        <div style="flex:1;min-width:0"><div class="nm">${esc(p.nombre)}</div>
        <div class="sub">${precioHTML(p)}${p.ciudad ? ' · ' + esc(p.ciudad) : ''} · ${esc(p.direccion)}</div></div>
        <span class="fav-go" aria-hidden="true">${ic('arrowRight', 16)}</span></div>
    `).join('') : `<div class="empty-big" style="padding:28px 20px">
      <span class="em">${ic('starOutline', 40)}</span>
      <div class="empty-tit">Aún no guardas lugares</div>
      <p>Toca la ${ic('starOutline', 14)} de un estacionamiento para guardarlo aquí y volver rápido.</p>
    </div>`}
  </div>`;
  $('#view-favoritos').querySelectorAll('.fav-item[data-id]').forEach((el) =>
    el.addEventListener('click', () => irAFav(el.dataset.id)));
}
// Tocar un favorito: si es de otra ciudad, cambia a esa ciudad; si es de la
// actual, abre su detalle directamente.
window.irAFav = (id) => {
  const f = LS.getFavs().find((x) => (x.id || x) === id);
  if (f && f.ciudad && f.ciudad !== ciudadActual) {
    irA('buscar');
    cambiarCiudad(f.ciudad, true);
    toast(`Mostrando ${f.ciudad}`);
    return;
  }
  irA('buscar');
  openDetalle(id);
};
window.irLugar = (k) => {
  const l = LUGARES[k];
  USER = { lat: l.lat, lng: l.lng }; irA('buscar');
  ciudadPorPunto(USER);                 // ajusta la ciudad a la del lugar guardado
  if (map) { map.setView([l.lat, l.lng], 15); meMarker?.setLatLng([l.lat, l.lng]); }
  cargar(); toast(`Mostrando cerca de ${LUGARES_DEF[k].nombre}`);
};

// Fila de Casa/Trabajo en Favoritos: tocar el texto = ver cerca; ✏️ = fijarla.
function filaLugar(k, iconHtml) {
  const l = LUGARES[k];
  const nom = LUGARES_DEF[k].nombre;
  const fijada = !!l.set;
  const sub = fijada
    ? `${esc(l.etiqueta || 'Ubicación fijada')} · ver cerca`
    : 'Sin fijar · usa el lápiz para poner tu dirección';
  return `<div class="fav-item lugar${fijada ? ' fijada' : ''}">
    <div class="lugar-main" onclick="irLugar('${k}')"><span class="ic">${iconHtml}</span>
      <div style="min-width:0"><div class="nm">${nom}${fijada ? '' : ' <span class="lugar-tag">Sin fijar</span>'}</div><div class="sub">${sub}</div></div></div>
    <button class="lugar-edit" onclick="editarLugar('${k}')" aria-label="${fijada ? 'Editar' : 'Fijar'} ${nom}" title="${fijada ? 'Editar' : 'Fijar'} ${nom}">${ic('edit', 16)}</button>
  </div>`;
}

// Modal para fijar un lugar: por dirección (Nominatim) o por ubicación actual.
let _lugarEdit = null;
window.editarLugar = (k) => {
  _lugarEdit = k;
  const nom = LUGARES_DEF[k].nombre;
  $('#modal').innerHTML = `
    <h3>${ic('pin', 18)} Fijar ${nom}</h3>
    <p>¿Dónde queda tu ${nom.toLowerCase()}? Se guarda solo en este teléfono.</p>
    <input id="lugar-dir" type="text" placeholder="Escribe la dirección o lugar…" autocomplete="off" aria-label="Dirección de ${nom}" />
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
      <button class="btn btn-primary" onclick="fijarLugarDireccion()">${ic('search', 17)} Buscar esta dirección</button>
      <button class="btn btn-second" onclick="fijarLugarAqui()">${ic('locate', 17)} Usar mi ubicación actual</button>
      <button class="btn btn-ghost" onclick="cerrarModal()">Cancelar</button>
    </div>`;
  abrirModal();
  setTimeout(() => $('#lugar-dir')?.focus(), 60);
};
window.fijarLugarAqui = () => {
  const usar = (lat, lng) => { guardarLugar(_lugarEdit, lat, lng, 'Mi ubicación'); finLugar(); };
  if (!navigator.geolocation) { usar(USER.lat, USER.lng); return; }
  toast('Buscando tu ubicación…');
  navigator.geolocation.getCurrentPosition(
    (pos) => usar(pos.coords.latitude, pos.coords.longitude),
    () => usar(USER.lat, USER.lng),
    { enableHighAccuracy: true, timeout: 8000 });
};
window.fijarLugarDireccion = async () => {
  const q = ($('#lugar-dir')?.value || '').trim();
  if (!q) { toast('Escribe una dirección'); return; }
  toast('Buscando dirección…');
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=cl&limit=1&accept-language=es`;
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const arr = await r.json();
    if (!arr.length) { toast('No encontré esa dirección'); return; }
    guardarLugar(_lugarEdit, parseFloat(arr[0].lat), parseFloat(arr[0].lon), (arr[0].display_name || q).split(',')[0]);
    finLugar();
  } catch { toast('No se pudo buscar la dirección'); }
};
function finLugar() { cerrarModal(); renderFavoritos(); toast(`✓ ${LUGARES_DEF[_lugarEdit].nombre} guardada`); }

// --- Geolocalización real ---------------------------------------------------
function usarMiUbicacion() {
  if (!navigator.geolocation) { toast('Tu dispositivo no permite ubicación'); return; }
  toast('Buscando tu ubicación…');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const { zona, dist } = zonaMasCercana(me);
      if (!zona || dist > 30000) {       // a >30 km de cualquier ciudad con datos
        toast(`Aún no cubrimos bien tu zona — te muestro ${CENTRO_DEFAULT.nombre}`);
        cambiarCiudad(CENTRO_DEFAULT.nombre, true);
        return;
      }
      USER = me;
      ciudadPorPunto(me);                 // ciudad = la más cercana
      if (map) { map.setView([me.lat, me.lng], 15); meMarker?.setLatLng([me.lat, me.lng]); }
      toast(`📍 Estás en ${zona.nombre}`);
      iniciarSeguimiento();               // el punto azul te sigue mientras te mueves
      cargar();                           // carga los estacionamientos de tu ciudad
    },
    () => toast('No pudimos obtener tu ubicación'),
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// El punto azul "yo" sigue tu movimiento (solo tras activar la ubicación).
function iniciarSeguimiento() {
  if (watchId !== null || !navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (zonaMasCercana(me).dist > 80000) return;  // claramente fuera de la región
      USER = me;
      meMarker?.setLatLng([me.lat, me.lng]);        // mueve el punto, sin recentrar
    },
    () => {},                                         // permisos/errores en silencio
    { enableHighAccuracy: true, maximumAge: 5000 }
  );
}

// --- Estado visible del buscador (X para limpiar + spinner "buscando…") ------
// Muestra/oculta la "X" de limpiar según haya texto (y nunca durante una búsqueda).
function actualizarBotonLimpiar() {
  const btn = $('#search-clear'), inp = $('#search');
  if (!btn || !inp) return;
  btn.hidden = buscando || !inp.value;
}
// Limpia el buscador y vuelve a mostrar la ciudad actual.
function limpiarBusqueda() {
  const inp = $('#search');
  query = '';
  if (inp) { inp.value = ''; inp.focus(); }
  actualizarBotonLimpiar();
  renderLista();
}
// Pone/quita el estado "buscando…": spinner girando en vez de la X.
let buscando = false;
function setBuscando(on) {
  buscando = on;
  const bar = document.querySelector('.searchbar');
  const spin = $('#search-spin'), inp = $('#search');
  if (bar) bar.classList.toggle('is-searching', on);
  if (spin) spin.hidden = !on;
  if (inp) inp.setAttribute('aria-busy', on ? 'true' : 'false');
  actualizarBotonLimpiar();
}

// --- Buscar dirección/lugar (geocodificación con Nominatim de OpenStreetMap) -
async function geocodificar(texto) {
  const q = texto.trim();
  if (!q) { renderLista(); return; }
  setBuscando(true);
  toast('Buscando “' + q + '”…');
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=cl&limit=1&accept-language=es`;
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('http ' + r.status);
    const arr = await r.json();
    if (!arr.length) { toast('No encontré ese lugar — filtro la lista'); renderLista(); return; }
    const lat = parseFloat(arr[0].lat), lng = parseFloat(arr[0].lon);
    USER = { lat, lng };
    ciudadPorPunto(USER);                 // salta a la ciudad más cercana
    query = ''; $('#search').value = '';  // limpia la búsqueda para ver esa ciudad
    if (map) { map.setView([lat, lng], 15); meMarker?.setLatLng([lat, lng]); }
    cargar();
    toast('📍 ' + (arr[0].display_name || q).split(',')[0]);
  } catch {
    // Degrada con gracia: si no hay internet/falla, queda el filtro de lista.
    toast('No se pudo buscar la dirección — filtro la lista');
    renderLista();
  } finally {
    setBuscando(false);                   // quita el spinner y recalcula la "X"
  }
}
window.buscarComoDireccion = () => geocodificar($('#search')?.value || query);

// --- Panel de filtros -------------------------------------------------------
// Formato del rótulo de distancia: metros bajo 1 km, km (es-CL) sobre 1 km.
function distLabel(m) {
  if (!m) return 'sin límite';
  return m >= 1000 ? (m / 1000).toLocaleString('es-CL') + ' km' : m + ' m';
}
function abrirFiltros() {
  const f = filtros;
  const chip = (on) => on ? 'on' : '';
  const press = (on) => on ? 'true' : 'false';
  $('#modal').innerHTML = `
    <h3>Filtros</h3>
    <p>Elige qué estacionamientos ver. El botón ${ic('filters', 13)} muestra cuántos tienes activos.</p>

    <div class="f-group">
      <p class="f-label" id="f-tipo-lbl">Tipo</p>
      <div class="opts" id="f-tipo" role="group" aria-labelledby="f-tipo-lbl">
        <button type="button" data-v="todos" class="${chip(f.tipo === 'todos')}" aria-pressed="${press(f.tipo === 'todos')}">Todos</button>
        <button type="button" data-v="privado" class="${chip(f.tipo === 'privado')}" aria-pressed="${press(f.tipo === 'privado')}">${ic('parking', 14)} Privado</button>
        <button type="button" data-v="calle" class="${chip(f.tipo === 'calle')}" aria-pressed="${press(f.tipo === 'calle')}">${ic('road', 14)} En la calle</button>
      </div>
      <p class="f-hint">Privado: recinto o edificio. En la calle: cupo o parquímetro en la vía.</p>
    </div>

    <div class="f-group">
      <p class="f-label" id="f-precio-lbl">Precio</p>
      <div class="opts" id="f-precio" role="group" aria-labelledby="f-precio-lbl">
        <button type="button" data-k="gratis" class="${chip(f.gratis)}" aria-pressed="${press(f.gratis)}">${ic('tag', 14)} Gratis</button>
        <button type="button" data-k="barato" class="${chip(f.barato)}" aria-pressed="${press(f.barato)}">${ic('wallet', 14)} Barato</button>
      </div>
      <p class="f-hint">"Barato": menos de $1.000 por hora.</p>
    </div>

    <div class="f-group">
      <p class="f-label" id="f-serv-lbl">Servicios</p>
      <div class="opts" id="f-serv" role="group" aria-labelledby="f-serv-lbl">
        <button type="button" data-k="techado" class="${chip(f.techado)}" aria-pressed="${press(f.techado)}">${ic('home', 14)} Techado</button>
        <button type="button" data-k="ev" class="${chip(f.ev)}" aria-pressed="${press(f.ev)}">${ic('zap', 14)} Cargador EV</button>
        <button type="button" data-k="accesible" class="${chip(f.accesible)}" aria-pressed="${press(f.accesible)}">${ic('access', 14)} Accesible</button>
      </div>
    </div>

    <div class="f-group">
      <p class="f-label" id="f-otros-lbl">Otros</p>
      <div class="opts" id="f-otros" role="group" aria-labelledby="f-otros-lbl">
        <button type="button" data-k="abierto" class="${chip(f.abierto)}" aria-pressed="${press(f.abierto)}">${ic('clock', 14)} Abierto ahora</button>
        <button type="button" data-k="soloPublicos" class="${chip(f.soloPublicos)}" aria-pressed="${press(f.soloPublicos)}">${ic('check', 14)} Solo públicos</button>
      </div>
      <p class="f-hint">"Solo públicos" oculta hospitales, colegios y otros de uso restringido.</p>
    </div>

    <div class="f-group">
      <label class="f-label" for="f-dist">Distancia máxima: <b id="f-dist-lbl">${distLabel(f.distMax)}</b></label>
      <input id="f-dist" type="range" min="0" max="2000" step="100" value="${f.distMax}"
             aria-label="Distancia máxima en metros" aria-describedby="f-dist-lbl" />
      <div class="f-range-ends" aria-hidden="true"><span>Sin límite</span><span>2 km</span></div>
    </div>

    <div class="f-acciones">
      <button class="btn btn-ghost" style="flex:1" onclick="limpiarFiltros()">Limpiar</button>
      <button class="btn btn-primary" style="flex:2" onclick="aplicarFiltros()">Aplicar</button>
    </div>`;
  $('#f-tipo').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    $('#f-tipo').querySelectorAll('button').forEach((x) => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
    b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); filtros.tipo = b.dataset.v;
  }));
  // Toggles de servicios/precio/otros: cualquier botón con data-k en el panel.
  $('#modal').querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => {
    filtros[b.dataset.k] = !filtros[b.dataset.k];
    b.classList.toggle('on', filtros[b.dataset.k]);
    b.setAttribute('aria-pressed', filtros[b.dataset.k] ? 'true' : 'false');
  }));
  $('#f-dist').addEventListener('input', (e) => {
    filtros.distMax = Number(e.target.value);
    $('#f-dist-lbl').textContent = distLabel(filtros.distMax);
  });
  abrirModal();
}
window.aplicarFiltros = () => { cerrarModal(); syncChips(); actualizarBadgeFiltros(); renderLista(); };
window.limpiarFiltros = () => {
  filtros = { gratis: false, barato: false, techado: false, abierto: false, ev: false, accesible: false, soloPublicos: false, tipo: 'todos', distMax: 0 };
  cerrarModal(); syncChips(); actualizarBadgeFiltros(); renderLista(); toast('Filtros limpiados');
};
function syncChips() {
  $('#chips').querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', filtros[c.dataset.f]));
}

// --- Modales ----------------------------------------------------------------
function abrirModal() {
  _focoModal = document.activeElement;   // foco propio: NO pisa el del detalle si el modal se abre encima
  $('#modal-bg').classList.add('open');
  const m = $('#modal'); m.setAttribute('tabindex', '-1'); m.focus();
}
window.cerrarModal = () => {
  $('#modal-bg').classList.remove('open');
  if (_focoModal?.focus) _focoModal.focus();
};

// Diálogo abierto en este momento (modal de filtros/aportes tiene prioridad
// sobre el overlay de detalle). Devuelve el contenedor o null.
function dialogoAbierto() {
  if ($('#onboard').classList.contains('show')) return $('#onboard');
  if ($('#modal-bg').classList.contains('open')) return $('#modal');
  if ($('#detalle').classList.contains('open')) return $('#detalle');
  return null;
}
// Elementos enfocables y visibles dentro de un contenedor.
function enfocables(c) {
  const sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return [...c.querySelectorAll(sel)].filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement);
}

// Teclado en diálogos: Escape cierra; Tab queda atrapado dentro del diálogo
// (no se escapa al fondo) para que el lector de pantalla y el teclado no se
// pierdan detrás del overlay.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if ($('#onboard').classList.contains('show')) window.cerrarBienvenida();
    else if ($('#modal-bg').classList.contains('open')) window.cerrarModal();
    else if ($('#detalle').classList.contains('open')) window.cerrarDetalle();
    return;
  }
  if (e.key !== 'Tab') return;
  const cont = dialogoAbierto();
  if (!cont) return;
  const f = enfocables(cont);
  if (!f.length) { e.preventDefault(); cont.focus(); return; }
  const primero = f[0], ultimo = f[f.length - 1];
  const act = document.activeElement;
  // Si el foco salió del diálogo (o está en el contenedor) lo traemos de vuelta.
  if (!cont.contains(act)) { e.preventDefault(); primero.focus(); return; }
  if (e.shiftKey && act === primero) { e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && act === ultimo) { e.preventDefault(); primero.focus(); }
});

// --- Navegación entre vistas ------------------------------------------------
function irA(view) {
  cerrarMapCard();                              // oculta la card flotante del mapa al cambiar de vista
  if (view !== 'miauto') destruirMiniMapa();   // libera el mini-mapa al salir
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  $('#view-' + view).classList.add('active');
  document.querySelectorAll('.bottomnav .nav').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  if (view === 'buscar' && map) setTimeout(() => map.invalidateSize(), 50);
  if (view === 'miauto') renderMiAuto();
  if (view === 'favoritos') renderFavoritos();
}

// --- Toast + banner alarma --------------------------------------------------
let _toastT = null;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(_toastT); _toastT = setTimeout(() => t.classList.remove('show'), 2200);
}
function chequearAlarma() {
  const a = LS.getAuto();
  if (a && a.alarmaTs && !a.alarmaSonó && Date.now() >= a.alarmaTs) {
    a.alarmaSonó = true; LS.setAuto(a);
    const b = $('#banner');
    b.innerHTML = `<span>${ic('clock', 16)} ¡Revisa tu estacionamiento! (${esc(a.nombre)})</span><button onclick="this.parentElement.classList.remove('show')">OK</button>`;
    b.classList.add('show', 'urgent');   // alarma anti-multa = urgente (borde rojo)
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Estaciona ⏰', { body: `Revisa tu estacionamiento en ${a.nombre}` });
    }
  }
}

// --- "Avísame": recordatorio local para revisar un lugar (sin reserva ni pago) ---
let _avisoSel = 60;
window.avisarme = (id) => {
  const p = DATA.find((x) => x.id === id);
  if (!p) return;
  const bloqueada = 'Notification' in window && Notification.permission === 'denied';
  const honesto = p.disponibilidad?.nivel === 'verde' ? 'a esa hora suele haber cupo (estimado)'
    : 'la disponibilidad es una estimación, no un lugar apartado';
  $('#modal').innerHTML = `
    <h3>${ic('clock', 18)} Avísame</h3>
    <p>Te recordamos revisar <b>${esc(p.nombre)}</b>. No aparta un lugar — es un aviso para que vayas a ver; ${honesto}.</p>
    <div class="opts" id="aviso-opts">
      <button data-min="30">En 30 min</button>
      <button data-min="60" class="on">En 1 hora</button>
      <button data-min="120">En 2 horas</button>
      <button data-min="180">En 3 horas</button>
    </div>
    ${bloqueada ? `<p class="alarma-aviso">${ic('bulb', 13)} Tu navegador bloqueó las notificaciones, pero igual te avisaré dentro de la app.</p>` : ''}
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
      <button class="btn btn-primary" onclick="confirmarAviso('${id}')">Activar aviso</button>
      <button class="btn btn-ghost" onclick="cerrarModal()">Cancelar</button>
    </div>`;
  _avisoSel = 60;
  abrirModal();
  $('#aviso-opts').querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      $('#aviso-opts').querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on'); _avisoSel = Number(b.dataset.min);
    }));
};
window.confirmarAviso = (id) => {
  const p = DATA.find((x) => x.id === id);
  if (!p) return;
  const min = _avisoSel || 60;
  const recs = LS.getRecs();
  recs.push({ id, nombre: p.nombre, ts: Date.now() + min * 60000, sono: false });
  LS.setRecs(recs);
  cerrarModal();
  const ok = `Te aviso en ${fmtMin(min)} ✓`;
  // Permiso de notificación: se pide solo ahora (gesto del usuario).
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then((perm) => toast(perm === 'granted' ? ok : 'Aviso activado; te avisaré dentro de la app'));
  } else { toast(ok); }
};
// Dispara los recordatorios "Avísame" vencidos (banner + notificación) y limpia los viejos.
function chequearRecordatorios() {
  const recs = LS.getRecs();
  if (!recs.length) return;
  const ahora = Date.now();
  let cambió = false;
  for (const r of recs) {
    if (!r.sono && ahora >= r.ts) {
      r.sono = true; cambió = true;
      const b = $('#banner');
      b.innerHTML = `<span>${ic('clock', 16)} Revisa ${esc(r.nombre)} — ¿hay cupo ahora?</span><button onclick="this.parentElement.classList.remove('show')">OK</button>`;
      b.classList.remove('urgent'); b.classList.add('show');   // recordatorio amigable (borde teal)
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Estaciona 🅿️', { body: `Revisa ${r.nombre} — ¿encontraste cupo?` });
      }
    }
  }
  const limpios = recs.filter((r) => !(r.sono && ahora - r.ts > 3600000));   // descarta los que sonaron hace +1 h
  if (cambió || limpios.length !== recs.length) LS.setRecs(limpios);
}

// Recordatorio: si dejaste el auto otro día (o hace ≥20 h), avisar una sola vez.
function chequearRecordatorioAuto() {
  const a = LS.getAuto();
  if (!a || a.recordado) return;
  const inicio = new Date(a.inicio);
  const distintoDia = inicio.toDateString() !== new Date().toDateString();
  const horas = (Date.now() - a.inicio) / 3600000;
  if (!distintoDia && horas < 20) return;
  a.recordado = true; LS.setAuto(a);
  const fecha = inicio.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
  const b = $('#banner');
  b.innerHTML = `<span>${ic('car', 16)} ¿Sigues con tu auto en ${esc(a.nombre)}? Lo guardaste el ${fecha}</span><button onclick="this.parentElement.classList.remove('show')">OK</button>`;
  b.classList.remove('urgent'); b.classList.add('show');   // recordatorio amigable (borde teal)
}

// --- Bottom sheet arrastrable (solo móvil): mini / medio / completo ----------
function initSheetDrag() {
  const sheet = document.querySelector('.sheet');
  const head = sheet?.querySelector('.sheet-head');
  const phone = document.querySelector('.phone');
  if (!sheet || !head || !phone) return;
  const ESTADOS = [0.12, 0.45, 0.85];     // mini, medio, completo (fracción del alto)
  const esMovil = () => window.matchMedia('(max-width: 859px)').matches;
  const phoneH = () => phone.clientHeight;
  const setFrac = (f) => { sheet.style.height = (f * 100) + '%'; };

  // En PC se limpia el alto inline (manda el CSS de columna). En móvil, estado medio.
  function aplicarLayout() {
    if (esMovil()) { sheet.style.maxHeight = '85%'; if (!sheet.style.height) setFrac(ESTADOS[1]); }
    else { sheet.style.height = ''; sheet.style.maxHeight = ''; }
  }
  aplicarLayout();
  window.addEventListener('resize', aplicarLayout);

  let startY = 0, startH = 0, dragging = false;
  head.addEventListener('pointerdown', (e) => {
    if (!esMovil()) return;
    if (e.target.closest('select, label')) return;   // no arrastrar al usar el orden
    dragging = true; startY = e.clientY; startH = sheet.clientHeight;
    sheet.style.transition = 'none';
    try { head.setPointerCapture(e.pointerId); } catch {}
  });
  head.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const h = Math.max(phoneH() * 0.08, Math.min(phoneH() * 0.9, startH + (startY - e.clientY)));
    sheet.style.height = (h / phoneH() * 100) + '%';
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false; sheet.style.transition = '';
    const frac = sheet.clientHeight / phoneH();
    let best = ESTADOS[0], bd = Infinity;
    for (const s of ESTADOS) { const d = Math.abs(s - frac); if (d < bd) { bd = d; best = s; } }
    setFrac(best);
  }
  head.addEventListener('pointerup', endDrag);
  head.addEventListener('pointercancel', endDrag);
}

// --- Ciclo de datos (con estados de carga / error) --------------------------
async function cargar() {
  const seq = ++cargaSeq;            // marca esta carga; si llega otra más nueva, se descarta
  try {
    const r = await fetch(`${API}?ciudad=${encodeURIComponent(ciudadActual)}`);
    if (!r.ok) throw new Error('http ' + r.status);
    const j = await r.json();
    if (seq !== cargaSeq) return;     // llegó una carga más reciente: ignora esta respuesta vieja
    DATA = j.estacionamientos;
    if (j.centro) CENTRO = j.centro;
    if (j.regiones && j.regiones.length) REGIONES = j.regiones;
    if (j.zonas && j.zonas.length && !ZONAS.length) { ZONAS = j.zonas; poblarSelectorCiudades(); }
    cargado = true;
    sinConexionAvisado = false;       // volvió la conexión: permite avisar de nuevo si se corta
    renderLista();
    refrescarDetalle();
  } catch {
    if (seq !== cargaSeq) return;     // carga vieja que falló: no toques nada ya reemplazado
    if (!cargado) {
      $('#sheet-count').textContent = 'Error de conexión';
      $('#lista').innerHTML = `<div class="empty-big">
        <span class="em">${ic('wifiOff', 46)}</span>
        <div class="empty-tit">No pudimos cargar los estacionamientos</div>
        <p>Revisa tu conexión a internet e inténtalo de nuevo.</p>
        <button class="btn btn-primary" style="margin-top:14px" onclick="cargar()">${ic('refresh', 16)} Reintentar</button></div>`;
    } else if (!sinConexionAvisado) {
      toast('Sin conexión, reintentando…');   // una sola vez por racha de errores
      sinConexionAvisado = true;
    }
  }
}
window.cargar = cargar;

// --- Bienvenida (solo la primera vez) ---------------------------------------
function mostrarBienvenida() {
  if (localStorage.getItem('estaciona_onboarded')) return;
  const o = $('#onboard');
  if (!o) return;
  o.innerHTML = `<div class="onboard-card" role="dialog" aria-modal="true" aria-labelledby="onboard-tit">
    <div class="onboard-ic" aria-hidden="true">${ic('parking', 44)}</div>
    <h3 id="onboard-tit">¡Bienvenido a Estaciona!</h3>
    <p>Versión <b>piloto</b> para <b>todo Chile</b>. Te mostramos dónde estacionar, cuánto cobran y si es gratis. Elige tu ciudad arriba o usa tu ubicación.</p>
    <ul class="onboard-list">
      <li>${ic('locate', 16)} <span>Toca el botón de ubicación para ver lo más cercano a ti.</span></li>
      <li>${ic('filters', 16)} <span>Usa los filtros para acotar por precio, tipo o servicios.</span></li>
      <li>${ic('wallet', 16)} <span>Los precios son <b>referenciales</b>: confírmalos siempre en el lugar.</span></li>
      <li>${ic('starOutline', 16)} <span>Funciona <b>sin cuenta</b>: favoritos y tu auto se guardan solo en este teléfono.</span></li>
    </ul>
    <button class="btn btn-primary" onclick="cerrarBienvenida()">Entendido</button>
  </div>`;
  o.classList.add('show');
  setTimeout(() => o.querySelector('.btn-primary')?.focus(), 60);   // foco al botón (lector de pantalla)
}
window.cerrarBienvenida = () => {
  localStorage.setItem('estaciona_onboarded', '1');
  $('#onboard')?.classList.remove('show');
};

// Tarjetas "esqueleto" con shimmer mientras carga la primera vez.
function skeletonHtml() {
  // Calca la tarjeta real: ícono + título (línea gruesa) + 2 sublíneas + precio
  // apilado (monto + "/hr"). aria-hidden: el lector de pantalla no lee el placeholder.
  const card = `<div class="skel-card" aria-hidden="true">
    <div class="skel skel-ic"></div>
    <div class="skel-info">
      <div class="skel skel-line skel-title w70"></div>
      <div class="skel skel-line w50"></div>
      <div class="skel skel-line w40"></div>
    </div>
    <div class="skel-price-col">
      <div class="skel skel-price"></div>
      <div class="skel skel-price-sm"></div>
    </div>
  </div>`;
  return card.repeat(5);
}

// --- Init -------------------------------------------------------------------
// Trae la config pública (key de MapTiler) antes de pintar el mapa. Si falla,
// sigue igual con tiles de OSM (no bloquea el arranque).
async function cargarConfig() {
  try {
    const r = await fetch('/api/config');
    if (r.ok) { const c = await r.json(); MAPTILER_KEY = c.maptilerKey || ''; TOMTOM_KEY = c.tomtomKey || ''; }
  } catch { /* sin config: usamos OSM */ }
}

async function init() {
  $('#lista').innerHTML = skeletonHtml();   // esqueleto con shimmer mientras carga
  mostrarBienvenida();                       // tarjeta de bienvenida (1ª vez)
  await cargarConfig();                      // key de mapas (antes de crear el mapa)
  initMap();
  // Chips rápidos.
  $('#chips').querySelectorAll('.chip').forEach((c) =>
    c.addEventListener('click', () => { const f = c.dataset.f; filtros[f] = !filtros[f]; c.classList.toggle('on', filtros[f]); actualizarBadgeFiltros(); renderLista(); }));
  $('#btn-filtros').addEventListener('click', abrirFiltros);
  actualizarBadgeFiltros();
  // Selector de orden de la lista (cercanía / precio).
  $('#sheet-order').addEventListener('change', (e) => { orden = e.target.value; renderLista(); });
  // Selector de ciudad (header): cambia la zona que se está mirando.
  $('#ciudad-select').addEventListener('change', (e) => cambiarCiudad(e.target.value, true));
  // Buscador: filtra la lista en vivo; con Enter, geocodifica la dirección/lugar.
  // El botón "X" se actualiza al instante (respuesta inmediata al teclear); el
  // re-filtrado de la lista + redibujo de pines se antirrebota ~160 ms para no
  // recalcular en cada pulsación. El filtrado es local, no se nota la latencia.
  const renderListaDeb = debounce(renderLista, 160);
  $('#search').addEventListener('input', (e) => { query = e.target.value; actualizarBotonLimpiar(); renderListaDeb(); });
  $('#search').addEventListener('keydown', (e) => { if (e.key === 'Enter') geocodificar(e.target.value); });
  // Botón "X": limpia la búsqueda y vuelve a la ciudad actual.
  $('#search-clear').addEventListener('click', limpiarBusqueda);
  // Botón "Buscar en esta zona": fija el usuario al centro del mapa y recarga.
  $('#btn-zona').addEventListener('click', () => {
    if (!map) return;
    const c = map.getCenter();
    USER = { lat: c.lat, lng: c.lng };
    meMarker?.setLatLng([c.lat, c.lng]);
    ciudadPorPunto(USER);                 // si el centro quedó en otra ciudad, cámbiala
    $('#btn-zona').classList.remove('show');
    cargar();
    toast('Buscando en esta zona 🔄');
  });
  // Panel izquierdo plegable (solo PC): mapa a pantalla completa al cerrarlo.
  $('#btn-panel').addEventListener('click', () => {
    const ph = document.querySelector('.phone');
    const cerrado = ph.classList.toggle('panel-cerrado');
    $('#btn-panel').innerHTML = `<span aria-hidden="true">${cerrado ? '⟩' : '⟨'}</span>`;
    $('#btn-panel').setAttribute('aria-label', cerrado ? 'Mostrar panel' : 'Ocultar panel');
    setTimeout(() => map && map.invalidateSize(), 280);
  });
  // Bottom sheet arrastrable (solo móvil).
  initSheetDrag();
  // Navegación inferior.
  document.querySelectorAll('.bottomnav .nav').forEach((b) => b.addEventListener('click', () => irA(b.dataset.view)));
  // Reajustar mapa al tamaño real (PC/celular) y al redimensionar.
  setTimeout(() => map && map.invalidateSize(), 350);
  window.addEventListener('resize', () => map && map.invalidateSize());

  cargar();
  // Si llegó desde la landing con ?q=… (buscador de la portada), busca eso al abrir.
  const qInicial = new URLSearchParams(location.search).get('q');
  if (qInicial) {
    const s = $('#search'); if (s) s.value = qInicial;
    query = qInicial;
    actualizarBotonLimpiar();
    setTimeout(() => geocodificar(qInicial), 400);   // deja cargar el mapa primero
  }
  chequearRecordatorioAuto();   // aviso "¿sigues con tu auto?" si quedó de otro día
  // Refresco periódico SOLO si vale la pena: pestaña visible y vista del mapa activa.
  // (No reconstruir #lista en segundo plano ni mientras estás en "Mi auto"/"Favoritos".)
  setInterval(() => {
    if (document.visibilityState === 'visible' && $('#view-buscar').classList.contains('active')) cargar();
  }, 6000);
  setInterval(() => { if ($('#view-miauto').classList.contains('active')) actualizarMiAutoVivo(); }, 1000);
  setInterval(chequearAlarma, 1000);
  setInterval(chequearRecordatorios, 1000);   // avisos "Avísame"
}
init();
