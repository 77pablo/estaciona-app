// ============================================================================
// Estaciona — Adaptador de almacenamiento (SQL)
// ----------------------------------------------------------------------------
// Dos backends, MISMO contrato async (run/all/get) → los stores no cambian:
//
//  • PostgreSQL administrado  (si está la env DATABASE_URL): multi-INSTANCIA,
//    para tráfico nacional / varias copias del server compartiendo una sola DB
//    (Neon, Supabase, Railway Postgres…). Async nativo (paquete `pg`).
//  • SQLite integrado de Node (si NO hay DATABASE_URL): sin dependencias, un
//    archivo, ideal para local y para 1 servidor. Persiste en SQLITE_PATH.
//
// El SQL "fuente" que escriben los stores está en dialecto SQLite; para Postgres
// se traduce al vuelo en `toPg()` (placeholders ?→$n, INSERT OR REPLACE/IGNORE
// → ON CONFLICT, rowid → columna serial `seq`). Los enteros grandes de Postgres
// (BIGINT/COUNT/SUM) se devuelven como número, no como string, para no romper
// comparaciones de los stores.
//
// Si NINGÚN backend carga, la app NO se cae: queda `ready=false` y los stores
// operan en memoria (sin persistencia) avisando fuerte en logs y en /api/health.
// ============================================================================

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export let ready = false;
export let backend = 'memoria';   // 'postgres' | 'sqlite' | 'memoria'

// Implementaciones concretas (las llena el backend que cargue).
let _run = async () => ({ changes: 0, lastInsertRowid: 0 });
let _all = async () => [];
let _get = async () => null;

const DATABASE_URL = process.env.DATABASE_URL;

// ---------------------------------------------------------------------------
// Traductor de dialecto SQLite → PostgreSQL (solo se usa en el backend Postgres)
// ---------------------------------------------------------------------------
// Llave primaria de las tablas que usan INSERT OR REPLACE (para el ON CONFLICT).
const PK = { destacados: ['id'], an_evento: ['tipo'], an_dia: ['dia', 'tipo'], an_ciudad: ['ciudad'] };

export function toPg(sql) {
  const mTable = sql.match(/^INSERT(?: OR \w+)? INTO (\w+)/i);
  const table = mTable ? mTable[1] : '';
  // En Postgres, `DO UPDATE SET n = n + 1` es ambiguo (¿columna de la tabla o de
  // EXCLUDED?). Hay que calificar la derecha con el nombre de la tabla. SQLite lo
  // acepta sin calificar; aquí lo calificamos solo para PG.
  if (table) sql = sql.replace(/DO UPDATE SET (\w+) = \1 \+ 1/gi, `DO UPDATE SET $1 = ${table}.$1 + 1`);
  // INSERT OR REPLACE INTO t(cols) VALUES(...)  →  INSERT ... ON CONFLICT (pk) DO UPDATE SET nonpk=EXCLUDED.nonpk
  const mRep = sql.match(/^INSERT OR REPLACE INTO (\w+)\s*\(([^)]+)\)/i);
  if (mRep) {
    const t = mRep[1];
    const cols = mRep[2].split(',').map((c) => c.trim());
    const pk = PK[t] || ['id'];
    const set = cols.filter((c) => !pk.includes(c)).map((c) => `${c}=EXCLUDED.${c}`).join(', ');
    sql = sql.replace(/^INSERT OR REPLACE/i, 'INSERT')
      + (set ? ` ON CONFLICT (${pk.join(', ')}) DO UPDATE SET ${set}` : ` ON CONFLICT (${pk.join(', ')}) DO NOTHING`);
  } else if (/^INSERT OR IGNORE/i.test(sql)) {
    // INSERT OR IGNORE → no pisar la fila existente
    sql = sql.replace(/^INSERT OR IGNORE/i, 'INSERT') + ' ON CONFLICT DO NOTHING';
  }
  // `rowid` no existe en Postgres → usamos la columna serial `seq` (poda de votos/aportes).
  sql = sql.replace(/\browid\b/gi, 'seq');
  // Placeholders posicionales: ? → $1, $2, ...
  let i = 0;
  sql = sql.replace(/\?/g, () => '$' + (++i));
  return sql;
}

// ---------------------------------------------------------------------------
// Backend A: PostgreSQL administrado
// ---------------------------------------------------------------------------
if (DATABASE_URL) {
  try {
    const pg = (await import('pg')).default;
    // BIGINT / COUNT / SUM (OID 20 = int8) vuelven como string por defecto en pg;
    // los convertimos a number para que `row.c > 0`, up/down, ts, etc. sigan siendo números.
    pg.types.setTypeParser(20, (v) => parseInt(v, 10));
    // Neon/Supabase exigen SSL; en un Postgres local (localhost) va sin SSL. Se VERIFICA
    // el certificado del servidor (anti-MITM: sin esto un atacante en la ruta puede
    // presentar su cert, descifrar el tráfico y robar la contraseña de DATABASE_URL).
    // Neon/Supabase usan CAs públicas → validan con el bundle de Node. Si algún proveedor
    // usara un cert que no valide, DB_SSL_NO_VERIFY=1 lo desactiva (menos seguro, documentado).
    const noVerify = process.env.DB_SSL_NO_VERIFY === '1';
    const ssl = /localhost|127\.0\.0\.1|::1/.test(DATABASE_URL) ? false : { rejectUnauthorized: !noVerify };
    const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl, max: 10 });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS votos (seq BIGSERIAL, id TEXT, ok INTEGER, ts BIGINT);
      CREATE INDEX IF NOT EXISTS ix_votos_ts ON votos(ts);
      CREATE INDEX IF NOT EXISTS ix_votos_id ON votos(id);

      CREATE TABLE IF NOT EXISTS aportes (seq BIGSERIAL, id TEXT, precio INTEGER, texto TEXT, ts BIGINT);
      CREATE INDEX IF NOT EXISTS ix_aportes_id ON aportes(id);

      CREATE TABLE IF NOT EXISTS reportes (seq BIGSERIAL, id TEXT, motivo TEXT, ts BIGINT);
      CREATE INDEX IF NOT EXISTS ix_reportes_id ON reportes(id);

      CREATE TABLE IF NOT EXISTS resenas (seq BIGSERIAL, id TEXT, estrellas INTEGER, texto TEXT, ts BIGINT);
      CREATE INDEX IF NOT EXISTS ix_resenas_id ON resenas(id);
      CREATE INDEX IF NOT EXISTS ix_resenas_ts ON resenas(ts);

      CREATE TABLE IF NOT EXISTS lugares (id TEXT PRIMARY KEY, ciudad TEXT, nombre TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION, json TEXT, ts BIGINT);
      CREATE INDEX IF NOT EXISTS ix_lugares_ciudad ON lugares(ciudad);

      CREATE TABLE IF NOT EXISTS destacados (id TEXT PRIMARY KEY, etiqueta TEXT, premium INTEGER, tagline TEXT, hasta BIGINT, ts BIGINT);

      CREATE TABLE IF NOT EXISTS an_evento (tipo TEXT PRIMARY KEY, n BIGINT);
      CREATE TABLE IF NOT EXISTS an_dia (dia TEXT, tipo TEXT, n BIGINT, PRIMARY KEY (dia, tipo));
      CREATE TABLE IF NOT EXISTS an_ciudad (ciudad TEXT PRIMARY KEY, n BIGINT);
      CREATE TABLE IF NOT EXISTS an_lugar (id TEXT, tipo TEXT, n BIGINT, PRIMARY KEY (id, tipo));

      CREATE TABLE IF NOT EXISTS interes_ciudad (seq BIGSERIAL, ciudad TEXT, email TEXT, ts BIGINT);
      CREATE INDEX IF NOT EXISTS ix_interes_ciudad ON interes_ciudad(ciudad);

      CREATE TABLE IF NOT EXISTS operadores (codigo TEXT PRIMARY KEY, id TEXT, nombre TEXT, ts BIGINT);
      CREATE INDEX IF NOT EXISTS ix_operadores_id ON operadores(id);
      CREATE TABLE IF NOT EXISTS cupo_operador (id TEXT PRIMARY KEY, libres INTEGER, umbral INTEGER, ts BIGINT);
    `);
    _run = async (sql, params = []) => { const r = await pool.query(toPg(sql), params); return { changes: r.rowCount, lastInsertRowid: 0 }; };
    _all = async (sql, params = []) => (await pool.query(toPg(sql), params)).rows;
    _get = async (sql, params = []) => (await pool.query(toPg(sql), params)).rows[0] ?? null;
    ready = true;
    backend = 'postgres';
    console.log('  Base de datos: PostgreSQL administrado (multi-instancia)');
  } catch (e) {
    console.warn(`[db] PostgreSQL no disponible (${e.message}) — los datos NO persisten (modo memoria). Revisa DATABASE_URL.`);
  }
}

// ---------------------------------------------------------------------------
// Backend B: SQLite integrado de Node (fallback / local / 1 servidor)
// ---------------------------------------------------------------------------
if (!ready) {
  const FILE = process.env.SQLITE_PATH || join(__dirname, '..', 'estaciona.sqlite');
  try {
    const { DatabaseSync } = await import('node:sqlite');
    try { mkdirSync(dirname(FILE), { recursive: true }); } catch { /* dir ya existe / no escribible */ }
    const sdb = new DatabaseSync(FILE);
    sdb.exec('PRAGMA journal_mode = WAL;');     // mejor concurrencia lectura/escritura
    sdb.exec('PRAGMA busy_timeout = 4000;');    // espera si está ocupado en vez de fallar
    sdb.exec(`
      CREATE TABLE IF NOT EXISTS votos (id TEXT, ok INTEGER, ts INTEGER);
      CREATE INDEX IF NOT EXISTS ix_votos_ts ON votos(ts);
      CREATE INDEX IF NOT EXISTS ix_votos_id ON votos(id);

      CREATE TABLE IF NOT EXISTS aportes (id TEXT, precio INTEGER, texto TEXT, ts INTEGER);
      CREATE INDEX IF NOT EXISTS ix_aportes_id ON aportes(id);

      CREATE TABLE IF NOT EXISTS reportes (id TEXT, motivo TEXT, ts INTEGER);
      CREATE INDEX IF NOT EXISTS ix_reportes_id ON reportes(id);

      CREATE TABLE IF NOT EXISTS resenas (id TEXT, estrellas INTEGER, texto TEXT, ts INTEGER);
      CREATE INDEX IF NOT EXISTS ix_resenas_id ON resenas(id);
      CREATE INDEX IF NOT EXISTS ix_resenas_ts ON resenas(ts);

      CREATE TABLE IF NOT EXISTS lugares (id TEXT PRIMARY KEY, ciudad TEXT, nombre TEXT, lat REAL, lng REAL, json TEXT, ts INTEGER);
      CREATE INDEX IF NOT EXISTS ix_lugares_ciudad ON lugares(ciudad);

      CREATE TABLE IF NOT EXISTS destacados (id TEXT PRIMARY KEY, etiqueta TEXT, premium INTEGER, tagline TEXT, hasta INTEGER, ts INTEGER);

      CREATE TABLE IF NOT EXISTS an_evento (tipo TEXT PRIMARY KEY, n INTEGER);
      CREATE TABLE IF NOT EXISTS an_dia (dia TEXT, tipo TEXT, n INTEGER, PRIMARY KEY (dia, tipo));
      CREATE TABLE IF NOT EXISTS an_ciudad (ciudad TEXT PRIMARY KEY, n INTEGER);
      CREATE TABLE IF NOT EXISTS an_lugar (id TEXT, tipo TEXT, n INTEGER, PRIMARY KEY (id, tipo));

      CREATE TABLE IF NOT EXISTS interes_ciudad (ciudad TEXT, email TEXT, ts INTEGER);
      CREATE INDEX IF NOT EXISTS ix_interes_ciudad ON interes_ciudad(ciudad);

      CREATE TABLE IF NOT EXISTS operadores (codigo TEXT PRIMARY KEY, id TEXT, nombre TEXT, ts INTEGER);
      CREATE INDEX IF NOT EXISTS ix_operadores_id ON operadores(id);
      CREATE TABLE IF NOT EXISTS cupo_operador (id TEXT PRIMARY KEY, libres INTEGER, umbral INTEGER, ts INTEGER);
    `);
    // node:sqlite es síncrono; lo envolvemos en promesas. `run` devuelve el
    // { changes, lastInsertRowid } nativo (sin un 2º query con carrera).
    _run = async (sql, params = []) => sdb.prepare(sql).run(...params);
    _all = async (sql, params = []) => sdb.prepare(sql).all(...params);
    _get = async (sql, params = []) => sdb.prepare(sql).get(...params) ?? null;
    ready = true;
    backend = 'sqlite';
    console.log(`  Base de datos: SQLite → ${FILE}`);
  } catch (e) {
    console.warn(`[db] SQLite no disponible (${e.message}) — los datos NO persisten (modo memoria)`);
  }
}

// Contrato público (idéntico para ambos backends).
export async function run(sql, params = []) { return _run(sql, params); }
export async function all(sql, params = []) { return _all(sql, params); }
export async function get(sql, params = []) { return _get(sql, params); }
