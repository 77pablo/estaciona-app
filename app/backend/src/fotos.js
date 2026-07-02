// ============================================================================
// Estaciona — FOTOS subidas por la gente (Fase 3)
// ----------------------------------------------------------------------------
// Dos modos, elegidos automáticamente:
//   • R2 (object storage externo) si están las variables R2_* → las fotos viven
//     en Cloudflare R2 y se sirven desde su URL pública/CDN. Esto permite correr
//     VARIAS instancias del servidor (escala nacional): ninguna guarda archivos
//     locales. Ver r2.js y ESCALAMIENTO.md.
//   • Archivos locales (por defecto) si NO hay R2 → se guardan en FOTOS_DIR, que
//     debe apuntar a un volumen (ej. /data/fotos) para persistir en Railway.
// El cliente comprime la imagen antes de subir (canvas), así llegan livianas.
// ============================================================================

import { writeFile, mkdir, readdir, rm, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { r2Enabled, putObject, deleteObject, listObjects, urlPublica } from './r2.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const FOTOS_DIR = process.env.FOTOS_DIR || join(__dirname, '..', 'fotos');

const MAX_BYTES = 700 * 1024;     // ~700KB por foto (ya viene comprimida del cliente)
const MAX_POR_LUGAR = 8;          // máximo de fotos por estacionamiento
const slugId = (id) => String(id || '').replace(/[^a-z0-9-]/gi, '');   // evita path traversal
const esImg = (f) => /\.(jpg|png|webp)$/i.test(f);
const tsDe = (name) => parseInt(name, 10) || 0;                        // el nombre empieza con Date.now()
const ctDe = (ext) => (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');

// Valida el data URL (formato de imagen + tamaño decodificado). Devuelve
// { buf, ext } si es válida, o null. Se usa también en server.js para RECHAZAR
// antes de gastar una llamada de moderación (Sightengine) en algo inválido/pesado.
export function validarFoto(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 500 || buf.length > MAX_BYTES) return null;
  return { buf, ext: m[1] === 'png' ? 'png' : m[1] === 'webp' ? 'webp' : 'jpg' };
}

// Guarda una foto (data URL base64). Devuelve la URL pública o null si inválida.
export async function guardarFoto(id, dataUrl) {
  const sid = slugId(id);
  if (!sid) return null;
  const v = validarFoto(dataUrl);
  if (!v) return null;
  const name = `${Date.now()}.${v.ext}`;

  if (r2Enabled) {
    // Si ya está el máximo, borra la(s) más antigua(s) del prefijo del lugar.
    const keys = (await listObjects(`${sid}/`).catch(() => []))
      .map((o) => o.key).filter((k) => esImg(k)).sort();   // orden = ts asc (nombre)
    while (keys.length >= MAX_POR_LUGAR) { await deleteObject(keys.shift()).catch(() => {}); }
    const key = `${sid}/${name}`;
    const ok = await putObject(key, v.buf, ctDe(v.ext)).catch(() => false);
    return ok ? urlPublica(key) : null;
  }

  // --- modo local ---
  const dir = join(FOTOS_DIR, sid);
  await mkdir(dir, { recursive: true });
  const files = (await readdir(dir).catch(() => [])).filter(esImg).sort();
  while (files.length >= MAX_POR_LUGAR) { await rm(join(dir, files.shift())).catch(() => {}); }
  await writeFile(join(dir, name), v.buf);
  return `/fotos/${sid}/${name}`;
}

// Lista de URLs de fotos de un lugar (más nuevas primero).
export async function fotosDe(id) {
  const sid = slugId(id);
  if (!sid) return [];
  if (r2Enabled) {
    const keys = (await listObjects(`${sid}/`).catch(() => []))
      .map((o) => o.key).filter((k) => esImg(k))
      .sort((a, b) => tsDe(b.split('/').pop()) - tsDe(a.split('/').pop()));
    return keys.map((k) => urlPublica(k));
  }
  try {
    const files = (await readdir(join(FOTOS_DIR, sid))).filter(esImg).sort().reverse();
    return files.map((f) => `/fotos/${sid}/${f}`);
  } catch { return []; }
}

// --- Moderación ---
// Fotos recientes de TODO el país (para el panel admin). Máx n.
export async function fotosRecientes(n = 80) {
  const out = [];
  if (r2Enabled) {
    const keys = (await listObjects('').catch(() => [])).map((o) => o.key).filter(esImg);
    for (const key of keys) {
      const i = key.indexOf('/');
      if (i < 1) continue;
      const sid = key.slice(0, i);
      const file = key.slice(i + 1);
      out.push({ id: sid, url: urlPublica(key), file, ts: tsDe(file) });
    }
    return out.sort((a, b) => b.ts - a.ts).slice(0, n);
  }
  try {
    const dirs = await readdir(FOTOS_DIR);
    for (const sid of dirs) {
      const files = await readdir(join(FOTOS_DIR, sid)).catch(() => []);
      for (const f of files) {
        if (!esImg(f)) continue;
        out.push({ id: sid, url: `/fotos/${sid}/${f}`, file: f, ts: tsDe(f) });
      }
    }
  } catch { /* sin carpeta aún */ }
  return out.sort((a, b) => b.ts - a.ts).slice(0, n);
}

// Borra una foto (id del lugar + archivo). Devuelve true si la borró.
export async function eliminarFoto(id, file) {
  const sid = slugId(id);
  const f = String(file || '').replace(/[^a-z0-9._-]/gi, '');
  if (!sid || !esImg(f)) return false;
  if (r2Enabled) return await deleteObject(`${sid}/${f}`).catch(() => false);
  try { await rm(join(FOTOS_DIR, sid, f)); return true; } catch { return false; }
}

// Sirve el archivo de una foto (ruta /fotos/<id>/<archivo>), seguro contra traversal.
// Solo se usa en modo LOCAL: con R2 las URLs apuntan al dominio público del bucket
// y el navegador las pide directo (esta ruta ni se toca).
export async function servirFoto(res, urlPath) {
  const partes = urlPath.replace(/^\/fotos\//, '').split('/');
  if (partes.length !== 2) { res.writeHead(404); res.end(); return; }
  const sid = slugId(partes[0]);
  const file = partes[1].replace(/[^a-z0-9._-]/gi, '');
  if (!sid || !esImg(file)) { res.writeHead(404); res.end(); return; }
  try {
    const data = await readFile(join(FOTOS_DIR, sid, file));
    const tipo = extname(file).toLowerCase() === '.png' ? 'image/png' : extname(file).toLowerCase() === '.webp' ? 'image/webp' : 'image/jpeg';
    res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'public, max-age=86400' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
}
