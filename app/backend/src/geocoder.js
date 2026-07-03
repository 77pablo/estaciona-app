// ============================================================================
// Estaciona — Geocodificación (dirección ⇄ coordenadas) con proveedor INTERCAMBIABLE
// ----------------------------------------------------------------------------
// El frontend NO llama a ningún proveedor directo: pega a /api/geocode y
// /api/reverse, y este módulo decide el proveedor por la env var GEOCODER. Así,
// cambiar de proveedor (ej. salir del Nominatim público, que NO permite uso
// comercial, a uno propio/pago) es solo CONFIGURACIÓN — no se toca el frontend.
//
//   GEOCODER=nominatim   (default) → servidor OSM público, o self-host si defines
//                          NOMINATIM_URL=https://tu-nominatim.tld  (para producción)
//   GEOCODER=locationiq  → LocationIQ (compatible Nominatim), key LOCATIONIQ_KEY
//   GEOCODER=maptiler    → MapTiler Geocoding, key MAPTILER_KEY (ya la usás para el mapa)
//
// ⚠️ El Nominatim PÚBLICO no está permitido para producción comercial (ver
// LICENCIAS.md §2). Sirve para el piloto/desarrollo. Para vender/producción:
// self-host (NOMINATIM_URL) o un proveedor pago (GEOCODER=locationiq|maptiler).
//
// Todos los adaptadores devuelven una forma NORMALIZADA:
//   geocodificar(q)      → { lat, lng, nombre } | null
//   geocodificarInverso  → { direccion } | null
// La key vive en el servidor (no se expone al navegador). Se identifica con
// User-Agent (obligatorio en la política de Nominatim).
// ============================================================================

const PROVIDER = (process.env.GEOCODER || 'nominatim').toLowerCase();
// Contacto para el User-Agent (requisito de la política de uso de OSM/Nominatim).
const UA = 'Estaciona/1.0 (pablodaniel28200728@gmail.com)';

// fetch con timeout para que un geocoder lento no cuelgue el request.
async function pedir(url, headers = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json', ...headers }, signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }   // sin conexión / timeout / respuesta inválida
  finally { clearTimeout(t); }
}

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

// ── Adaptadores por proveedor ───────────────────────────────────────────────
// Cada uno: { geocodificar(q), inverso(lat,lng) }, forma normalizada arriba.

// Nominatim (OSM público o self-hosted). LocationIQ es compatible con esta misma API.
function adaptadorNominatim(base, key) {
  const auth = key ? `&key=${encodeURIComponent(key)}` : '';
  const corto = (s) => (s || '').split(',')[0].trim();
  const dir2 = (s) => (s || '').split(',').slice(0, 2).join(',').trim();
  return {
    async geocodificar(q) {
      const j = await pedir(`${base}/search?format=json&q=${encodeURIComponent(q)}&countrycodes=cl&limit=1&accept-language=es${auth}`, { 'User-Agent': UA });
      const it = Array.isArray(j) ? j[0] : null;
      if (!it) return null;
      const lat = num(it.lat), lng = num(it.lon);
      if (lat == null || lng == null) return null;
      return { lat, lng, nombre: corto(it.display_name) || q };
    },
    async inverso(lat, lng) {
      const j = await pedir(`${base}/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=es&zoom=18${auth}`, { 'User-Agent': UA });
      if (!j || !j.display_name) return null;
      return { direccion: dir2(j.display_name) };
    },
  };
}

// MapTiler Geocoding API (usa la misma MAPTILER_KEY del mapa).
function adaptadorMapTiler(key) {
  const k = encodeURIComponent(key);
  return {
    async geocodificar(q) {
      const j = await pedir(`https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${k}&country=cl&language=es&limit=1`, { 'User-Agent': UA });
      const f = j?.features?.[0];
      if (!f || !Array.isArray(f.center)) return null;
      const lng = num(f.center[0]), lat = num(f.center[1]);
      if (lat == null || lng == null) return null;
      return { lat, lng, nombre: (f.text || f.place_name || q) };
    },
    async inverso(lat, lng) {
      const j = await pedir(`https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${k}&language=es`, { 'User-Agent': UA });
      const f = j?.features?.[0];
      if (!f) return null;
      return { direccion: (f.place_name || f.text || '').split(',').slice(0, 2).join(',').trim() };
    },
  };
}

// Elige el adaptador según GEOCODER (una sola vez, al cargar el módulo).
function elegirAdaptador() {
  if (PROVIDER === 'maptiler') {
    const key = (process.env.MAPTILER_KEY || '').trim();
    if (key) return adaptadorMapTiler(key);
    console.warn('[geocoder] GEOCODER=maptiler pero falta MAPTILER_KEY → caigo a Nominatim público');
  }
  if (PROVIDER === 'locationiq') {
    const key = (process.env.LOCATIONIQ_KEY || '').trim();
    if (key) return adaptadorNominatim('https://us1.locationiq.com/v1', key);
    console.warn('[geocoder] GEOCODER=locationiq pero falta LOCATIONIQ_KEY → caigo a Nominatim público');
  }
  // Default: Nominatim, público o self-hosted (NOMINATIM_URL).
  const base = (process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/+$/, '');
  return adaptadorNominatim(base, '');
}

const ADAPTADOR = elegirAdaptador();

// Nombre del proveedor efectivo (para el log de arranque).
export const geocoderInfo = (() => {
  if (PROVIDER === 'maptiler' && process.env.MAPTILER_KEY) return 'MapTiler';
  if (PROVIDER === 'locationiq' && process.env.LOCATIONIQ_KEY) return 'LocationIQ';
  const base = process.env.NOMINATIM_URL ? 'Nominatim self-host' : 'Nominatim público (solo piloto/dev)';
  return base;
})();

// API pública del módulo (lo que usa el servidor).
export async function geocodificar(q) {
  const t = (q || '').trim();
  if (t.length < 2) return null;
  return ADAPTADOR.geocodificar(t);
}
export async function geocodificarInverso(lat, lng) {
  const la = num(lat), ln = num(lng);
  if (la == null || ln == null) return null;
  return ADAPTADOR.inverso(la, ln);
}
