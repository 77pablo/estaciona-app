// ============================================================================
// Estaciona — Adaptador de almacenamiento (SQL)
// ----------------------------------------------------------------------------
// Hoy usa SQLite INTEGRADO de Node (node:sqlite) — sin dependencias npm, un solo
// archivo. La interfaz es ASYNC (run/all/get devuelven Promesas) a propósito:
// el día que se necesite escalar a varios servidores, se cambia este archivo por
// una implementación de Postgres (pg, que es async) SIN tocar los stores.
//
// Si SQLite no estuviera disponible, la app NO se cae: queda `ready=false` y los
// stores operan en memoria (sin persistencia) avisando en logs.
//
// Persistencia: env SQLITE_PATH (apuntar al volumen de Railway, ej.
// /data/estaciona.sqlite); si no, archivo local junto al backend.
// ============================================================================

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = process.env.SQLITE_PATH || join(__dirname, '..', 'estaciona.sqlite');

let sdb = null;
export let ready = false;

try {
  const { DatabaseSync } = await import('node:sqlite');
  try { mkdirSync(dirname(FILE), { recursive: true }); } catch { /* dir ya existe / no escribible */ }
  sdb = new DatabaseSync(FILE);
  sdb.exec('PRAGMA journal_mode = WAL;');     // mejor concurrencia lectura/escritura
  sdb.exec('PRAGMA busy_timeout = 4000;');    // espera si está ocupado en vez de fallar
  sdb.exec(`
    CREATE TABLE IF NOT EXISTS votos (id TEXT, ok INTEGER, ts INTEGER);
    CREATE INDEX IF NOT EXISTS ix_votos_ts ON votos(ts);
    CREATE INDEX IF NOT EXISTS ix_votos_id ON votos(id);

    CREATE TABLE IF NOT EXISTS aportes (id TEXT, precio INTEGER, texto TEXT, ts INTEGER);
    CREATE INDEX IF NOT EXISTS ix_aportes_id ON aportes(id);

    CREATE TABLE IF NOT EXISTS lugares (id TEXT PRIMARY KEY, ciudad TEXT, nombre TEXT, lat REAL, lng REAL, json TEXT, ts INTEGER);
    CREATE INDEX IF NOT EXISTS ix_lugares_ciudad ON lugares(ciudad);

    CREATE TABLE IF NOT EXISTS destacados (id TEXT PRIMARY KEY, etiqueta TEXT, premium INTEGER, tagline TEXT, hasta INTEGER, ts INTEGER);

    CREATE TABLE IF NOT EXISTS an_evento (tipo TEXT PRIMARY KEY, n INTEGER);
    CREATE TABLE IF NOT EXISTS an_dia (dia TEXT, tipo TEXT, n INTEGER, PRIMARY KEY (dia, tipo));
    CREATE TABLE IF NOT EXISTS an_ciudad (ciudad TEXT PRIMARY KEY, n INTEGER);
  `);
  ready = true;
  console.log(`  Base de datos: SQLite → ${FILE}`);
} catch (e) {
  console.warn(`[db] SQLite no disponible (${e.message}) — los datos NO persisten (modo memoria)`);
}

// Helpers async (envuelven node:sqlite, que es síncrono). Mañana, para Postgres,
// solo cambian estas 3 funciones por la versión con `pg` (mismo contrato).
export async function run(sql, params = []) { if (!ready) return; sdb.prepare(sql).run(...params); }
export async function all(sql, params = []) { if (!ready) return []; return sdb.prepare(sql).all(...params); }
export async function get(sql, params = []) { if (!ready) return null; return sdb.prepare(sql).get(...params) ?? null; }
