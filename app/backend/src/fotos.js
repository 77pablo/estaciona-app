// ============================================================================
// Estaciona — FOTOS subidas por la gente (Fase 3)
// ----------------------------------------------------------------------------
// Las fotos se guardan como archivos en disco. Para que PERSISTAN en Railway
// hay que apuntar FOTOS_DIR a un volumen (ej. /data/fotos). El cliente comprime
// la imagen antes de subir (canvas), así llegan livianas (~100-300KB).
// ============================================================================

import { writeFile, mkdir, readdir, rm, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const FOTOS_DIR = process.env.FOTOS_DIR || join(__dirname, '..', 'fotos');

const MAX_BYTES = 700 * 1024;     // ~700KB por foto (ya viene comprimida del cliente)
const MAX_POR_LUGAR = 8;          // máximo de fotos por estacionamiento
const slugId = (id) => String(id || '').replace(/[^a-z0-9-]/gi, '');   // evita path traversal

// Guarda una foto (data URL base64). Devuelve la URL pública o null si inválida.
export async function guardarFoto(id, dataUrl) {
  const sid = slugId(id);
  if (!sid || typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 500 || buf.length > MAX_BYTES) return null;
  const dir = join(FOTOS_DIR, sid);
  await mkdir(dir, { recursive: true });
  // Si ya hay el máximo, borra la(s) más antigua(s).
  const files = (await readdir(dir).catch(() => [])).filter((f) => /\.(jpg|png|webp)$/i.test(f)).sort();
  while (files.length >= MAX_POR_LUGAR) { await rm(join(dir, files.shift())).catch(() => {}); }
  const ext = m[1] === 'png' ? 'png' : m[1] === 'webp' ? 'webp' : 'jpg';
  const name = `${Date.now()}.${ext}`;
  await writeFile(join(dir, name), buf);
  return `/fotos/${sid}/${name}`;
}

// Lista de URLs de fotos de un lugar (más nuevas primero).
export async function fotosDe(id) {
  const sid = slugId(id);
  try {
    const files = (await readdir(join(FOTOS_DIR, sid))).filter((f) => /\.(jpg|png|webp)$/i.test(f)).sort().reverse();
    return files.map((f) => `/fotos/${sid}/${f}`);
  } catch { return []; }
}

// --- Moderación ---
// Fotos recientes de TODO el país (para el panel admin). Máx n.
export async function fotosRecientes(n = 80) {
  const out = [];
  try {
    const dirs = await readdir(FOTOS_DIR);
    for (const sid of dirs) {
      const files = await readdir(join(FOTOS_DIR, sid)).catch(() => []);
      for (const f of files) {
        if (!/\.(jpg|png|webp)$/i.test(f)) continue;
        out.push({ id: sid, url: `/fotos/${sid}/${f}`, file: f, ts: parseInt(f, 10) || 0 });
      }
    }
  } catch { /* sin carpeta aún */ }
  return out.sort((a, b) => b.ts - a.ts).slice(0, n);
}
// Borra una foto (id del lugar + archivo). Devuelve true si la borró.
export async function eliminarFoto(id, file) {
  const sid = slugId(id);
  const f = String(file || '').replace(/[^a-z0-9._-]/gi, '');
  if (!sid || !/\.(jpg|png|webp)$/i.test(f)) return false;
  try { await rm(join(FOTOS_DIR, sid, f)); return true; } catch { return false; }
}

// Sirve el archivo de una foto (ruta /fotos/<id>/<archivo>), seguro contra traversal.
export async function servirFoto(res, urlPath) {
  const partes = urlPath.replace(/^\/fotos\//, '').split('/');
  if (partes.length !== 2) { res.writeHead(404); res.end(); return; }
  const sid = slugId(partes[0]);
  const file = partes[1].replace(/[^a-z0-9._-]/gi, '');
  if (!sid || !/\.(jpg|png|webp)$/i.test(file)) { res.writeHead(404); res.end(); return; }
  try {
    const data = await readFile(join(FOTOS_DIR, sid, file));
    const tipo = extname(file).toLowerCase() === '.png' ? 'image/png' : extname(file).toLowerCase() === '.webp' ? 'image/webp' : 'image/jpeg';
    res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'public, max-age=86400' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
}
