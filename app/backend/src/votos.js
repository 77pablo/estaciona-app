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

// Carga idempotente: se cachea la promesa, así dos votos casi simultáneos en el
// primer arranque comparten la MISMA carga (sin ventana de carrera que pierda votos).
function cargar() {
  return cargaPromise ??= readFile(FILE, 'utf8')
    .then((txt) => { votos = JSON.parse(txt) || []; })
    .catch(() => { votos = []; });
}
async function guardar() {
  // Escritura atómica: escribe a un .tmp y renombra (rename es atómico en el
  // mismo disco). Evita que un corte a mitad de escritura deje el JSON corrupto
  // y borre todos los votos.
  const tmp = FILE + '.tmp';
  try {
    if (!_dirOk) { await mkdir(dirname(FILE), { recursive: true }); _dirOk = true; }   // crea el dir del volumen si falta
    await writeFile(tmp, JSON.stringify(votos)); await rename(tmp, FILE);
  } catch (e) {
    // Disco no escribible: seguimos en memoria, pero avisamos UNA vez para que se
    // note en los logs de Railway si el volumen quedó mal montado (no persiste).
    if (!_avisoFallo) { _avisoFallo = true; console.warn(`[votos] no pude escribir en ${FILE}: ${e.message} — los votos NO persisten`); }
  }
}

// Registra un voto (ok = true → "había cupo"; false → "no había").
export async function registrarVoto(id, ok) {
  await cargar();
  if (!id || typeof id !== 'string') return;
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
