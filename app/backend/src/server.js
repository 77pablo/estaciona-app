// ============================================================================
// Estaciona — Servidor HTTP (node:http nativo, SIN dependencias externas)
// ----------------------------------------------------------------------------
// Sirve el frontend (web/) y expone la lista de estacionamientos con su
// disponibilidad en vivo.
//
// Correr:  node src/server.js   →  http://localhost:4000
// ============================================================================

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';

import { snapshotCiudad, shapeFichas, curvaDisponibilidad, idExiste } from './engine.js';
import { registrarReporte, reportesRecientes, eliminarReporte, contarReportes } from './reportes.js';
import { CENTRO, ZONAS, REGIONES } from './data.js';
import { registrarVoto, tallyReciente, contarVotos } from './votos.js';
import { registrarAporte, resumenAportes, aportesDe, comentariosRecientes, eliminarAporte, preciosReportados } from './aportes.js';
import { guardarFoto, fotosDe, servirFoto, fotosRecientes, eliminarFoto, validarFoto } from './fotos.js';
import { r2Enabled } from './r2.js';
import { registrarLugar, lugaresDe, lugaresRecientes, eliminarLugar, contarLugares, lugarExiste } from './lugares.js';
import { registrarEvento, resumenAnalytics, vistasLugar } from './analytics.js';
import { agregarDestacado, quitarDestacado, mapaDestacados, listarDestacados } from './destacados.js';
import { revisarFoto } from './modera-foto.js';
import { ready as dbReady, backend as dbBackend } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = join(__dirname, '..', '..', 'web');
const PORT = process.env.PORT || 4000;

// Key de MapTiler: la variable de entorno (Railway) manda; si no, se lee del
// archivo local `app/backend/maptiler.key` (ignorado por git) para correr en
// el PC sin tener que setear variables. Vacío => el mapa usa tiles de OSM.
function leerKey(envName, file) {
  if (process.env[envName]) return process.env[envName].trim();
  try { return readFileSync(join(__dirname, '..', file), 'utf8').trim(); }
  catch { return ''; }
}
const MAPTILER_KEY = leerKey('MAPTILER_KEY', 'maptiler.key');
const TOMTOM_KEY = leerKey('TOMTOM_KEY', 'tomtom.key');   // tráfico en vivo + ETA real

// Clave de acceso (modo privado mientras se pule la app). Si la variable de
// entorno ACCESO_CLAVE está puesta (en Railway), la app pide usuario/clave al
// entrar (HTTP Basic Auth) y solo deja pasar a quien la sepa. Si está vacía
// (ej. en local), la app queda abierta sin fricción. Para abrirla al público:
// borrar la variable ACCESO_CLAVE en Railway.
const ACCESO_CLAVE = (process.env.ACCESO_CLAVE || '').trim();
// Clave de MODERACIÓN (solo Abel). Para borrar comentarios/fotos en /admin.
const ADMIN_CLAVE = leerKey('ADMIN_CLAVE', 'admin.key');
// Códigos de "Estaciona Pro" (plan premium para conductores). Abel los reparte
// tras cobrar (sin pasarela). Env PRO_CODES="codigo1,codigo2" o archivo pro-codes.key.
const PRO_CODES = new Set(leerKey('PRO_CODES', 'pro-codes.key').split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean));
// Comparación de claves en tiempo CONSTANTE (no filtra la longitud/contenido por
// timing). Longitudes distintas => false sin comparar byte a byte.
function claveIgual(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
// Clave admin: SOLO por header (x-mod-clave). Ya NO se acepta ?clave= en la URL,
// que la filtraba a logs de acceso, historial del navegador y el header Referer
// hacia las CDNs de mapas/moderación. El panel /admin ya manda el header.
const esAdmin = (req) => !!ADMIN_CLAVE && claveIgual(req.headers['x-mod-clave'] || '', ADMIN_CLAVE);
function autorizado(req) {
  if (!ACCESO_CLAVE) return true;                 // sin clave configurada => app pública
  const m = (req.headers.authorization || '').match(/^Basic\s+(.+)$/i);
  if (!m) return false;
  const dec = Buffer.from(m[1], 'base64').toString('utf8');   // "usuario:clave"
  const clave = dec.slice(dec.indexOf(':') + 1);              // ignora el usuario, compara la clave
  return claveIgual(clave, ACCESO_CLAVE);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

// Lee el cuerpo de un POST acumulando Buffers y decodificando UTF-8 UNA sola vez.
// (Con `body += chunk` cada chunk se decodifica solo, así que un carácter multibyte
// —ñ, tilde, emoji— partido entre dos chunks TCP se corrompe.) Drena SIEMPRE hasta
// 'end' y resuelve ahí; NUNCA destruye el socket a mitad de subida (eso provoca un
// reset y el cliente no recibe la respuesta). `maxBytes` corta lo que se almacena
// (no la lectura), y se reporta con `tooBig` para responder 413 en el handler.
function readBody(req, maxBytes) {
  return new Promise((resolve) => {
    const chunks = []; let size = 0, tooBig = false;
    req.on('data', (c) => { if (tooBig) return; size += c.length; if (size > maxBytes) { tooBig = true; return; } chunks.push(c); });
    req.on('end', () => resolve({ tooBig, body: Buffer.concat(chunks).toString('utf8') }));
    req.on('error', () => resolve({ tooBig: false, body: '' }));
  });
}

// Rate-limit simple en memoria por IP (ventana deslizante). Defensa anti-spam del
// endpoint que escribe al mapa público (reportar lugar). No es a prueba de balas
// (la moderación en /admin es la última línea), pero frena floods accidentales/básicos.
const _ipHits = new Map();
function rateLimit(req, max, ventanaMs) {
  // El cliente puede falsificar X-Forwarded-For; el valor confiable es el ÚLTIMO
  // (el que agrega el proxy de Railway), no el primero. Si no hay, la IP del socket.
  const xff = (req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ip = xff.length ? xff[xff.length - 1] : (req.socket.remoteAddress || 'x');
  const ahora = Date.now();
  const arr = (_ipHits.get(ip) || []).filter((t) => ahora - t < ventanaMs);
  arr.push(ahora);
  _ipHits.set(ip, arr);
  if (_ipHits.size > 5000) for (const [k, v] of _ipHits) if (!v.some((t) => ahora - t < ventanaMs)) _ipHits.delete(k);   // poda entradas viejas
  return arr.length <= max;
}

// Anti fuerza-bruta de la clave admin: cuenta intentos FALLIDOS por IP y bloquea
// si hay demasiados en la ventana (la clave admin es la única defensa de /admin).
const _adminFails = new Map();
function ipDe(req) {
  const xff = (req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  return xff.length ? xff[xff.length - 1] : (req.socket.remoteAddress || 'x');   // el ÚLTIMO XFF lo pone el proxy (no falsificable)
}
function adminBloqueado(req) {
  const ip = ipDe(req), ahora = Date.now();
  const arr = (_adminFails.get(ip) || []).filter((t) => ahora - t < 300000);   // ventana 5 min
  _adminFails.set(ip, arr);
  return arr.length >= 15;     // ≥15 fallos en 5 min ⇒ bloqueado un rato
}
function adminFallo(req) {
  const ip = ipDe(req);
  const arr = _adminFails.get(ip) || [];
  arr.push(Date.now());
  _adminFails.set(ip, arr);
  if (_adminFails.size > 5000) for (const [k, v] of _adminFails) if (!v.length) _adminFails.delete(k);
}

// Agregados de TODO el país (votos recientes, precios/comentarios, destacados).
// Son iguales para todas las ciudades y requests, y su cálculo recorre tablas
// completas → se cachean unos segundos para que un flood de requests al home NO
// dispare un escaneo por cada uno (amplificación de DoS). Se refresca al vencer.
let _agg = { t: 0, tally: null, com: null, dest: null };
async function agregados() {
  const ahora = Date.now();
  if (_agg.com && ahora - _agg.t < 15000) return _agg;   // válido 15 s
  _agg = { t: ahora, tally: await tallyReciente(3), com: await resumenAportes(), dest: await mapaDestacados() };
  return _agg;
}

// Rutas "bonitas": la landing es la portada (/), la app vive en /app.
const ALIAS = { '/': '/landing.html', '/app': '/index.html', '/app/': '/index.html', '/admin': '/admin.html', '/terminos': '/terminos.html', '/privacidad': '/privacidad.html', '/operadores': '/operadores.html', '/pro': '/pro.html' };

async function serveStatic(res, urlPath) {
  const rel = ALIAS[urlPath] || urlPath;
  const safe = normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(WEB_DIR, safe);
  if (!filePath.startsWith(WEB_DIR)) { res.writeHead(403); res.end('Prohibido'); return; }
  try {
    const data = await readFile(filePath);
    // 'no-cache' = el navegador puede guardar el archivo, pero SIEMPRE revalida
    // con el servidor antes de usarlo. Evita que se quede pegado con CSS/JS
    // viejos tras un cambio (causa típica de "no veo el rediseño").
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
  }
}

const server = http.createServer(async (req, res) => {
  req.on('error', () => {});   // aborto/corte del cliente a mitad de subida: no tumbar el server
  // Cabeceras de seguridad en TODAS las respuestas:
  //  · nosniff        → el navegador no adivina el tipo de contenido (anti-XSS)
  //  · no-referrer    → no se filtra la URL (ni ?clave= ni las keys de mapas) a terceros
  //  · DENY framing   → anti clickjacking
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    // Modo privado: si hay clave configurada, exige autenticación antes de TODO.
    if (!autorizado(req)) {
      res.writeHead(401, {
        'WWW-Authenticate': 'Basic realm="Estaciona (privado)", charset="UTF-8"',
        'Content-Type': 'text/plain; charset=utf-8',
      });
      res.end('Acceso privado — ingresa la clave (el usuario puede ir en blanco).');
      return;
    }
    if (url.pathname === '/api/estacionamientos' && req.method === 'GET') {
      // Nacional: se devuelve SOLO la ciudad pedida (o Temuco por defecto), para
      // no enviar miles de registros. Las zonas (ligeras) van siempre.
      const ciudad = url.searchParams.get('ciudad') || CENTRO.nombre;
      const base = snapshotCiudad(ciudad);                       // solo esa ciudad (filtra antes de dar forma)
      const reportados = shapeFichas(await lugaresDe(ciudad));   // lugares aportados por la gente
      const lista = [...base, ...reportados];
      const { tally, com, dest } = await agregados();  // votos + precios/comentarios + destacados (cacheados)
      for (const e of lista) {
        if (tally[e.id]) e.votos = tally[e.id];
        if (com[e.id]) e.comunidad = com[e.id];
        if (dest[e.id]) { e.destacado = true; e.destacadoEtiqueta = dest[e.id].etiqueta; e.destacadoPremium = dest[e.id].premium; e.destacadoTagline = dest[e.id].tagline; }
      }
      return sendJSON(res, 200, { centro: CENTRO, zonas: ZONAS, regiones: REGIONES, estacionamientos: lista });
    }
    if (url.pathname === '/api/aporte' && req.method === 'POST') {
      const okRate = rateLimit(req, 20, 600000);   // máx 20 aportes / 10 min por IP (anti-spam)
      const { tooBig, body } = await readBody(req, 20000);
      if (!okRate) return sendJSON(res, 429, { ok: false, error: 'rate' });
      if (tooBig) return sendJSON(res, 413, { error: 'cuerpo demasiado grande' });
      try {
        const { id, precio, texto } = JSON.parse(body || '{}');
        const ok = await registrarAporte(id, precio, texto);
        sendJSON(res, ok ? 200 : 400, { ok });
      } catch { sendJSON(res, 400, { error: 'json inválido' }); }
      return;
    }
    if (url.pathname === '/api/aportes' && req.method === 'GET') {
      const id = url.searchParams.get('id') || '';
      return sendJSON(res, 200, await aportesDe(id));
    }
    if (url.pathname === '/api/curva' && req.method === 'GET') {
      // Curva de disponibilidad estimada por hora (beneficio Pro "mejor hora para ir").
      // Mismo modelo que el semáforo; null si el id no está en el dataset.
      const c = curvaDisponibilidad(url.searchParams.get('id') || '');
      return sendJSON(res, c ? 200 : 404, c || { error: 'sin curva' });
    }
    if (url.pathname === '/api/reporte' && req.method === 'POST') {
      // Reportar que una ficha está mal (cerrada/no existe/precio/datos). Crowdsource
      // de corrección: se revisa en /admin. Rate-limit anti-spam por IP.
      const okRate = rateLimit(req, 20, 600000);   // máx 20 reportes / 10 min por IP
      const { tooBig, body } = await readBody(req, 2000);
      if (!okRate) return sendJSON(res, 429, { ok: false, error: 'rate' });
      if (tooBig) return sendJSON(res, 413, { ok: false });
      try {
        const { id, motivo } = JSON.parse(body || '{}');
        const ok = await registrarReporte(id, motivo);
        sendJSON(res, ok ? 200 : 400, { ok });
      } catch { sendJSON(res, 400, { ok: false }); }
      return;
    }
    if (url.pathname === '/api/foto' && req.method === 'POST') {
      const okRate = rateLimit(req, 15, 600000);   // máx 15 fotos / 10 min por IP (anti-spam; suben pesadas)
      const { tooBig, body } = await readBody(req, 3_000_000);   // tope ~3MB (el cliente muestra "muy pesada")
      if (!okRate) return sendJSON(res, 429, { ok: false, error: 'rate' });
      if (tooBig) return sendJSON(res, 413, { ok: false });
      try {
        const { id, dataUrl } = JSON.parse(body || '{}');
        // El id DEBE ser un estacionamiento real (del dataset) o un lugar reportado
        // existente. Sin esto, alguien podía subir fotos a millones de ids inventados
        // y llenar el disco (cada id crea su carpeta). Se valida antes de nada.
        if (!idExiste(id) && !(await lugarExiste(id))) { sendJSON(res, 400, { ok: false, error: 'lugar' }); return; }
        // Validar formato + tamaño ANTES de moderar: así una imagen inválida o
        // >700KB no gasta una llamada de Sightengine (cuota gratis ~2.000/mes).
        if (!validarFoto(dataUrl)) { sendJSON(res, 400, { ok: false }); return; }
        const rev = await revisarFoto(dataUrl);     // moderación automática (Sightengine, fail-closed)
        if (!rev.ok) {
          // 'bloqueada' = la IA la rechazó (contenido no permitido) → 422.
          // 'no-disponible'/'no-config' = no se pudo verificar → 503 (reintentable),
          // NO se guarda (fail-closed): nunca servimos una foto sin revisar.
          const st = rev.code === 'bloqueada' ? 422 : rev.code === 'formato' ? 400 : 503;
          sendJSON(res, st, { ok: false, motivo: rev.motivo });
          return;
        }
        const foto = await guardarFoto(id, dataUrl);
        sendJSON(res, foto ? 200 : 400, { ok: !!foto, url: foto });
      } catch { sendJSON(res, 400, { ok: false }); }
      return;
    }
    if (url.pathname === '/api/fotos' && req.method === 'GET') {
      return sendJSON(res, 200, { fotos: await fotosDe(url.searchParams.get('id') || '') });
    }
    if (url.pathname.startsWith('/fotos/') && req.method === 'GET') {
      return await servirFoto(res, url.pathname);
    }
    if (url.pathname === '/api/mod/feed' && req.method === 'GET') {
      if (adminBloqueado(req)) return sendJSON(res, 429, { error: 'demasiados intentos, espera unos minutos' });
      if (!esAdmin(req)) { adminFallo(req); return sendJSON(res, 403, { error: 'no autorizado' }); }
      return sendJSON(res, 200, {
        comentarios: await comentariosRecientes(),
        fotos: await fotosRecientes(),
        precios: await preciosReportados(),
        lugares: await lugaresRecientes(),
        reportes: await reportesRecientes(),
        nVotos: await contarVotos(),
        nLugares: await contarLugares(),
        nReportes: await contarReportes(),
        analytics: await resumenAnalytics(),
        destacados: await listarDestacados(),
        vistasLugar: await vistasLugar(),
      });
    }
    if (url.pathname === '/api/mod/borrar' && req.method === 'POST') {
      if (adminBloqueado(req)) return sendJSON(res, 429, { error: 'demasiados intentos' });
      if (!esAdmin(req)) { adminFallo(req); return sendJSON(res, 403, { error: 'no autorizado' }); }
      const { tooBig, body } = await readBody(req, 10000);
      if (tooBig) return sendJSON(res, 413, { error: 'cuerpo demasiado grande' });
      try {
        const { tipo, id, ts, file } = JSON.parse(body || '{}');
        let ok = false;
        if (tipo === 'comentario') ok = (await eliminarAporte(id, ts)) > 0;
        else if (tipo === 'foto') ok = await eliminarFoto(id, file);
        else if (tipo === 'lugar') ok = await eliminarLugar(id);
        else if (tipo === 'reporte') ok = (await eliminarReporte(id, ts)) > 0;
        sendJSON(res, ok ? 200 : 400, { ok });
      } catch { sendJSON(res, 400, { ok: false }); }
      return;
    }
    if (url.pathname === '/api/mod/destacado' && req.method === 'POST') {
      if (adminBloqueado(req)) return sendJSON(res, 429, { error: 'demasiados intentos' });
      if (!esAdmin(req)) { adminFallo(req); return sendJSON(res, 403, { error: 'no autorizado' }); }
      const { tooBig, body } = await readBody(req, 4000);
      if (tooBig) return sendJSON(res, 413, { ok: false });
      try {
        const { accion, id, etiqueta, dias, premium, tagline } = JSON.parse(body || '{}');
        let r;
        if (accion === 'remove') r = { ok: await quitarDestacado(id) };
        else r = await agregarDestacado(id, etiqueta, dias, premium, tagline);
        sendJSON(res, r.ok ? 200 : 400, r);
      } catch { sendJSON(res, 400, { ok: false }); }
      return;
    }
    if (url.pathname === '/api/voto' && req.method === 'POST') {
      const okRate = rateLimit(req, 40, 600000);   // máx 40 votos / 10 min por IP (anti-spam)
      const { tooBig, body } = await readBody(req, 10000);
      if (!okRate) return sendJSON(res, 429, { error: 'rate' });
      if (tooBig) return sendJSON(res, 413, { error: 'cuerpo demasiado grande' });
      try {
        const { id, ok } = JSON.parse(body || '{}');
        const guardado = await registrarVoto(id, ok);
        sendJSON(res, guardado ? 200 : 400, { ok: guardado });
      } catch { sendJSON(res, 400, { error: 'json inválido' }); }
      return;
    }
    if (url.pathname === '/api/lugar' && req.method === 'POST') {
      // Reportar un estacionamiento que falta (crowdsource estilo Waze).
      const okRate = rateLimit(req, 12, 600000);   // máx 12 reportes / 10 min por IP
      const { tooBig, body } = await readBody(req, 4000);
      if (!okRate) return sendJSON(res, 429, { ok: false, error: 'rate' });
      if (tooBig) return sendJSON(res, 413, { ok: false, error: 'cuerpo demasiado grande' });
      try {
        const r = await registrarLugar(JSON.parse(body || '{}'));
        sendJSON(res, r.ok ? 200 : 400, r);
      } catch { sendJSON(res, 400, { ok: false, error: 'json inválido' }); }
      return;
    }
    if (url.pathname === '/api/track' && req.method === 'POST') {
      // Estadística de uso ANÓNIMA (conteo). Sin IP, sin cookies. Responde rápido.
      // Rate-limit por IP para que los números NO se puedan inflar (defienden la
      // analítica que se le muestra a un operador). Al exceder, se descarta en silencio.
      const okRate = rateLimit(req, 120, 60000);   // máx 120 eventos / min por IP
      const { tooBig, body } = await readBody(req, 1000);
      if (okRate && !tooBig) {
        try { const { tipo, ciudad, id } = JSON.parse(body || '{}'); await registrarEvento(tipo, ciudad, id); } catch { /* ignora payloads inválidos */ }
      }
      res.writeHead(204); res.end();   // sin contenido: es fire-and-forget
      return;
    }
    if (url.pathname === '/api/pro/activar' && req.method === 'POST') {
      // Activar Estaciona Pro con un código (lo entrega Abel tras cobrar). Sin pasarela.
      const okRate = rateLimit(req, 20, 600000);   // freno anti fuerza-bruta de códigos
      const { tooBig, body } = await readBody(req, 500);
      if (!okRate) return sendJSON(res, 429, { ok: false, error: 'rate' });
      if (tooBig) return sendJSON(res, 413, { ok: false });
      try {
        const { codigo } = JSON.parse(body || '{}');
        const ok = PRO_CODES.size > 0 && PRO_CODES.has(String(codigo || '').trim().toLowerCase());
        sendJSON(res, ok ? 200 : 400, { ok });
      } catch { sendJSON(res, 400, { ok: false }); }
      return;
    }
    if (url.pathname === '/api/config' && req.method === 'GET') {
      // Config pública para el frontend. La API key de MapTiler vive en una
      // variable de entorno (NO en el repo, que es público). Si no está, el
      // frontend cae de vuelta a los tiles gratis de OSM.
      return sendJSON(res, 200, { maptilerKey: MAPTILER_KEY, tomtomKey: TOMTOM_KEY });
    }
    if (url.pathname === '/api/health' && req.method === 'GET') {
      // `db:false` => SQLite no cargó: la app responde pero NADA persiste (las
      // escrituras se descartan). Sirve para monitorear que la persistencia esté viva.
      return sendJSON(res, 200, { ok: true, db: dbReady });
    }
    if (req.method === 'GET') return await serveStatic(res, url.pathname);
    res.writeHead(405); res.end('Método no permitido');
  } catch (err) {
    console.error('Error:', err);
    sendJSON(res, 500, { error: 'error interno' });
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  🅿️  Estaciona  🅿️');
  console.log(`  Abre la app en:  http://localhost:${PORT}`);
  console.log('  Ctrl+C para detener.');
  // Persistencia: votos/aportes/lugares/destacados/analítica viven en la base de
  // datos (Postgres administrado si hay DATABASE_URL; si no, SQLite en SQLITE_PATH,
  // que debe apuntar al volumen, ej. /data/estaciona.sqlite). Las fotos van a
  // object storage externo (R2) si hay variables R2_*; si no, a archivos (FOTOS_DIR).
  const persist = (env) => process.env[env] ? `${process.env[env]}  (persiste)` : `local efímero — SE BORRA en redeploy (define ${env})`;
  console.log('  Persistencia:');
  // Refleja el estado REAL del backend: si no cargó, NADA se guarda.
  if (dbReady && dbBackend === 'postgres') console.log('   · base de datos → PostgreSQL administrado vía DATABASE_URL  (persiste, multi-instancia)');
  else if (dbReady) console.log(`   · base de datos → SQLite ${persist('SQLITE_PATH')}`);
  else console.log('   · base de datos → ⚠️  NO cargó: votos/aportes/lugares/analítica NO se guardan (revisa DATABASE_URL / SQLITE_PATH / Node ≥22.5)');
  if (r2Enabled) console.log('   · fotos         → Cloudflare R2 (object storage externo)  (persiste, multi-instancia)');
  else console.log(`   · fotos         → ${persist('FOTOS_DIR')}`);
  console.log('');
});
