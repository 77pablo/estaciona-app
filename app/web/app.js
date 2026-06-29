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

// Estado en memoria.
let DATA = [];
let CENTRO = { lat: -38.7359, lng: -72.5905, nombre: 'Temuco' };
const CENTRO_DEFAULT = { ...CENTRO };   // copia inmutable de Temuco (ciudad casa); CENTRO sí se sobrescribe por ciudad
let ZONAS = [];                    // ciudades con datos (del backend)
let REGIONES = [];                 // 16 regiones de Chile, orden norte→sur (del backend)
let MAPTILER_KEY = '';             // key de MapTiler (del backend); vacío => tiles OSM
let ciudadActual = 'Temuco';       // ciudad que se está mirando ahora
let USER = { ...CENTRO };          // "estás aquí" (Temuco por defecto)
let map = null, markers = {}, meMarker = null;
let miniMap = null;                 // mini-mapa de la vista "Mi auto"
let selectedId = null;
let watchId = null;                 // seguimiento de ubicación (watchPosition)
let query = '';
let orden = 'cercania';            // orden de la lista: 'cercania' | 'precio'
let cargado = false;
let cargaSeq = 0;                  // contador de cargas: descarta respuestas viejas (carrera)
let sinConexionAvisado = false;    // evita spamear el toast "Sin conexión" cada 6s
let _focoPrevio = null;            // foco previo, para restaurarlo al cerrar un diálogo
let detalleAbiertoId = null;
let filtros = {
  gratis: false, barato: false, techado: false, abierto: false,
  ev: false, accesible: false, tipo: 'todos', distMax: 0,
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
const walkMin = (m) => Math.max(1, Math.round(m / 80));
// Tiempo manejando: aproximación urbana ~25 km/h (sin servicios externos).
const carMin = (m) => Math.max(1, Math.round(m / 1000 / 25 * 60));

// "Gratis real" (calle pública sin cobro) vs "gratis solo para clientes" (lote
// de una tienda). Importante para no confundir: que el usuario no maneje a un
// supermercado creyendo que es estacionamiento público gratis.
const esGratisClientes = (p) => p.precioHora === 0 && /cliente/i.test(p.gratisInfo || '');
const esGratisReal = (p) => p.precioHora === 0 && !esGratisClientes(p);
// Texto corto para el pin del mapa.
function precioCorto(p) {
  if (p.gratisAhora || esGratisReal(p)) return 'Gratis';
  if (esGratisClientes(p)) return 'Clientes';
  return CLP(p.precioHora);
}
// HTML del precio para la lista / favoritos (consciente del tipo de "gratis").
function precioHTML(p) {
  if (p.gratisAhora) return '<span class="free">Gratis ahora</span>';
  if (esGratisReal(p)) return '<span class="free">Gratis</span>';
  if (esGratisClientes(p)) return '<span class="free-cli">🛒 Solo clientes</span>';
  return `<b>${CLP(p.precioHora)}</b><small>/hr</small>`;
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

// Etiqueta "Abierto / Cerrado" para la lista.
const estadoHTML = (p) => p.abierto
  ? '<span class="estado abierto">● Abierto</span>'
  : '<span class="estado cerrado-lbl">● Cerrado</span>';

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
}
// Ajusta la ciudad actual a la más cercana a un punto (sin mover el mapa).
// Devuelve true si la cambió (el punto está dentro de la región cubierta).
function ciudadPorPunto(pt, maxDist = 40000) {
  const { zona, dist } = zonaMasCercana(pt);
  if (zona && dist < maxDist) {
    ciudadActual = zona.nombre;
    const sel = $('#ciudad-select');
    if (sel) sel.value = zona.nombre;
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
  if (sel) sel.value = nombre;
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

// Agrega la capa base a un mapa. Si es MapTiler y los tiles fallan (key
// restringida a otro dominio, cuota agotada, etc.), cae solo a OSM para que el
// mapa NUNCA se quede gris.
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
    $('#map').innerHTML = '<div class="nomap">🗺️ El mapa necesita internet.<br>Igual puedes ver la lista.</div>';
    return;
  }
  map = L.map('map', { zoomControl: true }).setView([CENTRO.lat, CENTRO.lng], 16);
  addBaseLayer(map);
  meMarker = L.marker([USER.lat, USER.lng], {
    icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [16, 16] }),
  }).addTo(map);

  // Botón flotante "mi ubicación" sobre el mapa (como Google/Waze).
  const GeoCtrl = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd() {
      const b = L.DomUtil.create('button', 'leaflet-geo-btn');
      b.type = 'button'; b.innerHTML = '📍'; b.title = 'Mi ubicación';
      b.setAttribute('aria-label', 'Usar mi ubicación');
      L.DomEvent.disableClickPropagation(b);
      L.DomEvent.on(b, 'click', () => usarMiUbicacion());
      return b;
    },
  });
  map.addControl(new GeoCtrl());

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

// HTML del pin de un estacionamiento (con estado "seleccionado").
function iconHtml(p) {
  const nivel = p.disponibilidad.nivel;
  const esSel = p.id === selectedId;
  // Mapa alejado (zoom < 14): simplifica a un punto para no saturar.
  // El pin seleccionado siempre conserva su precio para no perderlo de vista.
  const zoom = map ? map.getZoom() : 16;
  if (zoom < 14 && !esSel) return `<div class="pin-dot ${nivel}"></div>`;
  return `<div class="pin ${nivel}${esSel ? ' sel' : ''}">${p.tipo === 'calle' ? '🛣️' : '🅿️'} ${precioCorto(p)}</div>`;
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
  map.panTo([p.lat, p.lng]);
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
    if (markers[p.id]) markers[p.id].setIcon(icon);
    else {
      const mk = L.marker([p.lat, p.lng], { icon }).addTo(map);
      mk.on('click', () => openDetalle(p.id));
      markers[p.id] = mk;
    }
    markers[p.id].setZIndexOffset(zOffset(p));
  }
  for (const id of Object.keys(markers)) {
    if (!vistos.has(id)) { map.removeLayer(markers[id]); delete markers[id]; }
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
  for (const k of ['gratis', 'barato', 'techado', 'abierto', 'ev', 'accesible']) if (filtros[k]) n++;
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
    $('#lista').innerHTML = '<div class="empty-big" style="padding:30px">Sin resultados con esos filtros.</div>';
    return;
  }
  $('#lista').innerHTML = lista.map((p) => {
    const d = p.disponibilidad, nivel = d.nivel;
    const dispTxt = d.modo === 'envivo'
      ? `<span class="dot ${nivel}"></span>${nivel === 'cerrado' ? 'Cerrado' : d.cuposLibres + ' cupo' + (d.cuposLibres === 1 ? '' : 's') + ' · en vivo'}`
      : `<span class="dot ${nivel}"></span>${d.label} · estimación`;
    const precio = precioHTML(p);
    return `
      <div class="card" data-id="${p.id}">
        <div class="ic">${p.tipo === 'calle' ? '🛣️' : '🅿️'}</div>
        <div class="info">
          <div class="nm">${esc(p.nombre)} ${LS.isFav(p.id) ? '⭐' : ''}</div>
          <div class="sub">${estadoHTML(p)} · ${dispTxt}</div>
          <div class="sub">${Math.round(p.dist)} m · 🚶 ${walkMin(p.dist)} min · 🚗 ${carMin(p.dist)} min${p.gratisInfo ? ' · <span class="' + (esGratisClientes(p) ? 'badge-cli' : 'badge-free') + '">' + esc(p.gratisInfo) + '</span>' : ''}</div>
        </div>
        <div class="price">${precio}</div>
      </div>`;
  }).join('');

  $('#lista').querySelectorAll('.card').forEach((c) =>
    c.addEventListener('click', () => openDetalle(c.dataset.id)));
  if (sheet) sheet.scrollTop = sc;          // restaurar scroll
}

// --- Detalle ----------------------------------------------------------------
function lineaDisponibilidad(p) {
  const d = p.disponibilidad, nivel = d.nivel;
  const txt = d.modo === 'envivo'
    ? `${nivel === 'cerrado' ? 'Cerrado ahora' : d.cuposLibres + ' cupo' + (d.cuposLibres === 1 ? '' : 's') + ' disponible' + (d.cuposLibres === 1 ? '' : 's')} <small>· en vivo</small>`
    : `${d.label} <small>· estimación, no en vivo</small>`;
  return `<span class="dot ${nivel}"></span>${txt}`;
}

function openDetalle(id) {
  const p = DATA.find((x) => x.id === id);
  if (!p) return;
  detalleAbiertoId = id;
  panselect(p);                 // centrar mapa + resaltar el pin del lugar

  const attrs = [];
  if (p.atributos.techado) attrs.push('🏠 Techado');
  if (p.atributos.ev) attrs.push('⚡ Cargador EV');
  if (p.atributos.accesible) attrs.push('♿ Accesible');
  if (p.atributos.camaras) attrs.push('📹 Con cámaras');
  if (attrs.length === 0) attrs.push('🅿️ Sin servicios extra');

  const precioLinea = esGratisClientes(p)
    ? 'Gratis para clientes (con compra)'
    : p.precioHora === 0
      ? 'Gratis'
      : `${CLP(p.precioHora)} / hora${p.fraccion ? ` (${p.fraccion.min} min ${CLP(p.fraccion.precio)})` : ''}`;
  const fav = LS.isFav(p.id);

  $('#detalle').innerHTML = `
    <div class="det-top">
      <button onclick="cerrarDetalle()" title="Volver" aria-label="Volver">←</button>
      <div class="t">${esc(p.nombre)}</div>
      <button onclick="toggleFavDetalle('${p.id}')" title="Guardar" aria-label="${fav ? 'Quitar de favoritos' : 'Guardar en favoritos'}">${fav ? '⭐' : '☆'}</button>
      <button onclick="compartir('${p.id}')" title="Compartir" aria-label="Compartir">↗</button>
    </div>
    <div class="det-body">
      <div class="det-hero"><span class="hero-ic">${p.tipo === 'calle' ? '🛣️' : '🅿️'}</span><span class="hero-nm">${esc(p.nombre)}</span></div>
      <div class="det-status" id="det-status-line">${lineaDisponibilidad(p)}</div>
      <div class="det-row"><span class="k">💰</span><span>${precioLinea}</span></div>
      ${esGratisClientes(p)
        ? `<div class="aviso-cli">🛒 <b>Gratis solo para clientes</b> — válido con compra en el local, no es estacionamiento público.</div>`
        : p.gratisInfo ? `<div class="det-row"><span class="k">🆓</span><span>${esc(p.gratisInfo)}</span></div>` : ''}
      <div class="det-row"><span class="k">⏰</span><span>${esc(p.horario)} · ${p.abierto ? '<b style="color:var(--green)">Abierto ahora</b>' : '<b style="color:var(--red)">Cerrado</b>'}</span></div>
      <div class="det-row"><span class="k">📍</span><span>${esc(p.direccion)} · ${Math.round(haversine(USER, p))} m · 🚶 ${walkMin(haversine(USER, p))} min · 🚗 ${carMin(haversine(USER, p))} min</span></div>
      <div class="attrs">${attrs.map((a) => `<span class="attr">${a}</span>`).join('')}</div>
      ${p.precioHora > 0 ? `
      <div class="calc">
        <h4>🧮 ¿Cuánto pagaré?</h4>
        Salgo en
        <select id="calc-horas">
          ${[1, 2, 3, 4, 6, 8].map((h) => `<option value="${h}">${h} hora${h > 1 ? 's' : ''}</option>`).join('')}
        </select>
        <div class="total" id="calc-total">${CLP(p.precioHora)}</div>
        <div class="calc-nota" id="calc-nota"></div>
      </div>` : ''}
      <div class="det-row"><span class="k">👥</span>
        <span>¿Encontraste cupo aquí?</span>
        <span class="thumbs" style="margin-left:auto;display:flex;gap:6px">
          <button onclick="confirmarCupo('${p.id}',true)" aria-label="Sí, había cupo">👍</button>
          <button onclick="confirmarCupo('${p.id}',false)" aria-label="No había cupo">👎</button>
        </span></div>
      ${p.votos ? `<div class="votos-info">🗳️ Últimas 3 h: <b>${p.votos.up}</b> dijeron que había cupo · <b>${p.votos.down}</b> que no</div>` : ''}
      <p class="disclaimer">💡 Precio referencial. Confirma la tarifa en el lugar.</p>
    </div>
    <div class="det-actions">
      <button class="btn btn-primary" onclick="llevame('${p.id}')">🧭 Llévame</button>
      <button class="btn btn-second" onclick="abrirEstacione('${p.id}')">🚗 Estacioné aquí</button>
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
  const det = $('#detalle');
  det.classList.add('open');
  _focoPrevio = document.activeElement;       // recuerda dónde estaba el foco
  det.setAttribute('tabindex', '-1'); det.focus();   // mueve el foco al diálogo (lector de pantalla)
}
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
    <h3>🧭 ¿Con qué app te llevo?</h3>
    <p>${esc(p.nombre || 'Tu auto')}${p.direccion ? ' · ' + esc(p.direccion) : ''}</p>
    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-primary" onclick="irRuta('google')">🗺️ Google Maps</button>
      <button class="btn btn-second" onclick="irRuta('waze')">🚗 Waze</button>
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
window.compartir = (id) => {
  const p = DATA.find((x) => x.id === id);
  if (!p) return;
  const texto = `Estoy en ${p.nombre} (${p.direccion}). Ubicación: https://www.google.com/maps?q=${p.lat},${p.lng}`;
  if (navigator.share) navigator.share({ title: 'Estaciona', text: texto }).catch(() => {});
  else { navigator.clipboard?.writeText(texto); toast('Enlace copiado 📋'); }
};

// --- Estacioné aquí + alarma anti-multa -------------------------------------
let _estacionePend = null, _alarmaSel = null;
window.abrirEstacione = (id) => {
  const p = DATA.find((x) => x.id === id);
  if (!p) return;
  _estacionePend = p; _alarmaSel = null;
  $('#modal').innerHTML = `
    <h3>🚗 Guardar mi estacionamiento</h3>
    <p>${esc(p.nombre)} · ${esc(p.direccion)}</p>
    <p style="margin-bottom:8px"><b>⏰ Alarma anti-multa</b> — ¿te aviso en…?</p>
    <div class="opts" id="alarma-opts">
      <button data-min="30">30 min</button>
      <button data-min="60">1 hora</button>
      <button data-min="120">2 horas</button>
      <button data-min="0">Sin alarma</button>
    </div>
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
  // Pedir permiso de notificación SOLO ahora (gesto del usuario, con contexto).
  if (min > 0 && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
  cerrarModal(); cerrarDetalle(); irA('miauto'); toast('Guardado ✓');
};

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
    icon: L.divIcon({ className: '', html: '<div class="pin verde">🚗</div>', iconSize: [0, 0] }),
  }).addTo(miniMap);
  setTimeout(() => miniMap && miniMap.invalidateSize(), 60);
}

// Estructura de la vista (se construye al entrar o al cambiar el auto guardado).
function renderMiAuto() {
  const a = LS.getAuto(), v = $('#view-miauto');
  destruirMiniMapa();                 // limpia instancia previa antes de recrear
  if (!a) {
    v.innerHTML = `<div class="simple"><div class="empty-big">
      <span class="em">🚗</span>Aún no estás estacionado.<br>
      Cuando estaciones, toca <b>"Estacioné aquí"</b> en cualquier lugar.</div></div>`;
    return;
  }
  v.innerHTML = `<div class="simple">
    <h2>🚗 Mi auto</h2>
    <div class="miauto-card">
      <div class="lbl">Está en</div>
      <div class="big" style="font-size:20px">${esc(a.nombre)}</div>
      <div class="lbl" style="margin-bottom:10px">${esc(a.direccion)}</div>
      <div class="lbl">Llevas</div>
      <div class="big" id="ma-tiempo">—</div>
      <div class="cost" id="ma-costo">—</div>
      <div class="lbl" id="ma-alarma">—</div>
      <div class="lbl" id="ma-eta">—</div>
    </div>
    <div id="mini-map" class="mini-map" aria-label="Mapa con la ubicación de tu auto"></div>
    <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-primary" onclick="llevame('${a.id}')">🧭 Volver a mi auto</button>
      <button class="btn btn-second" onclick="compartir('${a.id}')">↗ Compartir ubicación</button>
      <button class="btn btn-ghost" onclick="terminarAuto()">✓ Terminar</button>
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
  let alarmaTxt = 'Sin alarma';
  if (a.alarmaTs) {
    const rest = Math.round((a.alarmaTs - Date.now()) / 60000);
    alarmaTxt = rest > 0 ? `Alarma en ${rest} min` : 'Alarma cumplida ⏰';
  }
  const distVuelta = haversine(USER, a);   // ETA caminando de vuelta (~80 m/min)
  const set = (id, txt) => { const e = $(id); if (e) e.textContent = txt; };
  set('#ma-tiempo', `${hh}h ${mm}min`);
  set('#ma-costo', !a.precioHora ? 'Gratis' : costo === 0 ? 'Gratis ahora' : CLP(costo));
  set('#ma-alarma', `⏰ ${alarmaTxt}`);
  set('#ma-eta', `🚶 A ${walkMin(distVuelta)} min caminando (${Math.round(distVuelta)} m)`);
}
window.terminarAuto = () => { LS.clearAuto(); renderMiAuto(); toast('¡Listo, buen viaje! 🚗'); };

// --- Favoritos --------------------------------------------------------------
function renderFavoritos() {
  // Usa el objeto guardado; si es formato viejo (id string), lo busca en la ciudad actual.
  const favs = LS.getFavs().map((f) => (typeof f === 'string' ? DATA.find((p) => p.id === f) : f)).filter(Boolean);
  $('#view-favoritos').innerHTML = `<div class="simple">
    <h2>⭐ Favoritos</h2>
    ${filaLugar('casa', '🏠')}
    ${filaLugar('trabajo', '💼')}
    <h2 style="font-size:14px;color:var(--muted);margin:16px 0 8px">Lugares guardados</h2>
    ${favs.length ? favs.map((p) => `
      <div class="fav-item" data-id="${p.id}"><span class="ic">${p.tipo === 'calle' ? '🛣️' : '🅿️'}</span>
        <div style="flex:1"><div class="nm">${esc(p.nombre)}</div>
        <div class="sub">${precioHTML(p)}${p.ciudad ? ' · ' + esc(p.ciudad) : ''} · ${esc(p.direccion)}</div></div></div>
    `).join('') : '<div class="empty-big" style="padding:24px">Aún no guardas lugares.<br>Toca la ⭐ en un estacionamiento.</div>'}
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
function filaLugar(k, ic) {
  const l = LUGARES[k];
  const sub = l.set
    ? `${esc(l.etiqueta || 'Ubicación fijada')} · ver cerca →`
    : 'Sin fijar · toca ✏️ para poner tu dirección';
  return `<div class="fav-item lugar">
    <div class="lugar-main" onclick="irLugar('${k}')"><span class="ic">${ic}</span>
      <div style="min-width:0"><div class="nm">${LUGARES_DEF[k].nombre}</div><div class="sub">${sub}</div></div></div>
    <button class="lugar-edit" onclick="editarLugar('${k}')" aria-label="Fijar ${LUGARES_DEF[k].nombre}">✏️</button>
  </div>`;
}

// Modal para fijar un lugar: por dirección (Nominatim) o por ubicación actual.
let _lugarEdit = null;
window.editarLugar = (k) => {
  _lugarEdit = k;
  const nom = LUGARES_DEF[k].nombre;
  $('#modal').innerHTML = `
    <h3>📍 Fijar ${nom}</h3>
    <p>¿Dónde queda tu ${nom.toLowerCase()}? Se guarda solo en este teléfono.</p>
    <input id="lugar-dir" type="text" placeholder="Escribe la dirección o lugar…" autocomplete="off" aria-label="Dirección de ${nom}" />
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
      <button class="btn btn-primary" onclick="fijarLugarDireccion()">🔎 Buscar esta dirección</button>
      <button class="btn btn-second" onclick="fijarLugarAqui()">📍 Usar mi ubicación actual</button>
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

// --- Buscar dirección/lugar (geocodificación con Nominatim de OpenStreetMap) -
async function geocodificar(texto) {
  const q = texto.trim();
  if (!q) { renderLista(); return; }
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
  }
}

// --- Panel de filtros -------------------------------------------------------
function abrirFiltros() {
  const f = filtros;
  const chip = (on) => on ? 'on' : '';
  $('#modal').innerHTML = `
    <h3>Filtros</h3>
    <p style="margin-bottom:10px">Tipo de estacionamiento</p>
    <div class="opts" id="f-tipo">
      <button data-v="todos" class="${chip(f.tipo === 'todos')}">Todos</button>
      <button data-v="privado" class="${chip(f.tipo === 'privado')}">Privado</button>
      <button data-v="calle" class="${chip(f.tipo === 'calle')}">Calle</button>
    </div>
    <p style="margin:12px 0 6px">Servicios</p>
    <div class="opts" id="f-serv">
      <button data-k="gratis" class="${chip(f.gratis)}">🆓 Gratis</button>
      <button data-k="barato" class="${chip(f.barato)}">💸 Barato</button>
      <button data-k="techado" class="${chip(f.techado)}">🏠 Techado</button>
      <button data-k="ev" class="${chip(f.ev)}">⚡ Cargador EV</button>
      <button data-k="accesible" class="${chip(f.accesible)}">♿ Accesible</button>
      <button data-k="abierto" class="${chip(f.abierto)}">⏰ Abierto ahora</button>
    </div>
    <p style="margin:12px 0 6px">Distancia máxima: <b id="f-dist-lbl">${f.distMax ? f.distMax + ' m' : 'sin límite'}</b></p>
    <input id="f-dist" type="range" min="0" max="2000" step="100" value="${f.distMax}" style="width:100%" />
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-ghost" style="flex:1" onclick="limpiarFiltros()">Limpiar</button>
      <button class="btn btn-primary" style="flex:2" onclick="aplicarFiltros()">Aplicar</button>
    </div>`;
  $('#f-tipo').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    $('#f-tipo').querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on'); filtros.tipo = b.dataset.v;
  }));
  $('#f-serv').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    filtros[b.dataset.k] = !filtros[b.dataset.k]; b.classList.toggle('on', filtros[b.dataset.k]);
  }));
  $('#f-dist').addEventListener('input', (e) => {
    filtros.distMax = Number(e.target.value);
    $('#f-dist-lbl').textContent = filtros.distMax ? filtros.distMax + ' m' : 'sin límite';
  });
  abrirModal();
}
window.aplicarFiltros = () => { cerrarModal(); syncChips(); actualizarBadgeFiltros(); renderLista(); };
window.limpiarFiltros = () => {
  filtros = { gratis: false, barato: false, techado: false, abierto: false, ev: false, accesible: false, tipo: 'todos', distMax: 0 };
  cerrarModal(); syncChips(); actualizarBadgeFiltros(); renderLista(); toast('Filtros limpiados');
};
function syncChips() {
  $('#chips').querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', filtros[c.dataset.f]));
}

// --- Modales ----------------------------------------------------------------
function abrirModal() {
  _focoPrevio = document.activeElement;
  $('#modal-bg').classList.add('open');
  const m = $('#modal'); m.setAttribute('tabindex', '-1'); m.focus();
}
window.cerrarModal = () => {
  $('#modal-bg').classList.remove('open');
  if (_focoPrevio?.focus) _focoPrevio.focus();
};

// Cerrar diálogos con la tecla Escape (modal primero, luego detalle).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if ($('#modal-bg').classList.contains('open')) window.cerrarModal();
  else if ($('#detalle').classList.contains('open')) window.cerrarDetalle();
});

// --- Navegación entre vistas ------------------------------------------------
function irA(view) {
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
    b.innerHTML = `<span>⏰ ¡Revisa tu estacionamiento! (${esc(a.nombre)})</span><button onclick="this.parentElement.classList.remove('show')">OK</button>`;
    b.classList.add('show');
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Estaciona ⏰', { body: `Revisa tu estacionamiento en ${a.nombre}` });
    }
  }
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
  b.innerHTML = `<span>🚗 ¿Sigues con tu auto en ${esc(a.nombre)}? Lo guardaste el ${fecha}</span><button onclick="this.parentElement.classList.remove('show')">OK</button>`;
  b.classList.add('show');
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
        <span class="em">📡</span>No pudimos cargar los estacionamientos.<br>
        <button class="btn btn-primary" style="margin-top:14px" onclick="cargar()">Reintentar</button></div>`;
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
  o.innerHTML = `<div class="onboard-card" role="dialog" aria-label="Bienvenida">
    <div class="onboard-ic" aria-hidden="true">🅿️</div>
    <h3>¡Bienvenido a Estaciona!</h3>
    <p>Versión <b>piloto</b> para <b>todo Chile</b>: te mostramos dónde estacionar, cuánto cobran y si es gratis. Elige tu ciudad arriba 📍 o usa tu ubicación.</p>
    <ul class="onboard-list">
      <li>🔓 Funciona <b>sin cuenta</b>: tus favoritos y tu auto se guardan solo en este teléfono.</li>
      <li>📍 Toca el botón de ubicación para ver lo más cercano a ti.</li>
      <li>💡 Los precios son referenciales: confirma siempre en el lugar.</li>
    </ul>
    <button class="btn btn-primary" onclick="cerrarBienvenida()">Entendido</button>
  </div>`;
  o.classList.add('show');
}
window.cerrarBienvenida = () => {
  localStorage.setItem('estaciona_onboarded', '1');
  $('#onboard')?.classList.remove('show');
};

// Tarjetas "esqueleto" con shimmer mientras carga la primera vez.
function skeletonHtml() {
  const card = `<div class="skel-card">
    <div class="skel skel-ic"></div>
    <div class="skel-info"><div class="skel skel-line w70"></div><div class="skel skel-line w50"></div><div class="skel skel-line w40"></div></div>
    <div class="skel skel-price"></div>
  </div>`;
  return card.repeat(5);
}

// --- Init -------------------------------------------------------------------
// Trae la config pública (key de MapTiler) antes de pintar el mapa. Si falla,
// sigue igual con tiles de OSM (no bloquea el arranque).
async function cargarConfig() {
  try {
    const r = await fetch('/api/config');
    if (r.ok) { const c = await r.json(); MAPTILER_KEY = c.maptilerKey || ''; }
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
  $('#search').addEventListener('input', (e) => { query = e.target.value; renderLista(); });
  $('#search').addEventListener('keydown', (e) => { if (e.key === 'Enter') geocodificar(e.target.value); });
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
  chequearRecordatorioAuto();   // aviso "¿sigues con tu auto?" si quedó de otro día
  setInterval(cargar, 6000);
  setInterval(() => { if ($('#view-miauto').classList.contains('active')) actualizarMiAutoVivo(); }, 1000);
  setInterval(chequearAlarma, 1000);
}
init();
