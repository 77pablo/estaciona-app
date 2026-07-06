// ============================================================================
// Estaciona — Service Worker (offline + instalable)
// ----------------------------------------------------------------------------
// Estrategia NETWORK-FIRST: siempre intenta la red primero (así online SIEMPRE
// ves la versión más nueva — nunca queda pegado con CSS/JS viejo, coherente con
// el resto de la app) y solo cae al caché cuando NO hay conexión. Guarda a medida
// que navega: la app y la ÚLTIMA ciudad vista quedan disponibles sin señal (útil
// en estacionamientos subterráneos, donde no hay internet).
// ============================================================================

const CACHE = 'estaciona-v13';

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

// ¿Vale la pena cachear esta request para offline? Solo GET same-origin y solo
// cosas cuyo valor offline es real y estable. NO se cachea: config/keys, health,
// tráfico, teselas (dinámicas/con key), las FOTOS de la comunidad (se moderan y
// borran → no servir una vieja offline; además crecerían sin tope), CDNs cross-
// origin (respuesta opaca, no cacheable de forma útil), ni nada que no sea GET.
function cacheable(req, url) {
  if (req.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;               // cross-origin: dejar pasar (network)
  if (url.pathname === '/api/estacionamientos') return true;           // la ciudad vista → sirve offline
  if (url.pathname.startsWith('/api/')) return false;                  // resto de API: no cachear
  if (url.pathname.startsWith('/fotos/')) return false;                // fotos de la gente: no cachear (se moderan/borran)
  return true;                                                         // estáticos propios (html/js/css/íconos/vendor)
}

// Clave de caché NORMALIZADA. Para /api/estacionamientos ignoramos el parámetro
// `init` (solo pide de más las zonas del selector la 1ª carga; NO cambia los datos
// de la ciudad). Sin esto, guardar/leer no coinciden: en sesión se cachea
// `?ciudad=X` (sin init), pero al reabrir OFFLINE la carga en frío pide
// `?ciudad=X&init=1` → miss → pantalla de error justo en el subterráneo. Con la
// clave normalizada, ambas variantes comparten entrada y la ciudad vista abre offline.
function cacheKey(req, url) {
  if (url.pathname !== '/api/estacionamientos' || !url.search) return req;
  const u = new URL(url.href);
  u.searchParams.delete('init');
  return u.href;
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
          caches.open(CACHE).then((c) => c.put(cacheKey(req, url), copia)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        // Sin conexión: usa lo guardado. Para navegaciones, cae a la app cacheada.
        const cache = await caches.open(CACHE);
        const hit = await cache.match(cacheKey(req, url));
        if (hit) return hit;
        if (req.mode === 'navigate') return (await cache.match('/app')) || Response.error();
        return Response.error();
      }),
  );
});

// Al tocar una notificación (ej. la alarma anti-multa): enfoca la app si ya está
// abierta, o la abre. Así el aviso lleva de vuelta a "Mi auto".
// Push real (background): muestra la notificación que manda el servidor. El
// payload trae { title, body, tag, url }.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = {}; }
  const opts = {
    body: d.body || '', tag: d.tag || 'estaciona', renotify: true,
    icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
    data: { url: d.url || '/app' },
  };
  e.waitUntil(self.registration.showNotification(d.title || 'Estaciona 🅿️', opts));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const cls = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cls) { if (c.url.includes('/app') && 'focus' in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow('/app');
  })());
});
