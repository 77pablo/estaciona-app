// ============================================================================
// Estaciona — Service Worker (offline + instalable)
// ----------------------------------------------------------------------------
// Estrategia NETWORK-FIRST: siempre intenta la red primero (así online SIEMPRE
// ves la versión más nueva — nunca queda pegado con CSS/JS viejo, coherente con
// el resto de la app) y solo cae al caché cuando NO hay conexión. Guarda a medida
// que navega: la app y la ÚLTIMA ciudad vista quedan disponibles sin señal (útil
// en estacionamientos subterráneos, donde no hay internet).
// ============================================================================

const CACHE = 'estaciona-v2';

// App shell que se precachea al instalar (para que abra offline desde el vamos).
// Incluye Leaflet (servido local): así el mapa carga aunque no haya red — los
// pines se dibujan; solo las teselas de fondo necesitan internet.
const SHELL = [
  '/app', '/app.js', '/styles.css',
  '/vendor/leaflet.js', '/vendor/leaflet.css',
  '/vendor/leaflet.markercluster.js', '/vendor/MarkerCluster.css',
  '/icons/icon-192.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();   // el SW nuevo toma control cuanto antes
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))));
});

self.addEventListener('activate', (e) => {
  // Borra cachés de versiones anteriores (al subir el número CACHE).
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// ¿Vale la pena cachear esta request para offline? Solo GET, y solo cosas cuyo
// valor offline es real y estable. NO se cachea: config/keys, health, tráfico y
// teselas de mapa (dinámicas/con key), ni nada que no sea GET.
function cacheable(req, url) {
  if (req.method !== 'GET') return false;
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin) {
    if (url.pathname === '/api/estacionamientos') return true;          // la ciudad vista → sirve offline
    if (url.pathname.startsWith('/api/')) return false;                 // resto de API: no cachear
    return true;                                                        // estáticos propios (html/js/css/íconos/vendor)
  }
  // CDN de jsdelivr (nsfwjs/tfjs, versionados). Leaflet ya es local (mismo origen).
  return /(^|\.)jsdelivr\.net$/.test(url.hostname);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;                 // POST (votos/reseñas/fotos…): siempre red, sin tocar
  if (!cacheable(req, url)) return;                 // deja pasar normal (maptiler/tomtom/config…)

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        // Sin conexión: usa lo guardado. Para navegaciones, cae a la app cacheada.
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        if (req.mode === 'navigate') return (await cache.match('/app')) || Response.error();
        return Response.error();
      }),
  );
});
