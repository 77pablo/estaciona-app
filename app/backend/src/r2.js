// ============================================================================
// Estaciona — Cliente Cloudflare R2 (object storage compatible con S3)
// ----------------------------------------------------------------------------
// Guarda las fotos de la gente en un bucket externo (R2) en vez del disco del
// servidor. Esto DESACOPLA las fotos de una sola instancia: con Postgres (Neon)
// el resto ya escala horizontal, y las fotos eran lo último atado al volumen.
//
// Sin dependencias: se firma cada petición con AWS SigV4 a mano (node:crypto),
// igual que el multipart de Sightengine se armó a mano.
//
// Se ACTIVA solo si están TODAS estas variables de entorno (si no, fotos.js
// sigue usando archivos locales — cero cambios de comportamiento):
//   R2_ACCOUNT_ID          id de cuenta Cloudflare (subdominio de la API S3)
//   R2_ACCESS_KEY_ID       token de acceso R2 (S3 API)
//   R2_SECRET_ACCESS_KEY   secreto del token
//   R2_BUCKET              nombre del bucket
//   R2_PUBLIC_URL          URL pública del bucket (ej. https://pub-xxxx.r2.dev
//                          o un dominio propio con CDN) — desde donde se sirven
//                          las imágenes al navegador (sin firmar, cacheable).
// ============================================================================

import { createHash, createHmac } from 'node:crypto';

const ACCOUNT = process.env.R2_ACCOUNT_ID || '';
const KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const SECRET = process.env.R2_SECRET_ACCESS_KEY || '';
const BUCKET = process.env.R2_BUCKET || '';
const PUBLIC = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');   // sin barra final

export const r2Enabled = !!(ACCOUNT && KEY_ID && SECRET && BUCKET && PUBLIC);

const HOST = `${ACCOUNT}.r2.cloudflarestorage.com`;   // endpoint S3 de R2 (path-style)
const REGION = 'auto';                                 // R2 ignora la región; usa 'auto'
const SERVICE = 's3';

// URL pública de un objeto (lo que ve el navegador). key NO lleva barra inicial.
export function urlPublica(key) {
  return `${PUBLIC}/${key.split('/').map(encPath).join('/')}`;
}

const sha256hex = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

// Codificación RFC 3986 (la que exige SigV4; encodeURIComponent no cubre !*'() ).
function encPath(seg) {
  return encodeURIComponent(seg).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

// Fecha en formato AMZ: 20260701T134908Z + 20260701.
function amzDate() {
  const iso = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');   // 20260701T134908Z
  return { amz: iso, day: iso.slice(0, 8) };
}

// Firma y ejecuta una petición S3 contra R2. Devuelve el objeto Response de fetch.
//  method  'PUT' | 'DELETE' | 'GET'
//  key     ruta del objeto (para list se deja '' y se usa query)
//  body    Buffer/'' (payload)
//  query   objeto {clave: valor} para el query string (list-type, prefix…)
//  headers extra (ej. content-type)
async function s3(method, key, { body = '', query = {}, headers = {} } = {}) {
  const { amz, day } = amzDate();
  const payloadHash = sha256hex(body || '');
  // canonicalURI: /bucket/key (path-style). Cada segmento va codificado; '/' se conserva.
  const canonicalUri = '/' + [BUCKET, ...(key ? key.split('/') : [])].map(encPath).join('/');
  const canonicalQuery = Object.keys(query).sort()
    .map((k) => `${encPath(k)}=${encPath(String(query[k]))}`).join('&');

  const hdrs = {
    host: HOST,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amz,
    ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
  };
  const signedHeaders = Object.keys(hdrs).sort().join(';');
  const canonicalHeaders = Object.keys(hdrs).sort().map((k) => `${k}:${String(hdrs[k]).trim()}\n`).join('');

  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${day}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amz, scope, sha256hex(canonicalRequest)].join('\n');

  // Clave de firma (cadena HMAC).
  let signingKey = hmac('AWS4' + SECRET, day);
  signingKey = hmac(signingKey, REGION);
  signingKey = hmac(signingKey, SERVICE);
  signingKey = hmac(signingKey, 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${KEY_ID}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const qs = canonicalQuery ? `?${canonicalQuery}` : '';
  // 'host' va en la FIRMA pero no se pasa a fetch: undici lo pone solo desde la
  // URL (mismo valor) y algunos runtimes rechazan setear Host a mano.
  const { host, ...fetchHdrs } = hdrs;
  return fetch(`https://${HOST}${canonicalUri}${qs}`, {
    method,
    headers: { ...fetchHdrs, Authorization: authorization },
    body: method === 'GET' || method === 'DELETE' ? undefined : body,
  });
}

// Sube un objeto. Devuelve true si quedó (2xx).
export async function putObject(key, buf, contentType = 'application/octet-stream') {
  const r = await s3('PUT', key, { body: buf, headers: { 'content-type': contentType } });
  return r.ok;
}

// Borra un objeto. Devuelve true si 2xx (R2 responde 204 aunque no exista).
export async function deleteObject(key) {
  const r = await s3('DELETE', key);
  return r.ok;
}

// Lista objetos (ListObjectsV2). Devuelve [{ key }]. Máx 1000 por página; se
// pagina con el continuation-token hasta traer todo lo que haya bajo el prefijo.
// (Para el prefijo de un lugar son ≤8; el listado global del panel /admin puede
// crecer — a gran escala convendría un índice en la DB, ver ESCALAMIENTO.md.)
export async function listObjects(prefix = '') {
  const out = [];
  let token = '';
  do {
    const query = { 'list-type': '2', 'max-keys': '1000' };
    if (prefix) query.prefix = prefix;
    if (token) query['continuation-token'] = token;
    const r = await s3('GET', '', { query });
    if (!r.ok) break;
    const xml = await r.text();
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) out.push({ key: decodeXml(m[1]) });
    const tok = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    token = xml.includes('<IsTruncated>true</IsTruncated>') && tok ? tok[1] : '';
  } while (token);
  return out;
}

function decodeXml(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
