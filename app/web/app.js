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
let CENTRO = { lat: -38.7395, lng: -72.5970, nombre: 'Temuco Centro' };
let USER = { ...CENTRO };          // "estás aquí" (Temuco por defecto)
let map = null, markers = {}, meMarker = null;
let miniMap = null;                 // mini-mapa de la vista "Mi auto"
let selectedId = null;
let watchId = null;                 // seguimiento de ubicación (watchPosition)
let query = '';
let orden = 'cercania';            // orden de la lista: 'cercania' | 'precio'
let cargado = false;
let detalleAbiertoId = null;
let filtros = {
  gratis: false, barato: false, techado: false, abierto: false,
  ev: false, accesible: false, tipo: 'todos', distMax: 0,
};

// Lugares fijos para Favoritos (Casa/Trabajo) — demo, sectores de Temuco.
const LUGARES = {
  casa: { nombre: 'Casa', lat: -38.7385, lng: -72.6150 },
  trabajo: { nombre: 'Trabajo', lat: -38.7300, lng: -72.5850 },
};

// --- Utilidades -------------------------------------------------------------
const CLP = (n) => n === 0 ? 'Gratis' : '$' + new Intl.NumberFormat('es-CL').format(Math.round(n));
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function haversine(a, b) {
  const R = 6371000, rad = (x) => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const walkMin = (m) => Math.max(1, Math.round(m / 80));
// Tiempo manejando: aproximación urbana ~25 km/h (sin servicios externos).
const carMin = (m) => Math.max(1, Math.round(m / 1000 / 25 * 60));

// --- localStorage (datos en el teléfono) ------------------------------------
const LS = {
  getFavs: () => JSON.parse(localStorage.getItem('estaciona_favs') || '[]'),
  toggleFav: (id) => {
    const f = LS.getFavs(); const i = f.indexOf(id);
    if (i >= 0) f.splice(i, 1); else f.push(id);
    localStorage.setItem('estaciona_favs', JSON.stringify(f));
    return f.includes(id);
  },
  isFav: (id) => LS.getFavs().includes(id),
  getAuto: () => JSON.parse(localStorage.getItem('estaciona_miauto') || 'null'),
  setAuto: (a) => localStorage.setItem('estaciona_miauto', JSON.stringify(a)),
  clearAuto: () => localStorage.removeItem('estaciona_miauto'),
};

// --- Mapa -------------------------------------------------------------------
function initMap() {
  if (typeof L === 'undefined') {
    $('#map').innerHTML = '<div class="nomap">🗺️ El mapa necesita internet.<br>Igual puedes ver la lista.</div>';
    return;
  }
  map = L.map('map', { zoomControl: true }).setView([CENTRO.lat, CENTRO.lng], 16);
  // Atribución de OpenStreetMap: OBLIGATORIA por su licencia.
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
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
  return `<div class="pin ${nivel}${esSel ? ' sel' : ''}">${p.tipo === 'calle' ? '🛣️' : '🅿️'} ${p.gratisAhora ? 'Gratis' : CLP(p.precioHora)}</div>`;
}

// Seleccionar = centrar el mapa en el lugar y resaltar su pin.
function panselect(p) {
  if (!map) return;
  const prev = selectedId; selectedId = p.id;
  [prev, p.id].forEach((id) => {
    if (id && markers[id]) {
      const pp = DATA.find((x) => x.id === id);
      if (pp) markers[id].setIcon(L.divIcon({ className: '', html: iconHtml(pp), iconSize: [0, 0] }));
    }
  });
  map.panTo([p.lat, p.lng]);
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
      if (q && !(norm(p.nombre).includes(q) || norm(p.direccion).includes(q))) return false;
      if (filtros.gratis && !(p.precioHora === 0 || p.gratisAhora)) return false;
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
  $('#sheet-count').textContent = `${lista.length} estacionamiento${lista.length === 1 ? '' : 's'} cerca`;

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
    const precio = p.gratisAhora
      ? '<span class="free">Gratis ahora</span>'
      : `<b>${CLP(p.precioHora)}</b>${p.precioHora ? '<small>/hr</small>' : ''}`;
    return `
      <div class="card" data-id="${p.id}">
        <div class="ic">${p.tipo === 'calle' ? '🛣️' : '🅿️'}</div>
        <div class="info">
          <div class="nm">${p.nombre} ${LS.isFav(p.id) ? '⭐' : ''}</div>
          <div class="sub">${dispTxt}</div>
          <div class="sub">${Math.round(p.dist)} m · 🚶 ${walkMin(p.dist)} min · 🚗 ${carMin(p.dist)} min${p.gratisInfo ? ' · <span class="badge-free">' + p.gratisInfo + '</span>' : ''}</div>
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

  const precioLinea = p.precioHora === 0
    ? 'Gratis' : `${CLP(p.precioHora)} / hora${p.fraccion ? ` (${p.fraccion.min} min ${CLP(p.fraccion.precio)})` : ''}`;
  const fav = LS.isFav(p.id);

  $('#detalle').innerHTML = `
    <div class="det-top">
      <button onclick="cerrarDetalle()" title="Volver" aria-label="Volver">←</button>
      <div class="t">${p.nombre}</div>
      <button onclick="toggleFavDetalle('${p.id}')" title="Guardar" aria-label="${fav ? 'Quitar de favoritos' : 'Guardar en favoritos'}">${fav ? '⭐' : '☆'}</button>
      <button onclick="compartir('${p.id}')" title="Compartir" aria-label="Compartir">↗</button>
    </div>
    <div class="det-body">
      <div class="det-hero"><span class="hero-ic">${p.tipo === 'calle' ? '🛣️' : '🅿️'}</span><span class="hero-nm">${p.nombre}</span></div>
      <div class="det-status" id="det-status-line">${lineaDisponibilidad(p)}</div>
      <div class="det-row"><span class="k">💰</span><span>${precioLinea}</span></div>
      ${p.gratisInfo ? `<div class="det-row"><span class="k">🆓</span><span>${p.gratisInfo}</span></div>` : ''}
      <div class="det-row"><span class="k">⏰</span><span>${p.horario} · ${p.abierto ? '<b style="color:var(--green)">Abierto ahora</b>' : '<b style="color:var(--red)">Cerrado</b>'}</span></div>
      <div class="det-row"><span class="k">📍</span><span>${p.direccion} · ${Math.round(haversine(USER, p))} m · 🚶 ${walkMin(haversine(USER, p))} min · 🚗 ${carMin(haversine(USER, p))} min</span></div>
      <div class="attrs">${attrs.map((a) => `<span class="attr">${a}</span>`).join('')}</div>
      ${p.precioHora > 0 ? `
      <div class="calc">
        <h4>🧮 ¿Cuánto pagaré?</h4>
        Salgo en
        <select id="calc-horas">
          ${[1, 2, 3, 4, 6, 8].map((h) => `<option value="${h}">${h} hora${h > 1 ? 's' : ''}</option>`).join('')}
        </select>
        <div class="total" id="calc-total">${CLP(p.precioHora)}</div>
      </div>` : ''}
      <div class="det-row"><span class="k">👥</span>
        <span>¿Encontraste cupo aquí?</span>
        <span class="thumbs" style="margin-left:auto;display:flex;gap:6px">
          <button onclick="confirmarCupo('${p.id}',true)" aria-label="Sí, había cupo">👍</button>
          <button onclick="confirmarCupo('${p.id}',false)" aria-label="No había cupo">👎</button>
        </span></div>
      <p class="disclaimer">💡 Precio referencial. Confirma la tarifa en el lugar.</p>
    </div>
    <div class="det-actions">
      <button class="btn btn-primary" onclick="llevame('${p.id}')">🧭 Llévame</button>
      <button class="btn btn-second" onclick="abrirEstacione('${p.id}')">🚗 Estacioné aquí</button>
    </div>`;

  const sel = $('#calc-horas');
  if (sel) { const upd = () => { $('#calc-total').textContent = CLP(p.precioHora * Number(sel.value)); }; sel.addEventListener('change', upd); upd(); }
  $('#detalle').classList.add('open');
}
window.cerrarDetalle = () => {
  detalleAbiertoId = null;
  // Limpiar selección y devolver el pin a su estilo normal.
  const prev = selectedId; selectedId = null;
  if (prev && markers[prev]) {
    const pp = DATA.find((x) => x.id === prev);
    if (pp) markers[prev].setIcon(L.divIcon({ className: '', html: iconHtml(pp), iconSize: [0, 0] }));
  }
  $('#detalle').classList.remove('open');
};
window.toggleFavDetalle = (id) => { LS.toggleFav(id); openDetalle(id); renderLista(); };
window.confirmarCupo = (id, ok) => toast(ok ? '¡Gracias! Confirmado 👍' : 'Gracias, lo anotamos 👎');

// Actualiza solo la línea de disponibilidad si el detalle está abierto.
function refrescarDetalle() {
  if (!detalleAbiertoId) return;
  const p = DATA.find((x) => x.id === detalleAbiertoId);
  const el = $('#det-status-line');
  if (p && el) el.innerHTML = lineaDisponibilidad(p);
}

// --- Llévame / Compartir ----------------------------------------------------
window.llevame = (id) => {
  const p = DATA.find((x) => x.id === id) || LUGARES[id];
  if (!p) return;
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`, '_blank');
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
    <p>${p.nombre} · ${p.direccion}</p>
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
    precioHora: p.precioHora, inicio: Date.now(),
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
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap',
  }).addTo(miniMap);
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
      <div class="big" style="font-size:20px">${a.nombre}</div>
      <div class="lbl" style="margin-bottom:10px">${a.direccion}</div>
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
  const costo = a.precioHora * ((Date.now() - a.inicio) / 3600000);
  let alarmaTxt = 'Sin alarma';
  if (a.alarmaTs) {
    const rest = Math.round((a.alarmaTs - Date.now()) / 60000);
    alarmaTxt = rest > 0 ? `Alarma en ${rest} min` : 'Alarma cumplida ⏰';
  }
  const distVuelta = haversine(USER, a);   // ETA caminando de vuelta (~80 m/min)
  const set = (id, txt) => { const e = $(id); if (e) e.textContent = txt; };
  set('#ma-tiempo', `${hh}h ${mm}min`);
  set('#ma-costo', a.precioHora ? CLP(costo) : 'Gratis');
  set('#ma-alarma', `⏰ ${alarmaTxt}`);
  set('#ma-eta', `🚶 A ${walkMin(distVuelta)} min caminando (${Math.round(distVuelta)} m)`);
}
window.terminarAuto = () => { LS.clearAuto(); renderMiAuto(); toast('¡Listo, buen viaje! 🚗'); };

// --- Favoritos --------------------------------------------------------------
function renderFavoritos() {
  const favs = LS.getFavs().map((id) => DATA.find((p) => p.id === id)).filter(Boolean);
  $('#view-favoritos').innerHTML = `<div class="simple">
    <h2>⭐ Favoritos</h2>
    <div class="fav-item" onclick="irLugar('casa')"><span class="ic">🏠</span>
      <div><div class="nm">Casa</div><div class="sub">Ver estacionamientos cerca →</div></div></div>
    <div class="fav-item" onclick="irLugar('trabajo')"><span class="ic">💼</span>
      <div><div class="nm">Trabajo</div><div class="sub">Ver estacionamientos cerca →</div></div></div>
    <h2 style="font-size:14px;color:var(--muted);margin:16px 0 8px">Lugares guardados</h2>
    ${favs.length ? favs.map((p) => `
      <div class="fav-item" data-id="${p.id}"><span class="ic">${p.tipo === 'calle' ? '🛣️' : '🅿️'}</span>
        <div style="flex:1"><div class="nm">${p.nombre}</div>
        <div class="sub">${p.gratisAhora ? 'Gratis ahora' : CLP(p.precioHora) + '/hr'} · ${p.direccion}</div></div></div>
    `).join('') : '<div class="empty-big" style="padding:24px">Aún no guardas lugares.<br>Toca la ⭐ en un estacionamiento.</div>'}
  </div>`;
  $('#view-favoritos').querySelectorAll('.fav-item[data-id]').forEach((el) =>
    el.addEventListener('click', () => openDetalle(el.dataset.id)));
}
window.irLugar = (k) => {
  const l = LUGARES[k];
  USER = { lat: l.lat, lng: l.lng }; irA('buscar');
  if (map) { map.setView([l.lat, l.lng], 16); meMarker?.setLatLng([l.lat, l.lng]); }
  renderLista(); toast(`Mostrando cerca de ${l.nombre}`);
};

// --- Geolocalización real ---------------------------------------------------
function usarMiUbicacion() {
  if (!navigator.geolocation) { toast('Tu dispositivo no permite ubicación'); return; }
  toast('Buscando tu ubicación…');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const lejos = haversine(me, CENTRO) > 30000; // >30 km de la zona piloto
      if (lejos) {
        toast('Aún no cubrimos tu zona — te muestro Temuco');
        USER = { ...CENTRO };
        if (map) { map.setView([CENTRO.lat, CENTRO.lng], 16); meMarker?.setLatLng([CENTRO.lat, CENTRO.lng]); }
      } else {
        USER = me;
        if (map) { map.setView([me.lat, me.lng], 16); meMarker?.setLatLng([me.lat, me.lng]); }
        toast('Usando tu ubicación 📍');
        iniciarSeguimiento();   // el punto azul te sigue mientras te mueves
      }
      renderLista();
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
      if (haversine(me, CENTRO) > 30000) return;   // fuera de zona piloto: ignora
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
    if (map) { map.setView([lat, lng], 16); meMarker?.setLatLng([lat, lng]); }
    renderLista();
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
function abrirModal() { $('#modal-bg').classList.add('open'); }
window.cerrarModal = () => $('#modal-bg').classList.remove('open');

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
    b.innerHTML = `<span>⏰ ¡Revisa tu estacionamiento! (${a.nombre})</span><button onclick="this.parentElement.classList.remove('show')">OK</button>`;
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
  b.innerHTML = `<span>🚗 ¿Sigues con tu auto en ${a.nombre}? Lo guardaste el ${fecha}</span><button onclick="this.parentElement.classList.remove('show')">OK</button>`;
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
  try {
    const r = await fetch(API);
    if (!r.ok) throw new Error('http ' + r.status);
    const j = await r.json();
    DATA = j.estacionamientos;
    if (j.centro) { CENTRO = j.centro; $('#loc-label').textContent = CENTRO.nombre; }
    cargado = true;
    renderLista();
    refrescarDetalle();
  } catch {
    if (!cargado) {
      $('#sheet-count').textContent = 'Error de conexión';
      $('#lista').innerHTML = `<div class="empty-big">
        <span class="em">📡</span>No pudimos cargar los estacionamientos.<br>
        <button class="btn btn-primary" style="margin-top:14px" onclick="cargar()">Reintentar</button></div>`;
    } else {
      toast('Sin conexión, reintentando…');
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
    <p>Es una <b>demo</b> de la zona del Centro de Temuco: te mostramos dónde estacionar, cuánto cobran y si es gratis.</p>
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
function init() {
  $('#lista').innerHTML = skeletonHtml();   // esqueleto con shimmer mientras carga
  mostrarBienvenida();                       // tarjeta de bienvenida (1ª vez)
  initMap();
  // Chips rápidos.
  $('#chips').querySelectorAll('.chip').forEach((c) =>
    c.addEventListener('click', () => { const f = c.dataset.f; filtros[f] = !filtros[f]; c.classList.toggle('on', filtros[f]); actualizarBadgeFiltros(); renderLista(); }));
  $('#btn-filtros').addEventListener('click', abrirFiltros);
  actualizarBadgeFiltros();
  // Selector de orden de la lista (cercanía / precio).
  $('#sheet-order').addEventListener('change', (e) => { orden = e.target.value; renderLista(); });
  // Buscador: filtra la lista en vivo; con Enter, geocodifica la dirección/lugar.
  $('#search').addEventListener('input', (e) => { query = e.target.value; renderLista(); });
  $('#search').addEventListener('keydown', (e) => { if (e.key === 'Enter') geocodificar(e.target.value); });
  // Botón "Buscar en esta zona": fija el usuario al centro del mapa y recarga.
  $('#btn-zona').addEventListener('click', () => {
    if (!map) return;
    const c = map.getCenter();
    USER = { lat: c.lat, lng: c.lng };
    meMarker?.setLatLng([c.lat, c.lng]);
    $('#btn-zona').classList.remove('show');
    renderLista();
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
