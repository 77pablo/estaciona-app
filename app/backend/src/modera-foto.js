// ============================================================================
// Estaciona — Moderación automática de fotos (Sightengine, en el servidor)
// ----------------------------------------------------------------------------
// Antes de guardar una foto subida, se consulta a Sightengine para bloquear
// contenido no permitido: desnudos, DROGAS, ARMAS y gore/violencia. Cubre lo
// que la IA del navegador (nsfwjs) no puede detectar (drogas/armas) y sirve de
// respaldo si alguien intenta saltarse la revisión del cliente. SIN dependencias
// externas: usa node:https y arma el multipart/form-data a mano.
//
// Credenciales (NO van en el repo, que es público):
//   - Railway: variables  SIGHTENGINE_USER  y  SIGHTENGINE_SECRET
//   - Local:   archivo  app/backend/sightengine.key  con  "usuario:secreto"
// Sin credenciales => la revisión del servidor se omite (deja pasar; la IA del
// navegador sigue filtrando desnudos). Capa gratis de Sightengine: ~2.000/mes.
// ============================================================================

import https from 'node:https';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Lee usuario/secreto desde variables de entorno o, si no, del archivo local.
function credenciales() {
  let user = (process.env.SIGHTENGINE_USER || '').trim();
  let secret = (process.env.SIGHTENGINE_SECRET || '').trim();
  if (!user || !secret) {
    try {
      const txt = readFileSync(join(__dirname, '..', 'sightengine.key'), 'utf8').trim();
      const i = txt.indexOf(':');
      if (i > 0) { user = txt.slice(0, i).trim(); secret = txt.slice(i + 1).trim(); }
    } catch { /* sin archivo: queda sin credenciales */ }
  }
  return user && secret ? { user, secret } : null;
}

const MODELS = 'nudity-2.1,weapon,drug,gore-2.0';
const ENDPOINT = 'https://api.sightengine.com/1.0/check.json';

// POST multipart/form-data a Sightengine con el buffer de la imagen.
function consultar(buf, ext, cred) {
  return new Promise((resolve, reject) => {
    const boundary = '----estaciona' + randomBytes(8).toString('hex');
    const campo = (nombre, valor) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${nombre}"\r\n\r\n${valor}\r\n`;
    const pre = Buffer.from(
      campo('models', MODELS) + campo('api_user', cred.user) + campo('api_secret', cred.secret) +
      `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="foto.${ext}"\r\n` +
      `Content-Type: image/${ext === 'jpg' ? 'jpeg' : ext}\r\n\r\n`, 'utf8');
    const post = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const body = Buffer.concat([pre, buf, post]);
    const req = https.request(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
      timeout: 8000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('respuesta no JSON')); } });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end(body);
  });
}

// ¿Se permite guardar fotos SIN moderación de servidor? Por defecto NO (fail-closed):
// aceptar fotos sin revisar deja un hueco por el que alguien puede subir contenido
// ilegal por POST directo (saltándose la IA del navegador) y quedaría servido público.
// Poner FOTOS_SIN_MODERAR=1 solo si se asume ese riesgo a conciencia.
const PERMITIR_SIN_MODERAR = /^(1|true|si|s[ií]|yes)$/i.test(process.env.FOTOS_SIN_MODERAR || '');

// Revisa un dataUrl de imagen. Devuelve { ok:true } o { ok:false, motivo, code }.
// FAIL-CLOSED: si la moderación no está configurada o la API falla/tarda, se
// RECHAZA la foto (code:'no-disponible') en vez de dejarla pasar. Así ningún
// contenido queda almacenado y servido sin haber sido revisado. El usuario ve
// "no pudimos verificar la foto, intenta más tarde".
export async function revisarFoto(dataUrl) {
  const cred = credenciales();
  if (!cred) {
    if (PERMITIR_SIN_MODERAR) return { ok: true };     // opt-in explícito y a riesgo del operador
    return { ok: false, code: 'no-config', motivo: 'la subida de fotos no está disponible por ahora' };
  }
  const m = String(dataUrl || '').match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return { ok: false, code: 'formato', motivo: 'formato de imagen no válido' };
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const buf = Buffer.from(m[2], 'base64');
  try {
    const r = await consultar(buf, ext, cred);
    if (r.status !== 'success') { console.error('Sightengine:', r.error || r); return { ok: false, code: 'no-disponible', motivo: 'no pudimos verificar la foto, intenta más tarde' }; }
    const n = r.nudity || {};
    const adulto = Math.max(n.sexual_activity || 0, n.sexual_display || 0, n.erotica || 0);
    const arma = Math.max(r.weapon?.classes?.firearm || 0, r.weapon?.classes?.knife || 0);
    const droga = r.recreational_drug?.prob || 0;
    const gore = r.gore?.prob || 0;
    if (adulto > 0.5) return { ok: false, code: 'bloqueada', motivo: 'contenido para adultos' };
    if (droga > 0.5)  return { ok: false, code: 'bloqueada', motivo: 'drogas' };
    if (arma > 0.5)   return { ok: false, code: 'bloqueada', motivo: 'armas' };
    if (gore > 0.5)   return { ok: false, code: 'bloqueada', motivo: 'violencia explícita' };
    return { ok: true };
  } catch (e) {
    console.error('Sightengine error:', e.message);
    return { ok: false, code: 'no-disponible', motivo: 'no pudimos verificar la foto, intenta más tarde' };  // fail-CLOSED
  }
}
