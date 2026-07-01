// ============================================================================
// Estaciona — Lugares reportados por la gente (crowdsource) — ahora en SQLite.
// ----------------------------------------------------------------------------
// Persiste en la base (db.js). Migra automáticamente lugares.json si existe.
// La ficha completa se guarda como JSON; lat/lng/ciudad/nombre van también en
// columnas para filtrar por ciudad y detectar duplicados.
// ============================================================================

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ZONAS } from './data.js';
import { ready, run, all, get } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ZONA_POR_NOMBRE = {};
for (const z of ZONAS) ZONA_POR_NOMBRE[z.nombre] = z;

const normNombre = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
// Quita '<' '>' y caracteres de control de lo que sube la gente (nombre/dirección):
// texto plano seguro de mostrar en la app y en /admin, aunque el frontend escape.
const limpiarTexto = (s) => String(s == null ? '' : s).replace(/[<>]/g, '').replace(/[\x00-\x1f\x7f]/g, ' ');
function distM(aLat, aLng, bLat, bLng) {
  const dLat = (aLat - bLat) * 111000;
  const dLng = (aLng - bLng) * 111000 * Math.cos(aLat * Math.PI / 180);
  return Math.hypot(dLat, dLng);
}

// Migración cacheada en una promesa (corre UNA vez aunque haya requests concurrentes).
let _migP = null;
function migrar() {
  return _migP || (_migP = (async () => {
    if (!ready) return;
    const row = await get('SELECT COUNT(*) AS c FROM lugares');
    if (row && row.c > 0) return;
    try {
      const arr = JSON.parse(await readFile(process.env.LUGARES_PATH || join(__dirname, '..', 'lugares.json'), 'utf8'));
      for (const l of arr) if (l && l.id) await run('INSERT OR IGNORE INTO lugares(id, ciudad, nombre, lat, lng, json, ts) VALUES(?, ?, ?, ?, ?, ?, ?)', [l.id, l.ciudad, l.nombre, l.lat, l.lng, JSON.stringify(l), l.ts || Date.now()]);
      console.log(`[lugares] migrados ${arr.length} desde JSON a SQLite`);
    } catch { /* sin JSON: nada que migrar */ }
  })());
}

// Cola en memoria: SERIALIZA los registros para que el "chequear duplicado →
// insertar" no tenga carrera entre dos POST concurrentes (que insertarían el mismo
// lugar dos veces). En una sola instancia cierra la ventana por completo.
let _cola = Promise.resolve();

// Registra un lugar reportado. Devuelve { ok, id } o { ok:false, error }.
export function registrarLugar(d) {
  const p = _cola.then(() => _registrarLugar(d));
  _cola = p.catch(() => {});   // la cola sigue viva aunque uno falle
  return p;
}

async function _registrarLugar(d) {
  await migrar();
  if (!ready) return { ok: false, error: 'db' };       // DB no cargó: no fingir que se guardó
  d = d || {};
  const nombre = limpiarTexto(d.nombre).trim().replace(/\s+/g, ' ').slice(0, 80);
  if (nombre.length < 2) return { ok: false, error: 'nombre' };
  const lat = Number(d.lat), lng = Number(d.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -56 || lat > -17 || lng < -110 || lng > -66) return { ok: false, error: 'ubicacion' };
  const ciudad = String(d.ciudad ?? '');
  const zona = ZONA_POR_NOMBRE[ciudad];
  if (!zona) return { ok: false, error: 'ciudad' };
  const tipo = d.tipo === 'calle' ? 'calle' : 'privado';
  const gratis = !!d.gratis;
  let precioHora = null;
  if (!gratis && d.precioHora != null && d.precioHora !== '') {
    const ph = Number(d.precioHora);
    if (Number.isFinite(ph) && ph > 0 && ph <= 20000) precioHora = Math.round(ph);
  }
  const direccion = limpiarTexto(d.direccion).trim().slice(0, 120) || `${ciudad} (reportado)`;
  // Dedupe: mismo nombre normalizado a <60 m en esa ciudad.
  const nn = normNombre(nombre);
  const candidatos = await all('SELECT nombre, lat, lng FROM lugares WHERE ciudad = ?', [ciudad]);
  if (candidatos.some((l) => normNombre(l.nombre) === nn && distM(lat, lng, l.lat, l.lng) < 60)) return { ok: false, error: 'duplicado' };
  const ts = Date.now();
  const id = `x-rep-${ts}-${Math.random().toString(36).slice(2, 7)}`;
  const ficha = {
    id, tipo, ciudad, region: zona.region, categoria: null, nombre, direccion,
    lat, lng, precioHora: gratis ? 0 : precioHora, precioMin: null, fraccion: null,
    gratis: gratis ? 'Gratis siempre' : null, horario: null,
    verificado: false, fuente: null,
    atributos: { techado: false, ev: false, accesible: false, camaras: false },
    reportado: true, ts,
  };
  await run('INSERT INTO lugares(id, ciudad, nombre, lat, lng, json, ts) VALUES(?, ?, ?, ?, ?, ?, ?)', [id, ciudad, nombre, lat, lng, JSON.stringify(ficha), ts]);
  return { ok: true, id };
}

// ¿Existe un lugar reportado con este id? (para validar fotos dirigidas a él).
export async function lugarExiste(id) {
  if (typeof id !== 'string' || !/^x-rep-\d{10,}-[a-z0-9]{3,8}$/.test(id)) return false;
  await migrar();
  if (!ready) return false;
  const r = await get('SELECT 1 AS x FROM lugares WHERE id = ?', [id]);
  return !!r;
}

// Fichas reportadas de una ciudad (para fusionarlas con el dataset).
export async function lugaresDe(ciudad) {
  await migrar();
  const rows = await all('SELECT json FROM lugares WHERE ciudad = ?', [ciudad]);
  return rows.map((r) => { try { return JSON.parse(r.json); } catch { return null; } }).filter(Boolean);
}
// Lista reciente para el panel de moderación.
export async function lugaresRecientes(n = 80) {
  await migrar();
  const rows = await all('SELECT json FROM lugares ORDER BY ts DESC LIMIT ?', [n]);
  return rows.map((r) => { try { const l = JSON.parse(r.json); return { id: l.id, nombre: l.nombre, ciudad: l.ciudad, direccion: l.direccion, lat: l.lat, lng: l.lng, gratis: l.precioHora === 0, precioHora: l.precioHora, ts: l.ts }; } catch { return null; } }).filter(Boolean);
}
// Total acumulado.
export async function contarLugares() {
  await migrar();
  const r = await get('SELECT COUNT(*) AS c FROM lugares');
  return r ? r.c : 0;
}
// Elimina un lugar reportado por id (moderación). Devuelve true si borró algo.
export async function eliminarLugar(id) {
  await migrar();
  const r = await run('DELETE FROM lugares WHERE id = ?', [id]);
  return r.changes > 0;
}
