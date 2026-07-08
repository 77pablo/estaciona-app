// ============================================================================
// Estaciona — Verificación de "Continuar con Google" (Google Identity Services)
// ----------------------------------------------------------------------------
// El botón de Google en el frontend devuelve un ID TOKEN (un JWT firmado por
// Google). Aquí lo verificamos EN EL SERVIDOR antes de confiar en él:
//   1. firma RS256 válida contra las llaves públicas de Google (JWKS, cacheadas),
//   2. `aud` == nuestro Client ID (el token es para NUESTRA app, no otra),
//   3. `iss` == accounts.google.com, y no vencido (`exp`).
// Todo con node:crypto — SIN dependencias (crypto.createPublicKey admite JWK).
// Nunca confíes en el email de un id_token sin verificar la firma: cualquiera
// puede fabricar un JWT con el correo de otra persona.
// ============================================================================

import { createPublicKey, verify as cryptoVerify } from 'node:crypto';

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISS_OK = new Set(['accounts.google.com', 'https://accounts.google.com']);

// Caché de llaves (kid -> KeyObject) con expiración según Cache-Control de Google.
let _keys = new Map();
let _keysExp = 0;

async function llaves(forzar = false) {
  const ahora = Date.now();
  if (!forzar && _keys.size && ahora < _keysExp) return _keys;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  let r;
  try { r = await fetch(JWKS_URL, { signal: ctrl.signal }); } finally { clearTimeout(t); }
  if (!r.ok) throw new Error('jwks ' + r.status);
  const j = await r.json();
  const m = new Map();
  for (const k of j.keys || []) {
    try { m.set(k.kid, createPublicKey({ key: k, format: 'jwk' })); } catch { /* llave rara: se salta */ }
  }
  // Respeta max-age del header (Google rota estas llaves); default 1 h.
  const cc = r.headers.get('cache-control') || '';
  const mm = cc.match(/max-age=(\d+)/);
  _keysExp = ahora + (mm ? Math.min(+mm[1], 86400) : 3600) * 1000;
  _keys = m;
  return m;
}

const b64urlJSON = (s) => JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

// Verifica un id_token de Google. Devuelve { email } si es válido y el correo
// está verificado; si no, null. `clientId` es nuestro Client ID de OAuth.
export async function verificarIdTokenGoogle(idToken, clientId) {
  if (!idToken || !clientId || typeof idToken !== 'string') return null;
  const partes = idToken.split('.');
  if (partes.length !== 3) return null;
  let header, payload;
  try { header = b64urlJSON(partes[0]); payload = b64urlJSON(partes[1]); } catch { return null; }
  if (header.alg !== 'RS256' || !header.kid) return null;

  // Busca la llave por kid; si no está (rotó), refresca una vez.
  let ks = await llaves();
  let key = ks.get(header.kid);
  if (!key) { ks = await llaves(true); key = ks.get(header.kid); }
  if (!key) return null;

  // Verifica la firma sobre "header.payload".
  const firmada = Buffer.from(partes[0] + '.' + partes[1]);
  const firma = Buffer.from(partes[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  let ok = false;
  try { ok = cryptoVerify('RSA-SHA256', firmada, key, firma); } catch { return null; }
  if (!ok) return null;

  // Claims: destinatario correcto, emisor Google, no vencido, correo verificado.
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(clientId)) return null;
  if (!ISS_OK.has(payload.iss)) return null;
  const ahora = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < ahora - 60) return null;   // 60s de gracia por reloj
  const emailVerif = payload.email_verified === true || payload.email_verified === 'true';
  if (!payload.email || !emailVerif) return null;
  return { email: String(payload.email).trim().toLowerCase() };
}
