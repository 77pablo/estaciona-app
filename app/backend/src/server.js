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
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';

import { getEstacionamientos } from './engine.js';
import { CENTRO } from './data.js';
import { registrarVoto, tallyReciente } from './votos.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = join(__dirname, '..', '..', 'web');
const PORT = process.env.PORT || 4000;

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

async function serveStatic(res, urlPath) {
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const safe = normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(WEB_DIR, safe);
  if (!filePath.startsWith(WEB_DIR)) { res.writeHead(403); res.end('Prohibido'); return; }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/api/estacionamientos' && req.method === 'GET') {
      const lista = getEstacionamientos();
      const tally = await tallyReciente(3);            // votos de las últimas 3 h
      for (const e of lista) { if (tally[e.id]) e.votos = tally[e.id]; }
      return sendJSON(res, 200, { centro: CENTRO, estacionamientos: lista });
    }
    if (url.pathname === '/api/voto' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 10000) req.destroy(); });
      req.on('end', async () => {
        try {
          const { id, ok } = JSON.parse(body || '{}');
          await registrarVoto(id, ok);
          sendJSON(res, 200, { ok: true });
        } catch { sendJSON(res, 400, { error: 'json inválido' }); }
      });
      return;
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
  console.log('');
});
