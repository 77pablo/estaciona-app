// ============================================================================
// Estaciona — Votos de la gente ("¿había cupo aquí?") — crowdsource simple.
// ----------------------------------------------------------------------------
// Guarda cada 👍/👎 en un archivo JSON y entrega un conteo reciente por lugar,
// para que la app muestre señales reales de disponibilidad de otros usuarios.
//
// NOTA: en Railway sin volumen, el archivo se reinicia en cada redeploy. Para
// que persista de verdad, montar un volumen y apuntar VOTOS_PATH ahí (como en
// la app de la iglesia con DB_PATH).
// ============================================================================

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = process.env.VOTOS_PATH || join(__dirname, '..', 'votos.json');
let _dirOk = false, _avisoFallo = false;

let votos = [];
let cargaPromise = null;
let _cola = Promise.resolve();   // serializa escrituras (sin carreras sobre el archivo)

// id válido = slug del dataset (sin comillas/símbolos) → evita corromper el JSON
// y cierra inyección por id en el panel admin.
const ID_OK = (id) => typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id);

// Carga idempotente: se cachea la promesa, así dos votos casi simultáneos en el
// primer arranque comparten la MISMA carga (sin ventana de carrera que pierda votos).
function cargar() {
  return cargaPromise ??= readFile(FILE, 'utf8')
    .then((txt) => { votos = JSON.parse(txt) || []; })
    .catch(() => { votos = []; });
}
// Cola: cada escritura corre DESPUÉS de la anterior (aunque alguna falle), con
// .tmp ÚNICO por escritura → evita JSON corrupto → catch→[] → pérdida total.
function guardar() { _cola = _cola.then(escribir, escribir); return _cola; }
async function escribir() {
  const tmp = `${FILE}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  const datos = JSON.stringify(votos);
  try {
    if (!_dirOk) { await mkdir(dirname(FILE), { recursive: true }); _dirOk = true; }   // crea el dir del volumen si falta
    await writeFile(tmp, datos); await rename(tmp, FILE);
  } catch (e) {
    if (!_avisoFallo) { _avisoFallo = true; console.warn(`[votos] no pude escribir en ${FILE}: ${e.message} — los votos NO persisten`); }
  }
}

// Registra un voto (ok = true → "había cupo"; false → "no había").
export async function registrarVoto(id, ok) {
  await cargar();
  if (!ID_OK(id)) return;
  votos.push({ id, ok: !!ok, ts: Date.now() });
  if (votos.length > 5000) votos = votos.slice(-5000); // poda para no crecer infinito
  await guardar();
}

// Total de votos acumulados (para el contador del panel admin / monitoreo).
export async function contarVotos() {
  await cargar();
  return votos.length;
}

// Conteo de votos por lugar en las últimas `horas` horas: { [id]: {up, down} }.
export async function tallyReciente(horas = 3) {
  await cargar();
  const desde = Date.now() - horas * 3600000;
  const map = {};
  for (const v of votos) {
    if (v.ts < desde) continue;
    const m = map[v.id] || (map[v.id] = { up: 0, down: 0 });
    if (v.ok) m.up++; else m.down++;
  }
  return map;
}
