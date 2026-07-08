// ============================================================================
// Estaciona — Cuentas de usuario (email + contraseña) y sesiones
// ----------------------------------------------------------------------------
// Da identidad al conductor para que su plan PRO (y sus datos) lo sigan a
// CUALQUIER dispositivo: se registra/entra con correo y clave, y el estado Pro
// queda atado a la CUENTA, no al navegador. Sin dependencias externas:
//   · contraseña con hash scrypt + sal aleatoria (node:crypto), comparación
//     timing-safe (no se guarda la clave en claro nunca).
//   · sesión = token aleatorio guardado en la tabla `sesiones` (revocable al
//     salir); el cliente lo manda en el header `x-sesion`.
// Compatibilidad: quien ya activó Pro con un código en su teléfono (localStorage)
// sigue viéndolo; al crear cuenta puede ligarlo para que viaje entre equipos.
// ============================================================================

import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { run, get } from './db.js';

const scrypt = (clave, sal) => new Promise((res, rej) =>
  _scrypt(clave, sal, 64, (e, dk) => (e ? rej(e) : res(dk))));
// En la DB se guarda el HASH del token de sesión, no el token en claro: si la base
// se filtrara (dump/backup), los tokens no serían usables. El cliente conserva el
// token en claro; al llegar, se hashea y se busca por el hash.
const hashToken = (t) => createHash('sha256').update(String(t)).digest('hex');

const SESION_MS = 180 * 24 * 3600000;   // la sesión dura 180 días sin usarse

// --- Validación / normalización ---------------------------------------------
export function emailValido(email) {
  const e = String(email || '').trim().toLowerCase();
  // Simple y suficiente: algo@algo.algo, sin espacios, largo razonable.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 120 ? e : null;
}
export function claveValida(clave) {
  const c = String(clave ?? '');
  return c.length >= 6 && c.length <= 200 ? c : null;   // mínimo 6, tope anti-DoS
}

// --- Hash de contraseña ------------------------------------------------------
// Formato guardado: "scrypt$<salHex>$<hashHex>". Verificable y auto-descriptivo.
async function hashClave(clave) {
  const sal = randomBytes(16);
  const dk = await scrypt(clave, sal);
  return `scrypt$${sal.toString('hex')}$${dk.toString('hex')}`;
}
async function claveCoincide(clave, guardado) {
  const [algo, salHex, hashHex] = String(guardado || '').split('$');
  if (algo !== 'scrypt' || !salHex || !hashHex) return false;
  const dk = await scrypt(clave, Buffer.from(salHex, 'hex'));
  const esperado = Buffer.from(hashHex, 'hex');
  return dk.length === esperado.length && timingSafeEqual(dk, esperado);
}

// --- Sesiones ----------------------------------------------------------------
async function nuevaSesion(email, ahora) {
  const token = randomBytes(32).toString('hex');
  await run('INSERT INTO sesiones (token, email, ts) VALUES (?, ?, ?)', [hashToken(token), email, ahora]);
  return token;   // el cliente recibe el token en claro; en la DB solo vive su hash
}

// Devuelve la cuenta pública ({ email, pro }) del dueño del token, o null.
// Refresca `ts` (sesión deslizante) y poda las vencidas de paso.
export async function sesion(token, ahora = fecha()) {
  if (!token || typeof token !== 'string' || token.length !== 64) return null;
  const h = hashToken(token);
  const s = await get('SELECT email, ts FROM sesiones WHERE token = ?', [h]);
  if (!s) return null;
  if (ahora - s.ts > SESION_MS) { await run('DELETE FROM sesiones WHERE token = ?', [h]); return null; }
  await run('UPDATE sesiones SET ts = ? WHERE token = ?', [ahora, h]);
  const u = await get('SELECT email, pro FROM usuarios WHERE email = ?', [s.email]);
  return u ? { email: u.email, pro: !!u.pro } : null;
}
export async function salir(token) {
  if (token) await run('DELETE FROM sesiones WHERE token = ?', [hashToken(token)]);
}

// La app pasa la hora (evita depender de Date.now() aquí y facilita tests).
function fecha() { return Date.now(); }

// --- Alta / ingreso ----------------------------------------------------------
// Crea la cuenta. Devuelve { ok, token, email, pro } o { ok:false, error }.
export async function registrar(emailRaw, claveRaw, ahora = fecha()) {
  const email = emailValido(emailRaw);
  const clave = claveValida(claveRaw);
  if (!email) return { ok: false, error: 'email' };
  if (!clave) return { ok: false, error: 'clave' };
  const ya = await get('SELECT email FROM usuarios WHERE email = ?', [email]);
  if (ya) return { ok: false, error: 'existe' };
  const hash = await hashClave(clave);
  await run('INSERT INTO usuarios (email, clave, pro, pro_ts, creado, ts) VALUES (?, ?, 0, 0, ?, ?)', [email, hash, ahora, ahora]);
  const token = await nuevaSesion(email, ahora);
  return { ok: true, token, email, pro: false };
}

// Verifica credenciales y abre sesión. Mensaje de error genérico ('credenciales')
// para no revelar si el correo existe.
export async function entrar(emailRaw, claveRaw, ahora = fecha()) {
  const email = emailValido(emailRaw);
  const clave = claveValida(claveRaw);
  if (!email || !clave) return { ok: false, error: 'credenciales' };
  const u = await get('SELECT email, clave, pro FROM usuarios WHERE email = ?', [email]);
  if (!u || !(await claveCoincide(clave, u.clave))) return { ok: false, error: 'credenciales' };
  const token = await nuevaSesion(email, ahora);
  return { ok: true, token, email, pro: !!u.pro };
}

// Ingreso con Google: el correo ya viene VERIFICADO por Google (la firma del
// token se validó en google-auth.js). Si la cuenta no existe, se crea sin
// contraseña (clave vacía → solo entra por Google, hasta que ponga una); si ya
// existía (por correo+clave o por Google antes), simplemente entra. Mismo correo
// = misma cuenta, así Pro y datos son los mismos por cualquier vía de ingreso.
export async function entrarConGoogle(emailRaw, ahora = fecha()) {
  const email = emailValido(emailRaw);
  if (!email) return { ok: false, error: 'email' };
  let u = await get('SELECT email, pro, clave FROM usuarios WHERE email = ?', [email]);
  let claveReseteada = false;
  if (!u) {
    await run('INSERT INTO usuarios (email, clave, pro, pro_ts, creado, ts) VALUES (?, ?, 0, 0, ?, ?)', [email, '', ahora, ahora]);
    u = { email, pro: 0 };
  } else if (u.clave && u.clave.length) {
    // Anti pre-hijacking: Google PRUEBA que quien entra es el dueño del correo. Si
    // la cuenta tenía una contraseña puesta sin verificación de email, pudo haberla
    // creado un tercero para secuestrarla. La invalidamos y cerramos TODAS sus
    // sesiones; el dueño real entra por Google y puede poner una clave nueva en
    // "Gestionar". (Un login-solo-clave que nunca usó Google no se ve afectado.)
    await run('UPDATE usuarios SET clave = ? WHERE email = ?', ['', email]);
    await run('DELETE FROM sesiones WHERE email = ?', [email]);
    claveReseteada = true;
  }
  const token = await nuevaSesion(email, ahora);
  return { ok: true, token, email, pro: !!u.pro, claveReseteada };
}

// --- Gestión de la cuenta ---------------------------------------------------
// Establece o cambia la contraseña. Si la cuenta YA tenía clave (creada con
// correo+clave), exige la actual; si no tenía (creada con Google), la fija sin
// pedir actual (el usuario ya está autenticado por su sesión). Así una cuenta de
// Google puede además entrar con correo+clave.
export async function cambiarClave(emailRaw, claveNueva, claveActual, ahora = fecha()) {
  const email = emailValido(emailRaw);
  const nueva = claveValida(claveNueva);
  if (!email) return { ok: false, error: 'email' };
  if (!nueva) return { ok: false, error: 'clave' };
  const u = await get('SELECT clave FROM usuarios WHERE email = ?', [email]);
  if (!u) return { ok: false, error: 'no-existe' };
  const teniaClave = !!(u.clave && u.clave.length);
  if (teniaClave && !(await claveCoincide(String(claveActual || ''), u.clave))) return { ok: false, error: 'actual' };
  const hash = await hashClave(nueva);
  await run('UPDATE usuarios SET clave = ?, ts = ? WHERE email = ?', [hash, ahora, email]);
  return { ok: true, teniaClave };
}
// Borra la cuenta y TODO lo asociado (sesiones + datos sincronizados). Derecho de
// eliminación de la Ley 19.628. No borra los aportes anónimos a la comunidad
// (comentarios/fotos/votos) porque no están ligados a la cuenta.
export async function borrarCuenta(emailRaw) {
  const email = emailValido(emailRaw);
  if (!email) return false;
  await run('DELETE FROM usuario_datos WHERE email = ?', [email]);
  await run('DELETE FROM sesiones WHERE email = ?', [email]);
  await run('DELETE FROM usuarios WHERE email = ?', [email]);
  return true;
}

// --- Pro ---------------------------------------------------------------------
// Marca (o desmarca) Pro por correo. Lo usa el canje de código y el panel /admin.
export async function marcarPro(emailRaw, pro, ahora = fecha()) {
  const email = emailValido(emailRaw);
  if (!email) return false;
  const r = await run('UPDATE usuarios SET pro = ?, pro_ts = ? WHERE email = ?', [pro ? 1 : 0, ahora, email]);
  return (r.changes || 0) > 0;
}
export async function esProEmail(emailRaw) {
  const email = emailValido(emailRaw);
  if (!email) return false;
  const u = await get('SELECT pro FROM usuarios WHERE email = ?', [email]);
  return !!(u && u.pro);
}

// --- Sincronización de datos (favoritos, mi auto, historial…) ----------------
// Guarda el blob del usuario (last-write-wins por `ts` del cliente). El servidor
// NO interpreta el contenido: es la copia de respaldo de su localStorage.
const MAX_DATOS = 200 * 1024;   // 200 KB de tope (favoritos/historial son chicos)
export async function guardarDatos(email, obj, ts, ahora = fecha()) {
  if (!email) return false;
  let json;
  try { json = JSON.stringify(obj ?? {}); } catch { return false; }
  if (json.length > MAX_DATOS) return false;
  // El ts viene del cliente; se acota a "ahora" para que un ts futuro absurdo no
  // bloquee sobrescribir desde otro dispositivo (last-write-wins razonable).
  const t = Math.min(Number(ts) || ahora, ahora);
  await run('INSERT OR REPLACE INTO usuario_datos (email, json, ts) VALUES (?, ?, ?)', [email, json, t]);
  return true;
}
export async function leerDatos(email) {
  if (!email) return null;
  const r = await get('SELECT json, ts FROM usuario_datos WHERE email = ?', [email]);
  if (!r) return { datos: null, ts: 0 };
  try { return { datos: JSON.parse(r.json), ts: r.ts || 0 }; } catch { return { datos: null, ts: 0 }; }
}
