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

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = process.env.VOTOS_PATH || join(__dirname, '..', 'votos.json');

let votos = [];
let cargado = false;

async function cargar() {
  if (cargado) return;
  cargado = true;
  try { votos = JSON.parse(await readFile(FILE, 'utf8')) || []; } catch { votos = []; }
}
async function guardar() {
  try { await writeFile(FILE, JSON.stringify(votos)); } catch { /* disco no escribible: seguimos en memoria */ }
}

// Registra un voto (ok = true → "había cupo"; false → "no había").
export async function registrarVoto(id, ok) {
  await cargar();
  if (!id || typeof id !== 'string') return;
  votos.push({ id, ok: !!ok, ts: Date.now() });
  if (votos.length > 5000) votos = votos.slice(-5000); // poda para no crecer infinito
  await guardar();
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
