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
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';

import { snapshotCiudad, shapeFichas } from './engine.js';
import { CENTRO, ZONAS, REGIONES } from './data.js';
import { registrarVoto, tallyReciente, contarVotos } from './votos.js';
import { registrarAporte, resumenAportes, aportesDe, comentariosRecientes, eliminarAporte, preciosReportados } from './aportes.js';
import { guardarFoto, fotosDe, servirFoto, fotosRecientes, eliminarFoto } from './fotos.js';
import { registrarLugar, lugaresDe, lugaresRecientes, eliminarLugar, contarLugares } from './lugares.js';
import { registrarEvento, resumenAnalytics } from './analytics.js';
import { agregarDestacado, quitarDestacado, mapaDestacados, listarDestacados } from './destacados.js';
import { revisarFoto } from './modera-foto.js';

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
const esAdmin = (url) => !!ADMIN_CLAVE && url.searchParams.get('clave') === ADMIN_CLAVE;
function autorizado(req) {
  if (!ACCESO_CLAVE) return true;                 // sin clave configurada => app pública
  const m = (req.headers.authorization || '').match(/^Basic\s+(.+)$/i);
  if (!m) return false;
  const dec = Buffer.from(m[1], 'base64').toString('utf8');   // "usuario:clave"
  const clave = dec.slice(dec.indexOf(':') + 1);              // ignora el usuario, compara la clave
  return clave === ACCESO_CLAVE;
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

// Rate-limit simple en memoria por IP (ventana deslizante). Defensa anti-spam del
// endpoint que escribe al mapa público (reportar lugar). No es a prueba de balas
// (la moderación en /admin es la última línea), pero frena floods accidentales/básicos.
const _ipHits = new Map();
function rateLimit(req, max, ventanaMs) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'x';
  const ahora = Date.now();
  const arr = (_ipHits.get(ip) || []).filter((t) => ahora - t < ventanaMs);
  arr.push(ahora);
  _ipHits.set(ip, arr);
  if (_ipHits.size > 5000) for (const [k, v] of _ipHits) if (!v.some((t) => ahora - t < ventanaMs)) _ipHits.delete(k);   // poda entradas viejas
  return arr.length <= max;
}

// Rutas "bonitas": la landing es la portada (/), la app vive en /app.
const ALIAS = { '/': '/landing.html', '/app': '/index.html', '/app/': '/index.html', '/admin': '/admin.html', '/terminos': '/terminos.html', '/privacidad': '/privacidad.html', '/operadores': '/operadores.html' };

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
      const tally = await tallyReciente(3);            // votos de las últimas 3 h
      const com = await resumenAportes();              // precios/comentarios de la gente
      const dest = await mapaDestacados();             // patrocinados activos (publicidad)
      for (const e of lista) {
        if (tally[e.id]) e.votos = tally[e.id];
        if (com[e.id]) e.comunidad = com[e.id];
        if (dest[e.id]) { e.destacado = true; e.destacadoEtiqueta = dest[e.id]; }
      }
      return sendJSON(res, 200, { centro: CENTRO, zonas: ZONAS, regiones: REGIONES, estacionamientos: lista });
    }
    if (url.pathname === '/api/aporte' && req.method === 'POST') {
      let body = '', tooBig = false;
      req.on('data', (c) => { if (tooBig) return; body += c; if (body.length > 20000) tooBig = true; });   // marca y drena; responde en 'end'
      req.on('end', async () => {
        if (tooBig) return sendJSON(res, 413, { error: 'cuerpo demasiado grande' });
        try {
          const { id, precio, texto } = JSON.parse(body || '{}');
          const ok = await registrarAporte(id, precio, texto);
          sendJSON(res, ok ? 200 : 400, { ok });
        } catch { sendJSON(res, 400, { error: 'json inválido' }); }
      });
      return;
    }
    if (url.pathname === '/api/aportes' && req.method === 'GET') {
      const id = url.searchParams.get('id') || '';
      return sendJSON(res, 200, await aportesDe(id));
    }
    if (url.pathname === '/api/foto' && req.method === 'POST') {
      let body = '', tooBig = false;
      req.on('data', (c) => { if (tooBig) return; body += c; if (body.length > 3_000_000) tooBig = true; });   // tope ~3MB; responde en 'end' (el cliente muestra "muy pesada")
      req.on('end', async () => {
        if (tooBig) return sendJSON(res, 413, { ok: false });
        try {
          const { id, dataUrl } = JSON.parse(body || '{}');
          const rev = await revisarFoto(dataUrl);     // moderación automática (Sightengine)
          if (!rev.ok) { sendJSON(res, 422, { ok: false, motivo: rev.motivo }); return; }
          const foto = await guardarFoto(id, dataUrl);
          sendJSON(res, foto ? 200 : 400, { ok: !!foto, url: foto });
        } catch { sendJSON(res, 400, { ok: false }); }
      });
      return;
    }
    if (url.pathname === '/api/fotos' && req.method === 'GET') {
      return sendJSON(res, 200, { fotos: await fotosDe(url.searchParams.get('id') || '') });
    }
    if (url.pathname.startsWith('/fotos/') && req.method === 'GET') {
      return await servirFoto(res, url.pathname);
    }
    if (url.pathname === '/api/mod/feed' && req.method === 'GET') {
      if (!esAdmin(url)) return sendJSON(res, 403, { error: 'no autorizado' });
      return sendJSON(res, 200, {
        comentarios: await comentariosRecientes(),
        fotos: await fotosRecientes(),
        precios: await preciosReportados(),
        lugares: await lugaresRecientes(),
        nVotos: await contarVotos(),
        nLugares: await contarLugares(),
        analytics: await resumenAnalytics(),
        destacados: await listarDestacados(),
      });
    }
    if (url.pathname === '/api/mod/borrar' && req.method === 'POST') {
      if (!esAdmin(url)) return sendJSON(res, 403, { error: 'no autorizado' });
      let body = '', tooBig = false;
      req.on('data', (c) => { if (tooBig) return; body += c; if (body.length > 10000) tooBig = true; });
      req.on('end', async () => {
        if (tooBig) return sendJSON(res, 413, { error: 'cuerpo demasiado grande' });
        try {
          const { tipo, id, ts, file } = JSON.parse(body || '{}');
          let ok = false;
          if (tipo === 'comentario') ok = (await eliminarAporte(id, ts)) > 0;
          else if (tipo === 'foto') ok = await eliminarFoto(id, file);
          else if (tipo === 'lugar') ok = await eliminarLugar(id);
          sendJSON(res, ok ? 200 : 400, { ok });
        } catch { sendJSON(res, 400, { ok: false }); }
      });
      return;
    }
    if (url.pathname === '/api/mod/destacado' && req.method === 'POST') {
      if (!esAdmin(url)) return sendJSON(res, 403, { error: 'no autorizado' });
      let body = '', tooBig = false;
      req.on('data', (c) => { if (tooBig) return; body += c; if (body.length > 4000) tooBig = true; });
      req.on('end', async () => {
        if (tooBig) return sendJSON(res, 413, { ok: false });
        try {
          const { accion, id, etiqueta, dias } = JSON.parse(body || '{}');
          let r;
          if (accion === 'remove') r = { ok: await quitarDestacado(id) };
          else r = await agregarDestacado(id, etiqueta, dias);
          sendJSON(res, r.ok ? 200 : 400, r);
        } catch { sendJSON(res, 400, { ok: false }); }
      });
      return;
    }
    if (url.pathname === '/api/voto' && req.method === 'POST') {
      let body = '', tooBig = false;
      req.on('data', (c) => { if (tooBig) return; body += c; if (body.length > 10000) tooBig = true; });
      req.on('end', async () => {
        if (tooBig) return sendJSON(res, 413, { error: 'cuerpo demasiado grande' });
        try {
          const { id, ok } = JSON.parse(body || '{}');
          await registrarVoto(id, ok);
          sendJSON(res, 200, { ok: true });
        } catch { sendJSON(res, 400, { error: 'json inválido' }); }
      });
      return;
    }
    if (url.pathname === '/api/lugar' && req.method === 'POST') {
      // Reportar un estacionamiento que falta (crowdsource estilo Waze).
      const okRate = rateLimit(req, 12, 600000);   // máx 12 reportes / 10 min por IP
      let body = '', tooBig = false;
      req.on('data', (c) => { if (tooBig) return; body += c; if (body.length > 4000) tooBig = true; });
      req.on('end', async () => {
        if (!okRate) return sendJSON(res, 429, { ok: false, error: 'rate' });
        if (tooBig) return sendJSON(res, 413, { ok: false, error: 'cuerpo demasiado grande' });
        try {
          const r = await registrarLugar(JSON.parse(body || '{}'));
          sendJSON(res, r.ok ? 200 : 400, r);
        } catch { sendJSON(res, 400, { ok: false, error: 'json inválido' }); }
      });
      return;
    }
    if (url.pathname === '/api/track' && req.method === 'POST') {
      // Estadística de uso ANÓNIMA (conteo). Sin IP, sin cookies. Responde rápido.
      let body = '', tooBig = false;
      req.on('data', (c) => { if (tooBig) return; body += c; if (body.length > 1000) tooBig = true; });
      req.on('end', async () => {
        if (!tooBig) {
          try { const { tipo, ciudad } = JSON.parse(body || '{}'); await registrarEvento(tipo, ciudad); } catch { /* ignora payloads inválidos */ }
        }
        res.writeHead(204); res.end();   // sin contenido: es fire-and-forget
      });
      return;
    }
    if (url.pathname === '/api/config' && req.method === 'GET') {
      // Config pública para el frontend. La API key de MapTiler vive en una
      // variable de entorno (NO en el repo, que es público). Si no está, el
      // frontend cae de vuelta a los tiles gratis de OSM.
      return sendJSON(res, 200, { maptilerKey: MAPTILER_KEY, tomtomKey: TOMTOM_KEY });
    }
    if (url.pathname === '/api/health' && req.method === 'GET') {
      return sendJSON(res, 200, { ok: true });
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
  // Dónde persiste cada cosa: si la env var del volumen NO está, se usa el disco
  // efímero del contenedor y se borra en cada redeploy (útil para verlo en Railway).
  const persist = (env) => process.env[env] ? `${process.env[env]}  (persiste)` : `local efímero — SE BORRA en redeploy (define ${env})`;
  console.log('  Persistencia:');
  console.log(`   · votos   → ${persist('VOTOS_PATH')}`);
  console.log(`   · aportes → ${persist('APORTES_PATH')}`);
  console.log(`   · fotos   → ${persist('FOTOS_DIR')}`);
  console.log(`   · lugares → ${persist('LUGARES_PATH')}`);
  console.log(`   · stats   → ${persist('ANALYTICS_PATH')}`);
  console.log(`   · destac. → ${persist('DESTACADOS_PATH')}`);
  console.log('');
});
