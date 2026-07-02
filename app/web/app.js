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

// Estadística de uso ANÓNIMA (fire-and-forget). Solo manda el tipo de evento y la
// ciudad mirada; NO datos personales. Nunca debe romper la app (todo en try/catch).
function track(tipo, ciudad, id) {
  try {
    const body = JSON.stringify({ tipo, ciudad, id });
    if (navigator.sendBeacon) { navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' })); return; }
    fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch { /* la analítica jamás interrumpe el uso */ }
}

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

// Estaciona Pro (plan premium del conductor). El flag se guarda en el teléfono
// (lo escribe la página /pro al activar un código). esPro = ¿tiene Pro activo?
function esPro() { try { return !!localStorage.getItem('estaciona_pro'); } catch { return false; } }
// ¿Mostrar este lugar como publicidad (destacado)? No, si el usuario es Pro (sin avisos).
function adDe(p) { return !!p.destacado && !esPro(); }

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
let userReal = false;              // ¿USER viene de geolocalización real? (no del centro de la ciudad)
let map = null, markers = {}, meMarker = null;
let markerLayer = null;             // dónde viven los pines: clúster (si hay lib) o el propio mapa
let CLUSTER = false;                // true si leaflet.markercluster cargó (agrupa pines)
let miniMap = null;                 // mini-mapa de la vista "Mi auto"
let selectedId = null;
let watchId = null;                 // seguimiento de ubicación (watchPosition)
let query = '';
let orden = 'cercania';            // orden de la lista: 'cercania' | 'precio'
let comparar = [];                 // ids seleccionados para comparar lado a lado (máx 3)
let _ciudadCargada = null;         // última ciudad realmente cargada (para vaciar la comparación al cambiar)
let cargado = false;
let cargaSeq = 0;                  // contador de cargas: descarta respuestas viejas (carrera)
let sinConexionAvisado = false;    // evita spamear el toast "Sin conexión" cada 6s
let _focoPrevio = null;            // foco previo del detalle, para restaurarlo al cerrarlo
let _focoModal = null;             // foco previo del modal (separado: un modal puede abrirse SOBRE el detalle)
let _onCerrarModal = null;         // callback opcional al cerrar el modal (p.ej. revertir filtros no aplicados)
let detalleAbiertoId = null;
let filtros = {
  gratis: false, barato: false, techado: false, abierto: false,
  ev: false, accesible: false, camaras: false, verificado: false,
  soloPublicos: false, tipo: 'todos', distMax: 0,
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
  lsSet('estaciona_lugares', JSON.stringify(LUGARES));
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
  plus:'<path d="M12 5v14M5 12h14"/>',
  pinPlus:'<path d="M19 11c0 4.5-7 10-7 10s-7-5.5-7-10a7 7 0 0 1 13.2-3.2"/><path d="M16 4.5h5M18.5 2v5"/>',
  compare:'<path d="M3 8h14l-3.5-3.5M21 16H7l3.5 3.5"/>',
  flag:'<path d="M5 21V4M5 4.5h11l-2 3 2 3H5"/>',
  phone:'<path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 4.5 4.5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 5 5.1 1.5 1.5 0 0 1 6.5 3.5Z"/>',
  globe:'<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.4 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.4-3.5-8.5s1.2-6.1 3.5-8.5Z"/>',
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
  // Cachea por destino + ORIGEN (USER redondeado ~100 m): si te mueves, no
  // reusamos una ETA calculada desde otro punto y rotulada "en vivo".
  const k = `${p.id}@${USER.lat.toFixed(3)},${USER.lng.toFixed(3)}`;
  if (_etaCache[k]) return _etaCache[k];
  try {
    const url = `https://api.tomtom.com/routing/1/calculateRoute/${USER.lat},${USER.lng}:${p.lat},${p.lng}/json?key=${TOMTOM_KEY}&traffic=true&travelMode=car`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const s = (await r.json())?.routes?.[0]?.summary;
    if (!s) return null;
    const res = { min: Math.max(1, Math.round(s.travelTimeInSeconds / 60)), delayMin: Math.round((s.trafficDelayInSeconds || 0) / 60) };
    // El origen cambia al moverse → las claves se acumulan; purga si crece mucho.
    if (Object.keys(_etaCache).length > 200) for (const key of Object.keys(_etaCache)) delete _etaCache[key];
    _etaCache[k] = res;
    return res;
  } catch { return null; }
}

// "Gratis real" (calle pública sin cobro) vs "gratis solo para clientes" (lote
// de una tienda). Importante para no confundir: que el usuario no maneje a un
// supermercado creyendo que es estacionamiento público gratis.
// Categorías "no públicas" (hospital, colegio, etc.): ícono + etiqueta para
// mostrarlas distinto. Devuelve '' si es estacionamiento público normal.
const CAT_ICON = { Salud: 'access', Colegio: 'home', Estadio: 'starOutline', Municipal: 'home', Camiones: 'truck', Terminal: 'car', Cultura: 'home', Comercio: 'home' };
function catBadge(p) {
  if (!p.categoria) return '';
  const name = CAT_ICON[p.categoria] || 'pin';
  return `<span class="cat-badge">${ic(name, 12)} ${esc(p.categoria)}</span>`;
}
const esGratisClientes = (p) => p.precioHora === 0 && /cliente/i.test(p.gratisInfo || '');
const esGratisReal = (p) => p.precioHora === 0 && !esGratisClientes(p);
// Indicador de disponibilidad = 3 segmentos según el NIVEL del semáforo (verde 3,
// amarillo 2, rojo 1, cerrado 0). Antes era una barra con ancho 82%/45%/15%, que
// se leía como "% de cupos libres" — un dato preciso que NO tenemos (la
// disponibilidad es estimación por hora, no ocupación real). Los segmentos comunican
// "nivel", no porcentaje: honesto con lo que sabemos.
function dispSeg(nivel) {
  const n = nivel === 'verde' ? 3 : nivel === 'amarillo' ? 2 : nivel === 'rojo' ? 1 : 0;
  return `<div class="disp-seg ${nivel}" aria-hidden="true">${[0, 1, 2].map((i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`;
}
// Texto corto para el pin del mapa. "~" marca precio estimado (no verificado).
function precioCorto(p) {
  if (p.gratisAhora || esGratisReal(p)) return 'Gratis';
  if (esGratisClientes(p)) return 'Clientes';
  if (p.precioHora == null) return 'Pago';        // pago, precio aún sin dato (lugar reportado)
  return (p.verificado ? '' : '~') + CLP(p.precioHora);
}
// HTML del precio para la lista / favoritos (consciente del tipo de "gratis").
// Si NO está verificado, se muestra como estimación ("~$600 aprox.").
function precioHTML(p) {
  if (p.gratisAhora) return '<span class="free">Gratis ahora</span>';
  if (esGratisReal(p)) return '<span class="free">Gratis</span>';
  if (esGratisClientes(p)) return `<span class="free-cli">${ic('cart', 12)} Solo clientes</span>`;
  if (p.precioHora == null) return `<b class="precio-est-num">Pago</b><small>sin dato</small>`;
  if (p.verificado) return `<b>${CLP(p.precioHora)}</b><small>/hr</small>`;
  return `<b class="precio-est-num">~${CLP(p.precioHora)}</b><small>est.</small>`;
}

// Bloque de contacto (teléfono / sitio web) en el detalle, si la ficha los tiene.
// Los datos vienen de fuentes oficiales verificadas (ver correcciones.js/fichas-extra.js).
function contactoHTML(p) {
  if (!p.telefono && !p.web) return '';
  const partes = [];
  if (p.telefono) {
    const tel = p.telefono.replace(/[^\d+]/g, '');
    partes.push(`<a href="tel:${esc(tel)}">${ic('phone', 14)} ${esc(p.telefono)}</a>`);
  }
  if (p.web) {
    const url = /^https?:\/\//.test(p.web) ? p.web : 'https://' + p.web;
    const label = p.web.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    partes.push(`<a href="${esc(url)}" target="_blank" rel="noopener">${ic('globe', 14)} ${esc(label)}</a>`);
  }
  return `<div class="det-row det-contacto"><span class="k">${ic(p.telefono ? 'phone' : 'globe')}</span><span class="contacto-links">${partes.join('<span class="sep"> · </span>')}</span></div>`;
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
  if (!z) return Promise.resolve();   // siempre promesa (irAFav encadena .then)
  ciudadActual = nombre;
  track('ciudad', nombre);
  const sel = $('#ciudad-select');
  if (sel) { sel.value = nombre; sel.title = `Ciudad: ${nombre}`; }
  if (mover) {
    USER = { lat: z.lat, lng: z.lng };
    if (map) { map.setView([z.lat, z.lng], 15); meMarker?.setLatLng([z.lat, z.lng]); }
  }
  DATA = [];                 // limpia mientras llega la ciudad nueva
  comparar = []; actualizarBarraComparar();      // la comparación es por ciudad cargada
  $('#lista').innerHTML = skeletonHtml();        // feedback inmediato (no dejar las tarjetas viejas)
  $('#sheet-count').textContent = 'Cargando…';
  return cargar();           // trae los estacionamientos de esa ciudad (devuelve la promesa)
}

// --- localStorage (datos en el teléfono) ------------------------------------
// Escritura segura: en modo privado / sin cuota, setItem lanza. Avisamos una vez
// pero NUNCA dejamos a medias el flujo que llamó (ej. cerrar la bienvenida).
let _lsAvisado = false;
function lsSet(key, value) {
  try { localStorage.setItem(key, value); return true; }
  catch { if (!_lsAvisado) { _lsAvisado = true; toast('No pude guardar en este dispositivo (¿modo privado?)'); } return false; }
}
function lsRemove(key) { try { localStorage.removeItem(key); } catch {} }
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
    else f.push({ id, nombre: p.nombre, ciudad: p.ciudad, lat: p.lat, lng: p.lng, precioHora: p.precioHora, gratisInfo: p.gratisInfo, direccion: p.direccion, tipo: p.tipo, verificado: p.verificado });
    lsSet('estaciona_favs', JSON.stringify(f));
    return f.some((x) => (x.id || x) === id);
  },
  getAuto: () => { try { return JSON.parse(localStorage.getItem('estaciona_miauto') || 'null'); } catch { return null; } },
  setAuto: (a) => lsSet('estaciona_miauto', JSON.stringify(a)),
  clearAuto: () => lsRemove('estaciona_miauto'),
  // Recordatorios "Avísame": avisos locales para revisar un lugar a cierta hora.
  getRecs: () => { try { return JSON.parse(localStorage.getItem('estaciona_recs') || '[]'); } catch { return []; } },
  setRecs: (r) => lsSet('estaciona_recs', JSON.stringify(r)),
  // Historial: estacionamientos pasados (se guarda al "Terminar" un auto).
  getHist: () => { try { return JSON.parse(localStorage.getItem('estaciona_historial') || '[]'); } catch { return []; } },
  setHist: (h) => lsSet('estaciona_historial', JSON.stringify(h)),
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
let _zoomSimplif = null; // ¿está el mapa en modo "punto" (zoom < 15)? para no redibujar de más
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
  if (MAPTILER_KEY && modo === 'satelite') {
    // El satélite (hybrid) no tiene equivalente OSM: si falla (key sin permiso/cuota),
    // volvemos a calles para que el mapa NUNCA quede gris.
    let errs = 0;
    layer.on('tileerror', () => {
      if (++errs < 5) return;
      layer.off('tileerror');
      if (baseLayer === layer) { toast('Vista satélite no disponible'); setCapaMapa('calle'); }
    });
  } else if (MAPTILER_KEY) {
    // Calle: respaldo a OSM si MapTiler falla.
    let errs = 0;
    layer.on('tileerror', () => {
      if (++errs < 4) return;
      layer.off('tileerror');
      if (baseLayer === layer) { map.removeLayer(layer); const o = osmTileLayer(); o.addTo(map); if (o.bringToBack) o.bringToBack(); baseLayer = o; }
    });
  }
  const btn = document.querySelector('.leaflet-sat-btn');
  if (btn) { btn.classList.toggle('on', modo === 'satelite'); btn.title = modo === 'satelite' ? 'Ver calles' : 'Ver satélite'; }
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
      d.setAttribute('role', 'button');
      d.setAttribute('tabindex', '0');
      d.setAttribute('aria-label', 'Leyenda de disponibilidad — plegar o desplegar');
      d.setAttribute('aria-expanded', 'true');
      d.innerHTML = '<b class="leyenda-tit">Disponibilidad</b><span><i class="dot verde"></i>Suele haber</span><span><i class="dot amarillo"></i>Puede costar</span><span><i class="dot rojo"></i>Difícil</span>';
      // Plegable en pantallas chicas para no tapar el mapa: toca/Enter para abrir/cerrar.
      const toggle = () => { const pleg = d.classList.toggle('plegada'); d.setAttribute('aria-expanded', pleg ? 'false' : 'true'); };
      d.addEventListener('click', toggle);
      d.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      L.DomEvent.disableClickPropagation(d);
      return d;
    },
  });
  map.addControl(new LegendCtrl());

  // Al cambiar el zoom los pines se simplifican a punto bajo zoom 15. Solo
  // re-renderizamos si se CRUZA ese umbral (con zoomSnap 0.5, evita redibujar
  // todos los pines en cada medio nivel cuando su aspecto no cambia).
  map.on('zoomend', () => {
    const simpl = map.getZoom() < 15;
    if (simpl === _zoomSimplif) return;
    _zoomSimplif = simpl;
    updateMarkers(listaFiltrada());
  });
  // Al mover el mapa: si el centro se aleja del usuario, ofrece "Buscar en esta zona".
  map.on('moveend', onMapMove);
}

// Muestra/oculta el botón "Buscar en esta zona" según cuánto se alejó el centro.
function onMapMove() {
  if (!map || _reportando) return;   // en modo "reportar lugar" el centro es el pin, no ofrecemos "buscar aquí"
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
  const dest = adDe(p) ? ' dest' : '';
  // Mapa alejado (zoom < 15): simplifica a un punto para no saturar de precios.
  // El pin seleccionado y los DESTACADOS (publicidad) conservan el pin "P".
  const zoom = map ? map.getZoom() : 16;
  if (zoom < 15 && !esSel && !adDe(p)) return `<div class="pin-dot ${nivel}"></div>`;
  // Pin "P" circular (estilo parkspot); el seleccionado muestra el precio arriba.
  const precio = esSel ? `<span class="pin-precio">${precioCorto(p)}</span>` : '';
  return `<div class="pin-p ${nivel}${esSel ? ' sel' : ''}${dest}">${precio}P</div>`;
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
    : p.precioHora == null
      ? 0                                              // pago sin dato: no lo priorizamos como si fuera barato
      : Math.max(0, 1200 - Math.min(p.precioHora, 1200));
  if (adDe(p)) z += 3000;                // patrocinados por encima de los normales (no si es Pro)
  if (p.id === selectedId) z += 5000;
  return Math.round(z);
}

function updateMarkers(lista) {
  if (!map) return;
  const simpl = map.getZoom() < 15;
  const vistos = new Set();
  for (const p of lista) {
    vistos.add(p.id);
    const nivel = p.disponibilidad.nivel, sel = p.id === selectedId;
    // Firma de lo que afecta el aspecto del pin: si no cambió, no re-seteamos el
    // icono (cada setIcon fuerza refresco del clúster → caro cada 6 s).
    const sig = `${nivel}|${sel ? 's' : ''}|${simpl && !sel && !adDe(p) ? 'd' : 'p'}|${adDe(p) ? 'D' : ''}`;
    let mk = markers[p.id];
    if (mk) {
      if (mk._sig !== sig) { mk.setIcon(L.divIcon({ className: '', html: iconHtml(p), iconSize: [0, 0] })); mk._sig = sig; }
      mk.nivelEstaciona = nivel;                 // para colorear el clúster
    } else {
      mk = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: iconHtml(p), iconSize: [0, 0] }) });
      mk._sig = sig;
      mk.nivelEstaciona = nivel;
      mk.on('click', () => abrirMapCard(p.id));
      markers[p.id] = mk;
      markerLayer.addLayer(mk);                  // al clúster (o al mapa, si no hay lib)
    }
    mk.setZIndexOffset(zOffset(p));
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
      if (filtros.barato && !(p.precioHora != null && p.precioHora < 1000)) return false;   // null = pago sin dato: no cuenta como "barato"
      if (filtros.techado && !p.atributos?.techado) return false;
      if (filtros.ev && !p.atributos?.ev) return false;
      if (filtros.accesible && !p.atributos?.accesible) return false;
      if (filtros.camaras && !p.atributos?.camaras) return false;
      if (filtros.verificado && !p.verificado) return false;   // solo precios confirmados
      if (filtros.abierto && !p.abierto) return false;
      if (filtros.soloPublicos && p.categoria) return false;   // oculta hospitales/colegios/etc.
      if (filtros.tipo !== 'todos' && p.tipo !== filtros.tipo) return false;
      if (filtros.distMax > 0 && p.dist > filtros.distMax) return false;
      return true;
    })
    .sort((a, b) => {
      // Destacados (patrocinados) primero, sin importar el orden elegido (salvo Pro: sin avisos).
      if (adDe(a) !== adDe(b)) return adDe(a) ? -1 : 1;
      if (orden === 'precio') {
        // Precio efectivo: gratis (o gratis ahora) cuenta como 0. Empate → cercanía.
        const pa = (a.gratisAhora || a.precioHora === 0) ? 0 : (a.precioHora == null ? Infinity : a.precioHora);
        const pb = (b.gratisAhora || b.precioHora === 0) ? 0 : (b.precioHora == null ? Infinity : b.precioHora);
        if (pa !== pb) return pa - pb;
      } else if (orden === 'disponible') {
        // Mejor disponibilidad estimada primero (verde > amarillo > rojo > cerrado). Empate → cercanía.
        const ra = NIVEL_RANK[a.disponibilidad.nivel] ?? 0, rb = NIVEL_RANK[b.disponibilidad.nivel] ?? 0;
        if (ra !== rb) return rb - ra;
      }
      return a.dist - b.dist;
    });
}

// Cuenta filtros activos para el badge del botón ⚙️.
function contarFiltros() {
  let n = 0;
  for (const k of ['gratis', 'barato', 'techado', 'abierto', 'ev', 'accesible', 'camaras', 'verificado', 'soloPublicos']) if (filtros[k]) n++;
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
        <p>Todavía no cargamos estacionamientos en esta ciudad. Vamos sumando zonas de a poco — prueba con otra ciudad desde el selector de arriba, o agrega uno que conozcas.</p>
        <button class="btn btn-primary" style="margin-top:14px" onclick="reportarLugar()">${ic('pinPlus', 16)} Agregar un estacionamiento</button>
      </div>`;
    }
    return;
  }
  // Tráfico estimado de la hora (uno solo para toda la lista): colorea el tiempo en auto.
  const traf = trafico();
  const trafColor = traf.nivel === 'fluido' ? 'var(--green)' : traf.nivel === 'medio' ? 'var(--amber)' : 'var(--red)';
  $('#lista').innerHTML = lista.map((p) => {
    const d = p.disponibilidad || {}, nivel = d.nivel || 'cerrado';   // defensivo: nunca tumbar la lista
    // Disponibilidad = estimación honesta tipo semáforo (NO ocupación real en vivo).
    // Mismo lenguaje que el detalle ("Suele haber/Puede costar/Difícil"), versión corta.
    const estadoTxt = nivel === 'cerrado' ? 'Cerrado'
      : nivel === 'verde' ? 'Suele haber'
      : nivel === 'amarillo' ? 'Puede costar' : 'Difícil';
    // Confirmaciones REALES de la comunidad (cupo confirmado en las últimas 3 h).
    // Check verde — NO una estrella dorada (eso parecería un rating inventado).
    const votos = p.votos ? `<span class="card-rate" title="${p.votos.up} confirmaron cupo (últimas 3 h)">${ic('check', 12)} ${p.votos.up}</span>` : '';
    // Promedio de reseñas de la comunidad (estrella dorada). Solo si hay reseñas REALES.
    const rating = (p.resena && p.resena.n > 0) ? `<span class="card-star" title="${p.resena.n} reseña${p.resena.n > 1 ? 's' : ''} de la comunidad">${ic('starFull', 12)} ${p.resena.promedio.toFixed(1)}</span>` : '';
    return `
      <div class="card ${nivel}${p.id === selectedId ? ' sel' : ''}${adDe(p) ? ' dest' : ''}${adDe(p) && p.destacadoPremium ? ' dest-premium' : ''}" data-id="${esc(p.id)}" role="button" tabindex="0" aria-label="${esc(p.nombre)}, ver detalle">
        ${adDe(p) ? `<div class="dest-tag${p.destacadoPremium ? ' premium' : ''}">${ic('starFull', 11)} ${esc(p.destacadoEtiqueta || 'Destacado')}</div>${p.destacadoPremium && p.destacadoTagline ? `<div class="dest-tagline">${esc(p.destacadoTagline)}</div>` : ''}` : ''}
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
          ${rating}
          ${votos}
          <span class="badge-disp ${nivel}">${estadoTxt}</span>
        </div>
        ${dispSeg(nivel)}
        <div class="card-expand">
          ${featuresHTML(p)}
          <div class="card-actions">
            <button class="btn-reservar" onclick="event.stopPropagation();llevame('${p.id}')">${ic('compass', 16)} Cómo llegar</button>
            <button class="card-vermas" onclick="event.stopPropagation();avisarme('${p.id}')">${ic('clock', 15)} Avísame</button>
          </div>
          <div class="card-bottom">
            <button class="card-detalle" onclick="event.stopPropagation();openDetalle('${p.id}')">Ver detalle completo</button>
            <button class="card-cmp${comparar.includes(p.id) ? ' on' : ''}" onclick="event.stopPropagation();toggleComparar('${p.id}')" aria-pressed="${comparar.includes(p.id) ? 'true' : 'false'}" title="Comparar este lugar" aria-label="Agregar a comparación">${ic('compare', 15)}</button>
          </div>
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
  if (yaSel) {
    // Colapsar: limpiar la selección (si no, renderLista del auto-refresh de 6 s la
    // re-expande sola por `p.id === selectedId`) y devolver el pin a su estilo normal.
    const prev = selectedId; selectedId = null;
    if (prev && markers[prev]) {
      const pp = DATA.find((x) => x.id === prev);
      if (pp) { markers[prev].setIcon(L.divIcon({ className: '', html: iconHtml(pp), iconSize: [0, 0] })); markers[prev].setZIndexOffset(zOffset(pp)); }
    }
    return;
  }
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
  if (p.precioHora == null) return `<b>Pago</b><small>precio sin dato</small>`;
  return `<b>${p.verificado ? '' : '~'}${CLP(p.precioHora)}</b><small>/hr${p.verificado ? '' : ' · est.'}</small>`;
}
function abrirMapCard(id) {
  const p = DATA.find((x) => x.id === id);
  if (!p) return;
  panselect(p);                                                  // centra el mapa + resalta el pin
  $('#lista').querySelectorAll('.card.sel').forEach((c) => c.classList.remove('sel'));  // colapsa la lista
  const d = p.disponibilidad, nivel = d.nivel;
  // Estimación semáforo honesta (NO ocupación real en vivo), igual que la lista/detalle.
  const estadoTxt = nivel === 'cerrado' ? 'Cerrado'
    : nivel === 'verde' ? 'Suele haber' : nivel === 'amarillo' ? 'Puede costar' : 'Difícil';
  const tipoTxt = p.tipo === 'calle' ? 'En la calle' : (p.atributos?.techado ? 'Techado' : 'Privado');
  const dist = Math.round(haversine(USER, p));   // DATA no trae dist (se calcula en la lista)
  const votos = p.votos ? `${ic('check', 12)} ${p.votos.up} confirman · ` : '';
  const el = $('#mapcard');
  el.innerHTML = `
    <button class="mapcard-x" onclick="cerrarMapCard()" aria-label="Cerrar">${ic('x', 16)}</button>
    ${adDe(p) ? `<div class="dest-tag${p.destacadoPremium ? ' premium' : ''}">${ic('starFull', 11)} ${esc(p.destacadoEtiqueta || 'Destacado')}</div>` : ''}
    <div class="mapcard-nm"><span class="estado-dot ${nivel}" aria-hidden="true"></span><span class="nm-txt">${esc(p.nombre)}</span></div>
    <div class="mapcard-addr">${esc(p.direccion || p.ciudad || '')}</div>
    <div class="mapcard-body">
      <div class="mapcard-precio">${precioGrande(p)}</div>
      <div class="mapcard-disp">
        <div class="mapcard-disp-top"><span>Disponibilidad</span><span class="badge-disp ${nivel}">${estadoTxt}</span></div>
        ${dispSeg(nivel)}
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

// --- Comparar 2-3 estacionamientos lado a lado ------------------------------
window.toggleComparar = (id) => {
  const i = comparar.indexOf(id);
  const tope = esPro() ? 5 : 3;
  if (i >= 0) comparar.splice(i, 1);
  else { if (comparar.length >= tope) { toast(esPro() ? 'Puedes comparar hasta 5' : 'Comparas hasta 3 (con Pro, 5)'); return; } comparar.push(id); }
  renderLista();                 // refresca el estado "on" de los toggles
  actualizarBarraComparar();
};
function actualizarBarraComparar() {
  const bar = $('#comparar-bar');
  if (!bar) return;
  if (!comparar.length) { bar.classList.remove('show'); return; }
  const c = bar.querySelector('.cmp-count');
  if (c) c.textContent = `${comparar.length} seleccionado${comparar.length === 1 ? '' : 's'}`;
  bar.classList.add('show');
}
window.limpiarComparar = () => { comparar = []; renderLista(); actualizarBarraComparar(); };
// Texto de precio compacto para la tabla de comparación.
function precioCmp(p) {
  if (p.gratisAhora || esGratisReal(p)) return '<b class="free">Gratis</b>';
  if (esGratisClientes(p)) return 'Solo clientes';
  if (p.precioHora == null) return 'Pago <small>s/dato</small>';
  return `${p.verificado ? '' : '~'}${CLP(p.precioHora)}`;
}
const _estadoTxt = (nivel) => nivel === 'cerrado' ? 'Cerrado' : nivel === 'verde' ? 'Suele haber' : nivel === 'amarillo' ? 'Puede costar' : 'Difícil';
window.abrirComparar = () => {
  if (comparar.length < 2) { toast('Elige al menos 2 lugares para comparar'); return; }
  const items = comparar.map((id) => DATA.find((p) => p.id === id)).filter(Boolean);
  if (items.length < 2) { toast('Esos lugares ya no están disponibles'); return; }
  const cols = items.length;
  const filas = [
    ['Precio/hr', items.map((p) => precioCmp(p))],
    ['Disponible', items.map((p) => `<span class="badge-disp ${p.disponibilidad.nivel}">${_estadoTxt(p.disponibilidad.nivel)}</span>`)],
    ['Ahora', items.map((p) => p.abierto ? '<b style="color:var(--green)">Abierto</b>' : '<b style="color:var(--red)">Cerrado</b>')],
    ['Distancia', items.map((p) => `${Math.round(haversine(USER, p))} m`)],
    ['Caminando', items.map((p) => `${walkMin(haversine(USER, p))} min`)],
    ['En auto', items.map((p) => `${carMin(haversine(USER, p))} min`)],
    ['Tipo', items.map((p) => p.tipo === 'calle' ? 'Calle' : 'Privado')],
    ['Techado', items.map((p) => p.atributos?.techado ? 'Sí' : '—')],
    ['Accesible', items.map((p) => p.atributos?.accesible ? 'Sí' : '—')],
  ];
  const gridCols = `92px repeat(${cols}, minmax(96px, 1fr))`;
  $('#detalle').innerHTML = `
    <div class="det-top">
      <button onclick="cerrarDetalle()" title="Volver" aria-label="Volver">${ic('arrowLeft', 20)}</button>
      <div class="t">${ic('compare', 18)} Comparar ${items.length}</div>
      <span style="width:40px"></span>
    </div>
    <div class="det-body">
      <div class="cmp-grid" style="grid-template-columns:${gridCols}">
        <div class="cmp-corner"></div>
        ${items.map((p) => `<div class="cmp-head">${esc(p.nombre)}</div>`).join('')}
        ${filas.map(([lbl, celdas]) => `<div class="cmp-label">${lbl}</div>${celdas.map((c) => `<div class="cmp-cell">${c}</div>`).join('')}`).join('')}
        <div class="cmp-label"></div>
        ${items.map((p) => `<div class="cmp-cell"><button class="btn btn-primary cmp-go" onclick="llevame('${p.id}')" aria-label="Cómo llegar a ${esc(p.nombre)}">${ic('compass', 14)}</button></div>`).join('')}
      </div>
      <p class="disclaimer">${ic('bulb', 15)} Los precios son estimados salvo los confirmados. Disponibilidad = estimación por hora. Confírmalo en el lugar.</p>
    </div>`;
  detalleAbiertoId = null;                          // no es un detalle individual
  cerrarMapCard();
  const det = $('#detalle');
  det.classList.add('open'); det.inert = false;   // vuelve a entrar al árbol de foco/AX
  _focoPrevio = document.activeElement;
  det.setAttribute('tabindex', '-1'); det.focus();
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
  if (!p) { toast('Este lugar ya no está disponible'); return; }
  detalleAbiertoId = id;
  track('detalle', p.ciudad, p.id);
  panselect(p);                 // centrar mapa + resaltar el pin del lugar

  const attrs = [];
  if (p.atributos?.techado) attrs.push(ic('home', 14) + ' Techado');
  if (p.atributos?.ev) attrs.push(ic('zap', 14) + ' Cargador EV');
  if (p.atributos?.accesible) attrs.push(ic('access', 14) + ' Accesible');
  if (p.atributos?.camaras) attrs.push(ic('camera', 14) + ' Con cámaras');
  if (attrs.length === 0) attrs.push('Sin servicios extra');

  const precioLinea = esGratisClientes(p)
    ? 'Gratis para clientes (con compra)'
    : p.precioHora === 0
      ? 'Gratis'
      : p.precioHora == null
      ? 'Pago · precio sin dato — ¿lo sabes? Repórtalo abajo'
      : p.verificado
        ? (p.precioMin
            ? `${CLP(p.precioMin)} / min · equivale a ~${CLP(p.precioHora)}/hr${p.fuente ? ` <span class="precio-fuente">fuente: ${esc(p.fuente)}</span>` : ''}`
            : `${CLP(p.precioHora)} / hr`)
        : `~${CLP(p.precioHora)} / hr <span class="precio-est">estimado · sin verificar</span>`;
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
      ${p.resena && p.resena.n > 0 ? `<button class="det-rating" onclick="document.querySelector('.comunidad')?.scrollIntoView({behavior:'smooth',block:'start'})" aria-label="${p.resena.promedio} de 5 estrellas, ${p.resena.n} reseñas — ver reseñas">${estrellasFijas(p.resena.promedio, 15)} <b>${p.resena.promedio.toFixed(1)}</b> <span>· ${p.resena.n} reseña${p.resena.n > 1 ? 's' : ''}</span></button>` : ''}
      <div class="det-status" id="det-status-line">${lineaDisponibilidad(p)}</div>
      ${adDe(p) ? `<div class="aviso-dest">${ic('starFull', 15)} <b>${esc(p.destacadoEtiqueta || 'Destacado')}</b>${p.destacadoTagline ? ' · ' + esc(p.destacadoTagline) : ''} · espacio destacado (publicidad)</div>` : ''}
      ${p.reportado ? `<div class="aviso-com">${ic('users', 16)} Estacionamiento <b>aportado por la comunidad</b> — gracias por sumar. Si algo está mal, coméntalo abajo.</div>` : ''}
      ${p.categoria ? `<div class="aviso-cli">${catBadge(p)} Es un estacionamiento de <b>${esc(p.categoria.toLowerCase())}</b> — puede ser de uso restringido, no público general.</div>` : ''}
      <div class="det-row precio-row"><span class="k">${ic('wallet')}</span><span class="precio-val">${precioLinea}</span></div>
      ${esGratisClientes(p)
        ? `<div class="aviso-cli">${ic('cart', 16)} <b>Gratis solo para clientes</b> — válido con compra en el local, no es estacionamiento público.</div>`
        : p.gratisInfo ? `<div class="det-row"><span class="k">${ic('tag')}</span><span>${esc(p.gratisInfo)}</span></div>` : ''}
      <div class="det-row"><span class="k">${ic('clock')}</span><span>${p.horario ? esc(p.horario) + ' · ' : ''}${p.abierto ? '<b style="color:var(--green)">Abierto ahora</b>' : '<b style="color:var(--red)">Cerrado</b>'}</span></div>
      <div class="det-row"><span class="k">${ic('pin')}</span><span>${esc(p.direccion)} · ${Math.round(haversine(USER, p))} m · ${ic('walk', 13)} ${walkMin(haversine(USER, p))} min caminando</span></div>
      <div class="det-row"><span class="k">${ic('car')}</span><span id="det-eta">${carMin(haversine(USER, p))} min en auto · ${trafHTML()}</span></div>
      ${contactoHTML(p)}
      <div class="attrs">${attrs.map((a) => `<span class="attr">${a}</span>`).join('')}</div>
      ${p.precioHora > 0 ? `
      <div class="calc">
        <h4>${ic('calc', 15)} ¿Cuánto pagaré?</h4>
        Salgo en
        <select id="calc-horas">
          ${[1, 2, 3, 4, 6, 8].map((h) => `<option value="${h}">${h} hora${h > 1 ? 's' : ''}</option>`).join('')}
        </select>
        <div class="total" id="calc-total">${p.verificado ? '' : '~'}${CLP(p.precioHora)}</div>
        <div class="calc-nota" id="calc-nota"></div>
      </div>` : ''}
      <div id="curva-sec" class="curva-sec"></div>
      <div class="det-row"><span class="k">${ic('users')}</span>
        <span>¿Encontraste cupo aquí?</span>
        <span class="thumbs" style="margin-left:auto;display:flex;gap:6px">
          <button class="vote-si" onclick="confirmarCupo('${p.id}',true)" aria-label="Sí, había cupo">${ic('check', 16)} Sí</button>
          <button class="vote-no" onclick="confirmarCupo('${p.id}',false)" aria-label="No había cupo">${ic('x', 16)} No</button>
        </span></div>
      ${p.votos ? `<div class="votos-info">${ic('users', 14)} Últimas 3 h: <b>${p.votos.up}</b> dijeron que había cupo · <b>${p.votos.down}</b> que no</div>` : ''}
      <p class="disclaimer">${ic('bulb', 15)} ${p.verificado ? 'Precio confirmado con fuente oficial <b>a junio 2026</b>. Las tarifas se reajustan — confírmalo si ha pasado tiempo.' : p.reportado ? '<b>Lugar aportado por la comunidad, sin verificar.</b> Confirma la tarifa y los datos en el lugar.' : '<b>Precio estimado, sin verificar.</b> Es una referencia generada automáticamente — confirma la tarifa real en el lugar.'}</p>
      <button class="reporte-link" onclick="reportarProblema('${p.id}')">${ic('flag', 13)} ¿Algo está mal? Reportar</button>

      <div class="fotos-sec">
        <h4>${ic('camera', 15)} Fotos de la gente</h4>
        <div id="fotos-galeria" class="fotos-galeria"></div>
        <button class="btn btn-second" onclick="subirFoto('${p.id}')">${ic('camera', 16)} Subir una foto</button>
      </div>

      <div class="comunidad">
        <h4>${ic('starFull', 15)} Reseñas de la comunidad</h4>
        <div class="resenas-cab" id="resenas-cab">${resenasCabHTML(p)}</div>
        <button class="btn btn-primary btn-resena" onclick="dejarResena('${p.id}')">${ic('starOutline', 16)} Dejar mi reseña</button>
        <div id="resenas-lista" class="resenas-lista"></div>
        <div class="com-sep"></div>
        <div id="com-precio-wrap">${comPrecioHTML(p)}</div>
        <div class="com-acciones">
          <button class="btn btn-second" onclick="reportarPrecio('${p.id}')">${ic('wallet', 16)} Reportar precio</button>
        </div>
      </div>
    </div>
    <div class="det-actions">
      <button class="btn btn-primary" onclick="llevame('${p.id}')">${ic('compass', 17)} Cómo llegar</button>
      <div class="det-actions-row">
        <button class="btn btn-second" onclick="avisarme('${p.id}')">${ic('clock', 16)} Avísame</button>
        <button class="btn btn-second" onclick="abrirEstacione('${p.id}')">${ic('car', 16)} Estacioné aquí</button>
      </div>
    </div>`;

  const sel = $('#calc-horas');
  if (sel) {
    const upd = () => {
      const { total, libres } = costoEstimado(p, Number(sel.value));
      $('#calc-total').textContent = total === 0 ? 'Gratis' : (p.verificado ? '' : '~') + CLP(total);
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

  cargarResenas(p.id);                        // reseñas con estrellas de la comunidad
  cargarFotos(p.id);                          // trae las fotos de la gente
  renderCurva(p);                             // "mejor hora para venir" (Pro) o teaser

  cerrarMapCard();                            // la card flotante del pin no debe quedar sobre el detalle
  const det = $('#detalle');
  det.classList.add('open'); det.inert = false;   // vuelve a entrar al árbol de foco/AX
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
// Línea "La gente reporta ~$X/hr" (solo si hay precios reportados). Contenedor
// estable #com-precio-wrap para poder refrescarla sin reconstruir el detalle.
function comPrecioHTML(p) {
  return p.comunidad?.precioReportado
    ? `<div class="com-precio">${ic('wallet', 14)} La gente reporta <b>~${CLP(p.comunidad.precioReportado)}/hr</b> · ${p.comunidad.nPrecios} reporte${p.comunidad.nPrecios > 1 ? 's' : ''}</div>`
    : '';
}
// Refresca la línea "la gente reporta ~$X/hr" EN SITIO tras un aporte de precio
// (sin reabrir el detalle → sin saltar el scroll).
async function refrescarComunidad(id) {
  await cargar();
  if (detalleAbiertoId !== id) return;
  const p = DATA.find((x) => x.id === id);
  const wrap = $('#com-precio-wrap');
  if (wrap && p) wrap.innerHTML = comPrecioHTML(p);
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
// (Los comentarios de texto sueltos se reemplazaron por las RESEÑAS con estrellas,
// que ya incluyen un comentario opcional — un solo lugar para opinar.)

// --- Reseñas con estrellas (opiniones PROPIAS de la app) --------------------
// Dibuja 5 estrellas, llenas hasta `v` (redondeado). Es el rating REAL de la
// comunidad; nunca se inventa (solo aparece si hay reseñas).
function estrellasFijas(v, size = 14) {
  const full = Math.round(v);
  let s = '';
  for (let i = 0; i < 5; i++) s += ic(i < full ? 'starFull' : 'starOutline', size);
  return `<span class="stars">${s}</span>`;
}
// Cabecera del bloque de reseñas: promedio grande + estrellas + nº, o invitación.
function resenaAvgHTML(promedio, n) {
  if (n > 0) {
    return `<div class="resena-avg"><span class="ra-num">${promedio.toFixed(1)}</span>${estrellasFijas(promedio, 17)}<span class="ra-n">${n} reseña${n > 1 ? 's' : ''}</span></div>`;
  }
  return `<div class="resena-vacia">Aún no hay reseñas — <b>sé el primero</b> en contar cómo es.</div>`;
}
function resenasCabHTML(p) {
  return resenaAvgHTML(p.resena?.promedio || 0, p.resena?.n || 0);
}
async function cargarResenas(id) {
  const el = $('#resenas-lista');
  if (el && detalleAbiertoId === id) el.innerHTML = _comSkel;
  try {
    const r = await fetch(`/api/resenas?id=${encodeURIComponent(id)}`);
    if (!el || detalleAbiertoId !== id) return;
    if (!r.ok) { el.innerHTML = ''; return; }
    const j = await r.json();
    if (detalleAbiertoId !== id) return;
    // Cabecera con el promedio FRESCO (no depende del cache de agregados de 15 s).
    const cab = $('#resenas-cab');
    if (cab) cab.innerHTML = resenaAvgHTML(j.promedio || 0, j.n || 0);
    el.innerHTML = (j.resenas || []).map((rs) => `
      <div class="resena-item">
        <div class="resena-top">${estrellasFijas(rs.estrellas, 13)}<span class="com-fecha" title="${esc(fechaAbs(rs.ts))}">${fechaCorta(rs.ts)}</span></div>
        ${rs.texto ? `<div class="resena-texto">${esc(rs.texto)}</div>` : ''}
      </div>`).join('');
  } catch {
    if (el && detalleAbiertoId === id) el.innerHTML = '';
  }
}
// Refresca reseñas EN SITIO tras publicar (sin reabrir el detalle → sin saltar scroll).
// cargarResenas actualiza cabecera + lista con dato fresco; cargar() refresca el
// promedio en la tarjeta de la lista (vía el cache de agregados, hasta ~15 s después).
function refrescarResenas(id) {
  if (detalleAbiertoId === id) cargarResenas(id);
  cargar();
}

let _resenaStars = 0;                           // estrellas elegidas en el modal (0 = ninguna)
function setStars(n) {
  _resenaStars = n;
  const picker = $('#star-picker');
  if (!picker) return;
  picker.querySelectorAll('.star-btn').forEach((btn, i) => {
    btn.innerHTML = ic(i < n ? 'starFull' : 'starOutline', 32);
    btn.classList.toggle('on', i < n);
    btn.setAttribute('aria-checked', i === n - 1 ? 'true' : 'false');
  });
}
window.dejarResena = (id) => {
  _resenaStars = 0;
  $('#modal').innerHTML = `
    <h3>${ic('starFull', 18)} Deja tu reseña</h3>
    <p>¿Cómo fue tu experiencia? Toca las estrellas.</p>
    <div class="star-picker" id="star-picker" role="radiogroup" aria-label="Puntuación en estrellas">
      ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="star-btn" data-n="${n}" aria-label="${n} estrella${n > 1 ? 's' : ''}" aria-checked="false" role="radio">${ic('starOutline', 32)}</button>`).join('')}
    </div>
    <input id="resena-texto" type="text" maxlength="280" placeholder="Cuenta cómo es (opcional): acceso, seguridad, trato…" />
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
      <button class="btn btn-primary" onclick="enviarResena('${id}')">Publicar reseña</button>
      <button class="btn btn-ghost" onclick="cerrarModal()">Cancelar</button>
    </div>`;
  abrirModal();
  const picker = $('#star-picker');
  picker?.querySelectorAll('.star-btn').forEach((btn) => btn.addEventListener('click', () => setStars(Number(btn.dataset.n))));
  setTimeout(() => $('#resena-texto')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') enviarResena(id); }), 60);
};
window.enviarResena = (id) => {
  if (!_resenaStars) { toast('Elige cuántas estrellas ⭐'); return; }
  const texto = ($('#resena-texto')?.value || '').trim();
  enviarResenaReq(id, _resenaStars, texto);
};
async function enviarResenaReq(id, estrellas, texto) {
  const btns = [...($('#modal')?.querySelectorAll('button') || [])];
  const primary = $('#modal')?.querySelector('.btn-primary');
  const txtPrev = primary?.textContent;
  btns.forEach((b) => (b.disabled = true));
  if (primary) primary.textContent = 'Enviando…';
  const rehab = () => { btns.forEach((b) => (b.disabled = false)); if (primary && txtPrev) primary.textContent = txtPrev; };
  try {
    const r = await fetch('/api/resena', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, estrellas, texto }) });
    const j = await r.json();
    if (j.ok) { track('resena', ciudadActual); cerrarModal(); toast('¡Gracias por tu reseña! ⭐'); if (detalleAbiertoId === id) refrescarResenas(id); else cargar(); }
    else { toast('No se pudo enviar la reseña'); rehab(); }
  } catch { toast('Sin conexión'); rehab(); }
}

// --- Reportar un problema de la ficha (crowdsource de corrección) ------------
window.reportarProblema = (id) => {
  const opts = [
    ['cerrado', 'Cerrado permanentemente'],
    ['no-existe', 'No existe / no es estacionamiento'],
    ['precio', 'El precio está mal'],
    ['datos', 'Horario u otros datos incorrectos'],
    ['otro', 'Otro problema'],
  ];
  $('#modal').innerHTML = `
    <h3>${ic('flag', 18)} Reportar un problema</h3>
    <p>¿Qué está mal con este lugar? Nos ayuda a mantener los datos al día.</p>
    <div class="reporte-opts">
      ${opts.map(([m, t]) => `<button class="btn btn-second reporte-opt" onclick="enviarReporte('${id}','${m}')">${t}</button>`).join('')}
    </div>
    <button class="btn btn-ghost" style="margin-top:10px;width:100%" onclick="cerrarModal()">Cancelar</button>`;
  abrirModal();
};
window.enviarReporte = async (id, motivo) => {
  cerrarModal();
  try {
    const r = await fetch('/api/reporte', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, motivo }) });
    const j = await r.json();
    toast(j.ok ? '¡Gracias! Lo vamos a revisar 🙌' : 'No se pudo enviar el reporte');
  } catch { toast('Sin conexión'); }
};

// --- "Mejor hora para venir" (beneficio Pro) --------------------------------
// Curva de disponibilidad estimada por hora (mismo modelo que el semáforo).
async function renderCurva(p) {
  const el = $('#curva-sec');
  if (!el) return;
  // Los lugares aportados por la comunidad no tienen curva (no están en el modelo);
  // no mostramos ni la curva ni el teaser Pro (sería vender algo que no existe aquí).
  if (p.reportado) { el.innerHTML = ''; return; }
  if (!esPro()) {
    el.innerHTML = `<div class="curva-teaser" onclick="location.href='/pro'" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();location.href='/pro'}" role="button" tabindex="0">
      <div class="curva-teaser-t">${ic('clock', 15)} <b>Mejor hora para venir</b> <span class="pro-tag">PRO</span></div>
      <div class="curva-teaser-s">Mira a qué horas suele haber cupo aquí. Se desbloquea con Estaciona Pro.</div></div>`;
    return;
  }
  try {
    const r = await fetch(`/api/curva?id=${encodeURIComponent(p.id)}`);
    if (!r.ok) { el.innerHTML = ''; return; }
    const c = await r.json();
    if (detalleAbiertoId !== p.id) return;   // el usuario ya cambió de ficha
    const col = { verde: 'var(--green)', amarillo: 'var(--amber)', rojo: 'var(--red)', cerrado: 'var(--line)' };
    const alt = { verde: 100, amarillo: 60, rojo: 28, cerrado: 10 };
    const nom = { verde: 'suele haber', amarillo: 'puede costar', rojo: 'difícil', cerrado: 'cerrado' };
    const barras = c.horas.map((h) => {
      const ttl = `${String(h.h).padStart(2, '0')}:00 · ${nom[h.nivel]}${h.gratis ? ' · gratis' : ''}`;
      return `<div class="curva-bar${h.h === c.horaActual ? ' ahora' : ''}${h.gratis ? ' free' : ''}" title="${ttl}"><i style="height:${alt[h.nivel]}%;background:${col[h.nivel]}"></i></div>`;
    }).join('');
    // Sugerencia útil: solo horas DIURNAS (7–21). Si suele haber cupo casi todo el
    // día, decirlo (no recomendar "venir a las 3am"); si no, marcar las mejores y
    // avisar cuáles evitar.
    const verdesDia = c.horas.filter((h) => h.nivel === 'verde' && h.h >= 7 && h.h <= 21).map((h) => h.h);
    const ajustadas = c.horas.filter((h) => (h.nivel === 'amarillo' || h.nivel === 'rojo') && h.h >= 7 && h.h <= 21).map((h) => h.h);
    const sug = verdesDia.length >= 12
      ? 'Suele haber cupo a cualquier hora del día.'
      : verdesDia.length
        ? `Mejor a las ${verdesDia.slice(0, 5).map((h) => h + ' h').join(', ')}${verdesDia.length > 5 ? '…' : ''}.${ajustadas.length ? ` Evita las ${ajustadas.slice(0, 3).map((h) => h + ' h').join(', ')}.` : ''}`
        : 'Hoy la disponibilidad se ve ajustada casi todo el día.';
    el.innerHTML = `
      <div class="curva-head">${ic('clock', 15)} <b>Mejor hora para venir</b> <small>· estimación de hoy</small></div>
      <div class="curva-bars">${barras}</div>
      <div class="curva-axis"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
      <div class="curva-sug">${sug}</div>`;
  } catch { el.innerHTML = ''; }
}
async function enviarAporte(id, body) {
  // Bloquea los botones del modal mientras envía (evita doble envío en redes lentas).
  const btns = [...($('#modal')?.querySelectorAll('button') || [])];
  const primary = $('#modal')?.querySelector('.btn-primary');
  const txtPrev = primary?.textContent;
  btns.forEach((b) => (b.disabled = true));
  if (primary) primary.textContent = 'Enviando…';
  const rehabilitar = () => { btns.forEach((b) => (b.disabled = false)); if (primary && txtPrev) primary.textContent = txtPrev; };
  try {
    const r = await fetch('/api/aporte', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
    const j = await r.json();
    if (j.ok) { track(body.precio != null ? 'reporte_precio' : 'comentario', ciudadActual); cerrarModal(); toast('¡Gracias por tu aporte!'); if (detalleAbiertoId === id) refrescarComunidad(id); else cargar(); }
    else { toast('No se pudo enviar el aporte'); rehabilitar(); }
  } catch { toast('Sin conexión'); rehabilitar(); }
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
      if (j.ok) { track('foto', ciudadActual); toast('¡Foto subida! Gracias 📷'); cargarFotos(id); }
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
  const det = $('#detalle'); det.classList.remove('open'); det.inert = true;   // fuera del foco/AX al cerrar (permite la animación de salida)
  if (_focoPrevio?.focus) _focoPrevio.focus();    // devuelve el foco a donde estaba
};
window.toggleFavDetalle = (id) => {
  const p = DATA.find((x) => x.id === id);
  if (!p) return;
  LS.toggleFav(p);
  // Alternar la estrella EN SITIO: re-abrir el detalle re-descargaba comentarios/fotos
  // y saltaba el scroll al tope solo por marcar un favorito.
  const fav = LS.isFav(id), btn = $('#detalle .det-fav');
  if (btn) {
    btn.classList.toggle('on', fav);
    btn.setAttribute('aria-label', fav ? 'Quitar de favoritos' : 'Guardar en favoritos');
    btn.innerHTML = fav ? ic('starFull', 20) : ic('starOutline', 20);
  }
  renderLista();   // refresca la estrellita en la tarjeta de la lista
};
window.confirmarCupo = (id, ok) => {
  track('voto', ciudadActual);
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
  if (!p) return;
  const el = $('#det-status-line');
  if (el) el.innerHTML = lineaDisponibilidad(p);
  const w = $('#com-precio-wrap');                 // mantiene fresco "la gente reporta ~$X"
  if (w) w.innerHTML = comPrecioHTML(p);
}

// --- Llévame / Compartir ----------------------------------------------------
let _rutaDest = null;
// Abre el modal "¿con qué app te llevo?" para un destino con lat/lng/nombre.
function abrirRuta(p) {
  if (!p) return;
  _rutaDest = p;
  track('comollegar', p.ciudad || ciudadActual, p.id);
  $('#modal').innerHTML = `
    <h3>${ic('compass', 18)} ¿Con qué app te llevo?</h3>
    <p>${esc(p.nombre || 'Tu auto')}${p.direccion ? ' · ' + esc(p.direccion) : ''}</p>
    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-primary" onclick="irRuta('google')">${ic('compass', 17)} Google Maps</button>
      <button class="btn btn-second" onclick="irRuta('waze')">${ic('car', 17)} Waze</button>
      <button class="btn btn-ghost" onclick="cerrarModal()">Cancelar</button>
    </div>`;
  abrirModal();
}
window.llevame = (id) => {
  const auto = LS.getAuto();
  abrirRuta(DATA.find((x) => x.id === id) || LUGARES[id] || (auto && auto.id === id ? auto : null));
};
// Cómo llegar a un episodio del historial (por índice en la lista guardada).
window.llevameHist = (i) => abrirRuta(LS.getHist()[i]);
window.irRuta = (app) => {
  const p = _rutaDest;
  if (!p) return;
  const url = app === 'waze'
    ? `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`
    : `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;
  window.open(url, '_blank', 'noopener');
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
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
      <button class="btn btn-primary" onclick="guardarEstacione()">Listo</button>
      <button class="btn btn-ghost" onclick="cerrarModal()">Cancelar</button>
    </div>`;
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
    if (l.set && haversine(l, p) < 150) {   // solo si Casa/Trabajo está fijada (no coords por defecto)
      cerrarModal(); cerrarDetalle();
      toast(`Estás en ${l.nombre}, no marqué tu auto`);
      return;
    }
  }
  LS.setAuto({
    id: p.id, nombre: p.nombre, direccion: p.direccion, ciudad: p.ciudad, lat: p.lat, lng: p.lng,
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
    icon: L.divIcon({ className: '', html: `<div class="pin-p verde">${ic('car', 13)}</div>`, iconSize: [0, 0] }),
  }).addTo(miniMap);
  setTimeout(() => miniMap && miniMap.invalidateSize(), 60);
}

// Sección "Historial": estacionamientos pasados (volver fácil a los habituales).
function fmtDur(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), mm = m % 60;
  return mm ? `${h}h ${mm}min` : `${h}h`;
}
// Resumen de gasto mensual (beneficio Pro). Usa el historial local (localStorage);
// los costos son ESTIMADOS (según el precio de cada lugar), no cobros reales.
function gastoHTML() {
  const h = LS.getHist();
  if (!h.length) return '';
  if (!esPro()) {
    return `<div class="gasto-teaser" onclick="location.href='/pro'" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();location.href='/pro'}" role="button" tabindex="0">
      <div class="gasto-teaser-t">${ic('wallet', 15)} <b>Tu gasto en estacionamiento</b> <span class="pro-tag">PRO</span></div>
      <div class="gasto-teaser-s">Cuánto llevas gastado este mes y tu promedio. Se desbloquea con Estaciona Pro.</div></div>`;
  }
  const conCosto = h.filter((e) => e.precioHora != null && typeof e.costo === 'number');
  if (!conCosto.length) return '';
  const mesDe = (ts) => { const d = new Date(ts); return d.getFullYear() * 12 + d.getMonth(); };
  const ahora = new Date();
  const mesAct = ahora.getFullYear() * 12 + ahora.getMonth();
  const suma = (arr) => arr.reduce((s, e) => s + (e.costo || 0), 0);
  const esteMes = conCosto.filter((e) => mesDe(e.fin) === mesAct);
  const mesPrev = conCosto.filter((e) => mesDe(e.fin) === mesAct - 1);
  const totalMes = suma(esteMes), totalPrev = suma(mesPrev);
  const prom = Math.round(suma(conCosto) / conCosto.length);
  const tend = totalPrev > 0 ? Math.round((totalMes - totalPrev) / totalPrev * 100) : null;
  const tendTxt = tend == null ? 'Estimado según el precio de cada lugar.'
    : tend === 0 ? 'Igual que el mes pasado · estimado.'
    : tend > 0 ? `${tend}% más que el mes pasado · estimado.`
    : `${Math.abs(tend)}% menos que el mes pasado · estimado.`;
  return `<div class="gasto-sec">
    <div class="gasto-head">${ic('wallet', 18)} <b>Tu gasto este mes</b> <span class="pro-tag">PRO</span></div>
    <div class="gasto-grid">
      <div class="gasto-card"><div class="g-num">${totalMes ? CLP(totalMes) : '$0'}</div><div class="g-lbl">este mes · ${esteMes.length} ${esteMes.length === 1 ? 'vez' : 'veces'}</div></div>
      <div class="gasto-card"><div class="g-num">${prom ? CLP(prom) : '$0'}</div><div class="g-lbl">promedio por vez</div></div>
    </div>
    <div class="gasto-nota">${ic('bulb', 12)} ${tendTxt}</div>
  </div>`;
}
function historialHTML() {
  const h = LS.getHist();
  if (!h.length) return '';
  return `<div class="hist-sec">
    <div class="hist-head">
      <h2 style="font-size:15px;margin:0">${ic('clock', 18)} Historial</h2>
      <div style="display:flex;gap:8px">
        ${esPro() ? `<button class="hist-clear" onclick="exportarHistorial()">${ic('share', 13)} Exportar</button>` : ''}
        <button class="hist-clear" onclick="limpiarHistorial()">${ic('x', 13)} Borrar</button>
      </div>
    </div>
    ${h.map((e, i) => `
      <div class="hist-item">
        <span class="ic">${ic(e.tipo === 'calle' ? 'road' : 'car', 19)}</span>
        <div class="hist-info">
          <div class="nm">${esc(e.nombre)}</div>
          <div class="sub">${fechaCorta(e.fin)} · ${fmtDur(e.dur)}${e.ciudad ? ' · ' + esc(e.ciudad) : ''}</div>
        </div>
        <div class="hist-right">
          <div class="hist-costo">${e.precioHora == null ? '—' : !e.precioHora ? 'Gratis' : e.costo === 0 ? 'Gratis' : CLP(e.costo)}</div>
          <button class="hist-go" onclick="llevameHist(${i})" title="Cómo llegar" aria-label="Cómo llegar a ${esc(e.nombre)}">${ic('compass', 15)}</button>
        </div>
      </div>`).join('')}
  </div>`;
}
window.limpiarHistorial = () => {
  if (!confirm('¿Borrar todo el historial de estacionamientos?')) return;
  lsRemove('estaciona_historial'); renderMiAuto(); toast('Historial borrado');
};
// Exportar historial a CSV (beneficio Pro). Descarga un archivo en el teléfono/PC.
window.exportarHistorial = () => {
  if (!esPro()) { window.location.href = '/pro'; return; }
  const h = LS.getHist();
  if (!h.length) { toast('No hay historial para exportar'); return; }
  const esc2 = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const filas = [['nombre', 'ciudad', 'direccion', 'inicio', 'fin', 'minutos', 'costo']];
  for (const e of h) filas.push([e.nombre, e.ciudad || '', e.direccion || '', new Date(e.inicio).toLocaleString('es-CL'), new Date(e.fin).toLocaleString('es-CL'), Math.round((e.dur || 0) / 60000), e.precioHora == null ? '' : e.costo]);
  const csv = '﻿' + filas.map((f) => f.map(esc2).join(',')).join('\n');   // BOM para que Excel respete acentos
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'estaciona-historial.csv';
  document.body.appendChild(a); a.click(); a.remove();
  toast('Historial exportado ✓');
};

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
    </div>${gastoHTML()}${historialHTML()}</div>`;
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
          <div class="lbl">Llevas <span class="ma-live" title="en curso" aria-hidden="true"></span></div>
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
    </div>${gastoHTML()}${historialHTML()}</div>`;
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
  set('#ma-tiempo', hh > 0 ? `${hh}h ${mm}min` : `${mm} min`);   // bajo 1 h no muestra "0h"
  set('#ma-costo', !a.precioHora ? 'Gratis' : costo === 0 ? 'Gratis ahora' : CLP(costo));
  setHtml('#ma-alarma', `${ic('clock', 14)} ${alarmaTxt}`);
  $('#ma-alarma')?.classList.toggle('urgente', alarmaVencida);   // resalta cuando ya venció
  // ETA de vuelta solo si sabemos dónde estás (geolocalización real); si no, no inventamos distancia.
  setHtml('#ma-eta', userReal
    ? `${ic('walk', 14)} A ${walkMin(distVuelta)} min caminando (${Math.round(distVuelta)} m)`
    : `${ic('walk', 14)} Activa tu ubicación para ver la distancia de vuelta`);
}
window.terminarAuto = () => {
  if (!confirm('¿Terminar y olvidar dónde dejaste tu auto?')) return;   // acción sin retorno
  const a = LS.getAuto();
  if (a) {
    // Guarda el episodio en el historial (para volver fácil a los habituales).
    const h = LS.getHist();
    h.unshift({
      id: a.id, nombre: a.nombre, direccion: a.direccion, ciudad: a.ciudad || ciudadActual,
      lat: a.lat, lng: a.lng, precioHora: a.precioHora, gratisInfo: a.gratisInfo, horario: a.horario,
      inicio: a.inicio, fin: Date.now(), costo: costoTranscurrido(a), dur: Date.now() - a.inicio,
    });
    LS.setHist(h.slice(0, esPro() ? 500 : 30));   // tope 30 (Pro: 500)
  }
  LS.clearAuto(); renderMiAuto(); toast('¡Listo, buen viaje! 🚗');
};

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
      <div class="fav-item" data-id="${p.id}" role="button" tabindex="0" aria-label="${esc(p.nombre)}, ver detalle"><span class="ic">${ic(p.tipo === 'calle' ? 'road' : 'parking', 21)}</span>
        <div style="flex:1;min-width:0"><div class="nm">${esc(p.nombre)}</div>
        <div class="sub">${precioHTML(p)}${p.ciudad ? ' · ' + esc(p.ciudad) : ''} · ${esc(p.direccion)}</div></div>
        <span class="fav-go" aria-hidden="true">${ic('arrowRight', 16)}</span></div>
    `).join('') : `<div class="empty-big" style="padding:28px 20px">
      <span class="em">${ic('starOutline', 40)}</span>
      <div class="empty-tit">Aún no guardas lugares</div>
      <p>Toca la ${ic('starOutline', 14)} de un estacionamiento para guardarlo aquí y volver rápido.</p>
    </div>`}
    ${proCardHTML()}
    <div class="app-legal">
      <a href="/terminos" target="_blank" rel="noopener">Términos</a> · <a href="/privacidad" target="_blank" rel="noopener">Privacidad</a>
    </div>
  </div>`;
  $('#view-favoritos').querySelectorAll('.fav-item[data-id]').forEach((el) => {
    const go = () => irAFav(el.dataset.id);
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
}
// Tarjeta "Estaciona Pro" en Favoritos: invita a Pro (o confirma que ya lo tiene).
function proCardHTML() {
  if (esPro()) {
    return `<div class="pro-card on">
      <div class="pro-tit">${ic('starFull', 16)} Eres Pro ✨</div>
      <p>Sin publicidad · historial ampliado + exportar · comparar hasta 5. ¡Gracias por apoyar Estaciona!</p>
    </div>`;
  }
  return `<div class="pro-card">
    <div class="pro-tit">${ic('starOutline', 16)} Estaciona Pro</div>
    <p>Sin avisos, historial ilimitado + exportar y comparar hasta 5 lugares.</p>
    <a class="btn btn-primary" href="/pro" style="margin-top:8px;display:inline-flex">${ic('starFull', 15)} Conocer Pro</a>
  </div>`;
}
// Tocar un favorito: si es de otra ciudad, cambia a esa ciudad; si es de la
// actual, abre su detalle directamente.
window.irAFav = (id) => {
  const f = LS.getFavs().find((x) => (x.id || x) === id);
  irA('buscar');
  if (f && f.ciudad && f.ciudad !== ciudadActual) {
    // Cambia a la ciudad del favorito y, cuando lleguen sus datos, abre su detalle.
    cambiarCiudad(f.ciudad, true).then(() => { if (DATA.some((p) => p.id === id)) openDetalle(id); });
    return;
  }
  openDetalle(id);
};
window.irLugar = (k) => {
  const l = LUGARES[k];
  if (!l.set) { editarLugar(k); return; }   // aún sin fijar: pide la dirección en vez de saltar a un sector por defecto
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
    <div class="lugar-main" role="button" tabindex="0" onclick="irLugar('${k}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();irLugar('${k}')}" aria-label="${nom}, ver cerca"><span class="ic">${iconHtml}</span>
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
  // Si NO hay una ubicación real (permiso denegado/sin GPS), NO guardamos el centro
  // de la ciudad como "Mi ubicación" en silencio: avisamos y ofrecemos la dirección.
  const fallar = () => toast('No pude obtener tu ubicación. Prueba fijándola por dirección.');
  if (!navigator.geolocation) { userReal ? usar(USER.lat, USER.lng) : fallar(); return; }
  toast('Buscando tu ubicación…');
  navigator.geolocation.getCurrentPosition(
    (pos) => usar(pos.coords.latitude, pos.coords.longitude),
    () => (userReal ? usar(USER.lat, USER.lng) : fallar()),
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
    const lat = parseFloat(arr[0].lat), lng = parseFloat(arr[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { toast('Esa dirección no trae coordenadas'); return; }
    guardarLugar(_lugarEdit, lat, lng, (arr[0].display_name || q).split(',')[0]);
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
      USER = me; userReal = true;
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
      USER = me; userReal = true;
      meMarker?.setLatLng([me.lat, me.lng]);        // mueve el punto, sin recentrar
    },
    () => {},                                         // permisos/errores en silencio
    { enableHighAccuracy: true, maximumAge: 5000 }
  );
}
// Libera el GPS (watchPosition consume batería) cuando no estás mirando el mapa.
function detenerSeguimiento() {
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
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
  if (buscando) return;                  // evita peticiones concurrentes a Nominatim (rate-limit ~1/s)
  const q = texto.trim();
  if (!q) { renderLista(); return; }
  setBuscando(true);
  track('search', ciudadActual);
  toast('Buscando “' + q + '”…');
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=cl&limit=1&accept-language=es`;
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('http ' + r.status);
    const arr = await r.json();
    if (!arr.length) { toast('No encontré ese lugar — filtro la lista'); renderLista(); return; }
    const lat = parseFloat(arr[0].lat), lng = parseFloat(arr[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { toast('Esa dirección no trae coordenadas'); renderLista(); return; }
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

// --- Búsqueda NACIONAL: una sola caja para todo Chile -----------------------
// Mientras escribes, consulta /api/buscar (todo el país) y muestra un desplegable
// de sugerencias; al elegir una, salta a su ciudad y abre su detalle. Es lo que
// convierte el buscador de "solo esta ciudad" a "cualquier estacionamiento del país".
let _sugResultados = [];   // resultados actuales del desplegable
let _sugSel = -1;          // índice resaltado (teclado); -1 = ninguno
let _sugSeq = 0;           // descarta respuestas viejas (búsquedas concurrentes)

// Precio corto para una sugerencia (mismo criterio honesto que el resto de la app).
function precioSug(r) {
  if (r.gratisInfo && /cliente/i.test(r.gratisInfo)) return '🛒 Solo clientes';
  if (r.precioHora === 0) return 'Gratis';
  if (r.precioHora == null) return 'Pago';
  return (r.verificado ? '' : '~') + CLP(r.precioHora) + '/hr';
}

async function buscarNacional(texto) {
  const q = (texto || '').trim();
  if (q.length < 2) { cerrarSugerencias(); return; }
  const seq = ++_sugSeq;
  try {
    const r = await fetch('/api/buscar?q=' + encodeURIComponent(q));
    if (!r.ok) throw new Error('http ' + r.status);
    const j = await r.json();
    if (seq !== _sugSeq) return;                 // llegó una respuesta más nueva
    renderSugerencias(j.resultados || []);
  } catch {
    if (seq === _sugSeq) cerrarSugerencias();     // sin conexión: queda el filtro de lista local
  }
}

function renderSugerencias(resultados) {
  _sugResultados = resultados;
  _sugSel = -1;
  const box = $('#search-suggest');
  if (!box) return;
  if (!resultados.length) {
    box.innerHTML = '<div class="sug-empty">Sin resultados en todo Chile para “' + esc(query) + '”</div>';
    box.hidden = false;
    return;
  }
  box.innerHTML = resultados.map((r, i) => `
    <button class="sug-item" role="option" data-i="${i}" onmousedown="event.preventDefault()" onclick="elegirSugerencia(${i})">
      <span class="sug-ic">${ic(r.tipo === 'calle' ? 'road' : 'parking', 17)}</span>
      <span class="sug-main">
        <span class="sug-nom">${esc(r.nombre)}${r.verificado ? ' <span class="sug-ok" title="Precio confirmado">' + ic('check', 12) + '</span>' : ''}</span>
        <span class="sug-sub">${esc(r.ciudad)}${r.region ? ' · ' + esc(r.region) : ''}</span>
      </span>
      <span class="sug-precio">${precioSug(r)}</span>
    </button>`).join('') +
    '<div class="sug-foot">' + ic('pin', 12) + ' Resultados de todo Chile</div>';
  box.hidden = false;
}

function cerrarSugerencias() {
  _sugResultados = []; _sugSel = -1;
  const box = $('#search-suggest');
  if (box) { box.hidden = true; box.innerHTML = ''; }
}

// Resalta la opción i (navegación con flechas) y la deja visible.
function resaltarSugerencia(i) {
  const box = $('#search-suggest');
  if (!box) return;
  const items = box.querySelectorAll('.sug-item');
  items.forEach((el, k) => el.classList.toggle('on', k === i));
  _sugSel = i;
  if (items[i]) items[i].scrollIntoView({ block: 'nearest' });
}

// Elige una sugerencia: salta a su ciudad (si hace falta) y abre su detalle.
window.elegirSugerencia = (i) => {
  const r = _sugResultados[i];
  if (!r) return;
  cerrarSugerencias();
  const inp = $('#search');
  if (inp) inp.value = '';
  query = '';
  actualizarBotonLimpiar();
  track('search', r.ciudad);
  // Ya estás en su ciudad y está cargada → abre directo.
  if (r.ciudad === ciudadActual && DATA.some((p) => p.id === r.id)) { openDetalle(r.id); return; }
  const z = ZONAS.find((x) => x.nombre === r.ciudad);
  if (z) {
    toast('Yendo a ' + r.nombre + '…');
    cambiarCiudad(r.ciudad, true).then(() => {
      if (DATA.some((p) => p.id === r.id)) openDetalle(r.id);
      else if (map && Number.isFinite(r.lat)) map.setView([r.lat, r.lng], 16);   // respaldo: al menos centra el mapa
    });
  } else if (map && Number.isFinite(r.lat)) {
    map.setView([r.lat, r.lng], 16);
  }
};

// --- Reportar un lugar nuevo (crowdsource estilo Waze) ----------------------
// Flujo: 1) el usuario mueve el mapa para apuntar el lugar con un crosshair;
// 2) confirma la ubicación; 3) llena un formulario corto (nombre, tipo, pago/gratis);
// 4) se envía y aparece en el mapa como aporte de la comunidad (sin verificar).
let _reportando = false, _reportePos = null, _repTipo = 'privado', _repGratis = false;

window.reportarLugar = () => {
  if (!map) { toast('El mapa no está disponible para marcar el lugar'); return; }
  irA('buscar');
  cerrarModal(); cerrarMapCard(); if (detalleAbiertoId) cerrarDetalle();
  _reportando = true;
  $('#crosshair')?.removeAttribute('hidden');
  $('#reportar-bar')?.classList.add('show');
  $('#btn-zona')?.classList.remove('show');
  toast('Mueve el mapa para apuntar el lugar exacto');
  setTimeout(() => map && map.invalidateSize(), 60);
};
function salirModoReporte() {
  _reportando = false;
  $('#crosshair')?.setAttribute('hidden', '');
  $('#reportar-bar')?.classList.remove('show');
  onMapMove();   // recalcula "Buscar cerca de aquí" (#btn-zona), que se ocultó al entrar a reportar
}
window.cancelarReporte = () => salirModoReporte();
window.confirmarUbicacionReporte = () => {
  if (!map) return;
  const c = map.getCenter();
  _reportePos = { lat: c.lat, lng: c.lng };
  salirModoReporte();
  abrirFormularioReporte();
};

function abrirFormularioReporte() {
  _repTipo = 'privado'; _repGratis = false;
  $('#modal').innerHTML = `
    <h3>${ic('pinPlus', 18)} Agregar estacionamiento</h3>
    <p>Lo sumas a <b>${esc(ciudadActual)}</b>, en el punto que marcaste. Aparecerá en el mapa como aporte de la comunidad (sin verificar).</p>
    <label class="rep-lbl" for="rep-nombre">Nombre del lugar</label>
    <input id="rep-nombre" type="text" maxlength="80" placeholder="Ej: Estacionamiento Plaza Centro" aria-label="Nombre del lugar" />
    <label class="rep-lbl">Tipo</label>
    <div class="opts" id="rep-tipo" role="group" aria-label="Tipo de estacionamiento">
      <button type="button" data-v="privado" class="on" aria-pressed="true">${ic('parking', 14)} Privado</button>
      <button type="button" data-v="calle" aria-pressed="false">${ic('road', 14)} En la calle</button>
    </div>
    <label class="rep-lbl">¿Es pago o gratis?</label>
    <div class="opts" id="rep-pago" role="group" aria-label="Pago o gratis">
      <button type="button" data-v="pago" class="on" aria-pressed="true">${ic('wallet', 14)} Pago</button>
      <button type="button" data-v="gratis" aria-pressed="false">${ic('tag', 14)} Gratis</button>
    </div>
    <div id="rep-precio-wrap">
      <label class="rep-lbl" for="rep-precio">Precio aproximado <span class="rep-opt">(opcional)</span></label>
      <div class="precio-field"><span class="precio-pesos">$</span>
        <input id="rep-precio" type="number" inputmode="numeric" min="1" max="20000" placeholder="1000" aria-label="Precio por hora aproximado" />
        <span class="precio-hora">/ hora</span></div>
    </div>
    <label class="rep-lbl" for="rep-dir">Dirección <span class="rep-opt">(opcional)</span></label>
    <input id="rep-dir" type="text" maxlength="120" placeholder="Calle y número…" aria-label="Dirección" />
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px">
      <button class="btn btn-primary" onclick="enviarLugar()">Agregar al mapa</button>
      <button class="btn btn-ghost" onclick="cerrarModal()">Cancelar</button>
    </div>`;
  // Selector de tipo (uno solo activo).
  $('#rep-tipo').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    $('#rep-tipo').querySelectorAll('button').forEach((x) => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
    b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); _repTipo = b.dataset.v;
  }));
  // Pago / gratis (oculta el campo de precio si es gratis).
  $('#rep-pago').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    $('#rep-pago').querySelectorAll('button').forEach((x) => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
    b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); _repGratis = b.dataset.v === 'gratis';
    const w = $('#rep-precio-wrap'); if (w) w.style.display = _repGratis ? 'none' : '';
  }));
  abrirModal();
  setTimeout(() => $('#rep-nombre')?.focus(), 60);
  prefillDireccionReporte();   // mejor esfuerzo: sugiere la dirección del punto marcado
}

// Rellena la dirección con geocodificación inversa (Nominatim), si responde.
async function prefillDireccionReporte() {
  if (!_reportePos) return;
  try {
    const u = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${_reportePos.lat}&lon=${_reportePos.lng}&accept-language=es&zoom=18`;
    const r = await fetch(u, { headers: { 'Accept': 'application/json' } });
    const j = await r.json();
    const inp = $('#rep-dir');
    if (inp && !inp.value && j && j.display_name) inp.value = j.display_name.split(',').slice(0, 2).join(',').trim();
  } catch { /* sin dirección sugerida: el usuario la escribe o se deja vacía */ }
}

window.enviarLugar = async () => {
  const nombre = ($('#rep-nombre')?.value || '').trim();
  if (nombre.length < 2) { toast('Ponle un nombre al lugar'); $('#rep-nombre')?.focus(); return; }
  if (!_reportePos) { toast('Falta marcar la ubicación'); return; }
  let precioHora = null;
  const precioRaw = $('#rep-precio')?.value;
  if (!_repGratis && precioRaw) {
    const v = Math.round(Number(precioRaw));
    if (Number.isFinite(v) && v > 0) {
      if (v > 20000) { toast('Ese precio parece muy alto (máx $20.000/hr)'); return; }
      precioHora = v;
    }
  }
  const direccion = ($('#rep-dir')?.value || '').trim();
  const body = { nombre, lat: _reportePos.lat, lng: _reportePos.lng, ciudad: ciudadActual, tipo: _repTipo, gratis: _repGratis, precioHora, direccion };
  // Bloquea los botones del modal mientras envía (evita doble envío en redes lentas).
  const btns = [...($('#modal')?.querySelectorAll('button') || [])];
  const primary = $('#modal')?.querySelector('.btn-primary');
  const txtPrev = primary?.textContent;
  btns.forEach((b) => (b.disabled = true));
  if (primary) primary.textContent = 'Agregando…';
  const rehabilitar = () => { btns.forEach((b) => (b.disabled = false)); if (primary && txtPrev) primary.textContent = txtPrev; };
  try {
    const r = await fetch('/api/lugar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (j.ok) {
      track('reporte_lugar', ciudadActual);
      cerrarModal(); toast('¡Gracias! Lo agregamos al mapa 📍');
      _reportePos = null;
      await cargar();
      if (j.id && DATA.some((p) => p.id === j.id)) openDetalle(j.id);   // abre el lugar recién creado
    } else {
      const msg = {
        ciudad: 'No pude ubicar la ciudad', nombre: 'Ponle un nombre válido',
        ubicacion: 'Esa ubicación está fuera de Chile', duplicado: 'Ese lugar ya está reportado aquí',
        rate: 'Demasiados reportes seguidos — espera un momento',
      }[j.error] || 'No se pudo agregar el lugar';
      toast(msg);
      rehabilitar();
    }
  } catch { toast('Sin conexión'); rehabilitar(); }
};

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
        <button type="button" data-k="camaras" class="${chip(f.camaras)}" aria-pressed="${press(f.camaras)}">${ic('camera', 14)} Cámaras</button>
      </div>
    </div>

    <div class="f-group">
      <p class="f-label" id="f-otros-lbl">Otros</p>
      <div class="opts" id="f-otros" role="group" aria-labelledby="f-otros-lbl">
        <button type="button" data-k="abierto" class="${chip(f.abierto)}" aria-pressed="${press(f.abierto)}">${ic('clock', 14)} Abierto ahora</button>
        <button type="button" data-k="soloPublicos" class="${chip(f.soloPublicos)}" aria-pressed="${press(f.soloPublicos)}">${ic('check', 14)} Solo públicos</button>
        <button type="button" data-k="verificado" class="${chip(f.verificado)}" aria-pressed="${press(f.verificado)}">${ic('check', 14)} Precio confirmado</button>
      </div>
      <p class="f-hint">"Solo públicos" oculta hospitales, colegios y otros de uso restringido. "Precio confirmado" muestra solo tarifas verificadas.</p>
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
  // Los toggles mutan `filtros` en vivo, pero solo se "aplican" con Aplicar. Si el
  // usuario cierra sin aplicar (tocar fuera/Escape/Cancelar), revertimos al estado previo.
  const snap = JSON.stringify(filtros);
  _onCerrarModal = () => { filtros = JSON.parse(snap); syncChips(); actualizarBadgeFiltros(); };
}
window.aplicarFiltros = () => { _onCerrarModal = null; cerrarModal(); syncChips(); actualizarBadgeFiltros(); renderLista(); };
window.limpiarFiltros = () => {
  filtros = { gratis: false, barato: false, techado: false, abierto: false, ev: false, accesible: false, camaras: false, verificado: false, soloPublicos: false, tipo: 'todos', distMax: 0 };
  _onCerrarModal = null;   // ya aplicamos el "limpiar": no revertir al cerrar
  cerrarModal(); syncChips(); actualizarBadgeFiltros(); renderLista(); toast('Filtros limpiados');
};
function syncChips() {
  $('#chips').querySelectorAll('.chip').forEach((c) => {
    const on = !!filtros[c.dataset.f];
    c.classList.toggle('on', on);
    c.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

// --- Modales ----------------------------------------------------------------
function abrirModal() {
  _onCerrarModal = null;                  // cada modal arranca sin callback de cierre
  _focoModal = document.activeElement;   // foco propio: NO pisa el del detalle si el modal se abre encima
  $('#modal-bg').classList.add('open');
  const m = $('#modal'); m.setAttribute('tabindex', '-1'); m.focus();
}
window.cerrarModal = () => {
  const cb = _onCerrarModal; _onCerrarModal = null;   // se ejecuta al cerrar (revertir filtros, etc.)
  $('#modal-bg').classList.remove('open');
  if (cb) cb();
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
    if (_reportando) { cancelarReporte(); return; }
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
  // Cierra overlays abiertos (en PC el detalle tapaba la columna izquierda de la vista nueva).
  if ($('#detalle')?.classList.contains('open')) cerrarDetalle();
  if ($('#modal-bg')?.classList.contains('open')) cerrarModal();
  if (view !== 'buscar') { if (_reportando) salirModoReporte(); $('#comparar-bar')?.classList.remove('show'); }
  else actualizarBarraComparar();              // al volver al mapa, restaura la barra si hay selección
  if (view !== 'miauto') destruirMiniMapa();   // libera el mini-mapa al salir
  // GPS solo mientras miras el mapa: lo pausa al salir y lo reanuda al volver (si ya estaba activo).
  if (view === 'buscar') { if (userReal) iniciarSeguimiento(); } else { detenerSeguimiento(); }
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
  const enApp = 'Aviso activado; te avisaré dentro de la app';
  // Permiso de notificación: se pide solo ahora (gesto del usuario).
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then((perm) => toast(perm === 'granted' ? ok : enApp));
  } else if ('Notification' in window && Notification.permission === 'denied') {
    toast(enApp);   // honesto: sin permiso del sistema, el aviso solo llega dentro de la app
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
    DATA = Array.isArray(j.estacionamientos) ? j.estacionamientos : [];   // respuesta rara → lista vacía, no romper
    if (_ciudadCargada !== null && _ciudadCargada !== ciudadActual && comparar.length) {
      comparar = []; actualizarBarraComparar();   // la comparación es por ciudad; al cambiar (buscar/ubicación/favorito) se vacía
    }
    _ciudadCargada = ciudadActual;
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
  let onb; try { onb = localStorage.getItem('estaciona_onboarded'); } catch { onb = '1'; }
  if (onb) return;
  const o = $('#onboard');
  if (!o) return;
  o.innerHTML = `<div class="onboard-card" role="dialog" aria-modal="true" aria-labelledby="onboard-tit">
    <div class="onboard-ic" aria-hidden="true">${ic('parking', 44)}</div>
    <h3 id="onboard-tit">¡Te damos la bienvenida a Estaciona!</h3>
    <p>Versión <b>piloto</b> para <b>todo Chile</b>. Te mostramos dónde estacionar, cuánto cobran y si es gratis. Elige tu ciudad arriba o usa tu ubicación.</p>
    <ul class="onboard-list">
      <li>${ic('locate', 16)} <span>Toca el botón de ubicación para ver lo más cercano a ti.</span></li>
      <li>${ic('filters', 16)} <span>Usa los filtros para acotar por precio, tipo o servicios.</span></li>
      <li>${ic('wallet', 16)} <span>Los precios son <b>referenciales</b>: confírmalos siempre en el lugar.</span></li>
      <li>${ic('starOutline', 16)} <span>Funciona <b>sin cuenta</b>: favoritos y tu auto se guardan solo en este teléfono.</span></li>
    </ul>
    <button class="btn btn-primary" onclick="cerrarBienvenida()">Entendido</button>
    <p class="onboard-legal">Al continuar aceptas los <a href="/terminos" target="_blank" rel="noopener">Términos</a> y la <a href="/privacidad" target="_blank" rel="noopener">Privacidad</a>.</p>
  </div>`;
  o.classList.add('show');
  setTimeout(() => o.querySelector('.btn-primary')?.focus(), 60);   // foco al botón (lector de pantalla)
}
window.cerrarBienvenida = () => {
  $('#onboard')?.classList.remove('show');   // cierra SIEMPRE (aunque no se pueda persistir)
  lsSet('estaciona_onboarded', '1');
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
    c.addEventListener('click', () => { const f = c.dataset.f; filtros[f] = !filtros[f]; c.classList.toggle('on', filtros[f]); c.setAttribute('aria-pressed', filtros[f] ? 'true' : 'false'); actualizarBadgeFiltros(); renderLista(); }));
  $('#btn-filtros').addEventListener('click', abrirFiltros);
  // Botón "Agregar lugar" (crowdsource): entra al modo de marcar ubicación.
  $('#btn-reportar')?.addEventListener('click', () => window.reportarLugar());
  // Cerrar cualquier modal tocando el fondo oscuro (no el contenido del modal).
  $('#modal-bg').addEventListener('click', (e) => { if (e.target.id === 'modal-bg') cerrarModal(); });
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
  const buscarNacionalDeb = debounce(buscarNacional, 230);   // sugerencias de todo Chile
  $('#search').addEventListener('input', (e) => {
    query = e.target.value; actualizarBotonLimpiar();
    renderListaDeb();               // filtra también la ciudad cargada (por si el lugar está aquí)
    buscarNacionalDeb(e.target.value);
  });
  $('#search').addEventListener('keydown', (e) => {
    const abierto = _sugResultados.length > 0 && !$('#search-suggest')?.hidden;
    if (e.key === 'ArrowDown' && abierto) { e.preventDefault(); resaltarSugerencia((_sugSel + 1) % _sugResultados.length); }
    else if (e.key === 'ArrowUp' && abierto) { e.preventDefault(); resaltarSugerencia((_sugSel - 1 + _sugResultados.length) % _sugResultados.length); }
    else if (e.key === 'Escape' && abierto) { e.preventDefault(); cerrarSugerencias(); }
    else if (e.key === 'Enter') {
      if (abierto) { e.preventDefault(); elegirSugerencia(_sugSel >= 0 ? _sugSel : 0); }   // elige la resaltada (o la 1ª)
      else geocodificar(e.target.value);   // sin sugerencias: buscar como dirección en el mapa
    }
  });
  // Cerrar el desplegable al hacer clic fuera del buscador.
  document.addEventListener('click', (e) => { if (!e.target.closest('.searchbar')) cerrarSugerencias(); });
  // Botón "X": limpia la búsqueda y vuelve a la ciudad actual.
  $('#search-clear').addEventListener('click', () => { cerrarSugerencias(); limpiarBusqueda(); });
  // Botón "Buscar en esta zona": fija el usuario al centro del mapa y recarga.
  $('#btn-zona').addEventListener('click', () => {
    if (!map) return;
    const c = map.getCenter();
    USER = { lat: c.lat, lng: c.lng };
    meMarker?.setLatLng([c.lat, c.lng]);
    ciudadPorPunto(USER);                 // si el centro quedó en otra ciudad, cámbiala
    $('#btn-zona').classList.remove('show');
    cargar();
    toast('Buscando cerca de aquí 🔄');
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
  track('pageview', ciudadActual);   // estadística de uso anónima
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
    if (document.visibilityState !== 'visible' || !$('#view-buscar').classList.contains('active')) return;
    // No reconstruir la lista si el usuario está interactuando con ella (foco dentro):
    // evita colapsar una tarjeta expandida y perderle el foco del teclado cada 6 s.
    const lista = $('#lista');
    if (lista && lista.contains(document.activeElement) && document.activeElement !== document.body) return;
    cargar();
  }, 6000);
  // "Mi auto" en vivo: solo si esa vista está activa Y la pestaña visible (no hay
  // nada que actualizar en pantalla si no se ve).
  setInterval(() => { if (!document.hidden && $('#view-miauto').classList.contains('active')) actualizarMiAutoVivo(); }, 1000);
  // Alarma anti-multa + recordatorios "Avísame": cada 5 s (no cada 1 s). Precisión
  // de sobra para avisos a nivel de minuto, y 5× menos trabajo. SÍ corren en segundo
  // plano a propósito (el sentido de la alarma es avisarte cuando no estás mirando).
  setInterval(() => { chequearAlarma(); chequearRecordatorios(); }, 5000);
  setInterval(chequearRecordatorioAuto, 60000);   // recordatorio del auto al día siguiente (se auto-protege con a.recordado)
  // Batería: soltar el GPS (watchPosition) cuando la app queda en segundo plano,
  // y reanudarlo al volver si estás en el mapa con ubicación real.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') { detenerSeguimiento(); return; }
    if (userReal && $('#view-buscar').classList.contains('active')) iniciarSeguimiento();
  });
}
init();
