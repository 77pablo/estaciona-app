// ============================================================================
// Estaciona — Motor de disponibilidad (estimación honesta)
// ----------------------------------------------------------------------------
// NO inventa "cupos en vivo" (sería mentir: no tenemos acceso a las barreras de
// los operadores). Para TODOS los lugares —privados y calle— calcula una
// ESTIMACIÓN tipo semáforo (verde/amarillo/rojo) según la hora del día y la
// demanda base de esa zona. El front lo rotula siempre como estimación.
// ============================================================================

import { ESTACIONAMIENTOS } from './data.js';
import { mapaPreciosReales } from './precios-reales.js';
import { FICHAS_EXTRA } from './fichas-extra.js';
import { ESTIMACIONES_COMUNA } from './estimaciones-comuna.js';

// Dataset completo = OSM (data.js) + fichas hechas a mano (fichas-extra.js, que
// sobreviven a la regeneración de data.js).
const FICHAS = ESTACIONAMIENTOS.concat(FICHAS_EXTRA);

// Aplica los precios REALES (verificados a mano) encima de los datos base.
// Esa ficha pasa a verificado:true con su precio/horario/fuente confirmados.
const OVERRIDES = mapaPreciosReales();
for (const e of FICHAS) {
  const o = OVERRIDES[e.id];
  if (o) { Object.assign(e, o); e.verificado = true; }
}

// Estimación por comuna: para fichas SIN precio real (verificado:false) y PAGADAS
// (precioHora > 0), reemplaza el estimado genérico por el promedio real de la
// comuna. NO toca verificadas ni gratis; la ficha sigue siendo estimación ("~est.").
for (const e of FICHAS) {
  if (!e.verificado && e.precioHora > 0 && ESTIMACIONES_COMUNA[e.ciudad]) {
    e.precioHora = ESTIMACIONES_COMUNA[e.ciudad];
  }
}

// ── Clasificador de "categoría" por nombre (red de seguridad) ───────────────
// Muchas fichas de OSM NO son parking público general (hospitales, colegios,
// cuarteles, museos…). El frontend usa `categoria` para el filtro "Solo
// públicos". El generador marca ~200 fichas, pero deja pasar casos obvios por
// el nombre. Aquí, de forma CONSERVADORA y SOLO cuando `categoria` está vacía,
// inferimos la categoría desde el nombre con palabras claras (sin adivinar).
// Usa exactamente las categorías que conoce el frontend.
const REGLAS_CATEGORIA = [
  // [categoria, regex]. Se evalúa en orden; gana la primera que calce.
  ['Municipal', /\b(carabineros|comisar[ií]a|bomberos|municipalidad|gobernaci[oó]n|intendencia|registro civil|juzgado|tribunal|cuartel)\b/i],
  ['Salud',     /\b(hospital|cl[ií]nica|cesfam|consultorio|sapu|posta|centro m[eé]dico)\b/i],
  ['Colegio',   /\b(colegio|liceo|escuela|universidad|instituto|inacap|duoc|aiep|campus|jard[ií]n infantil)\b/i],
  ['Cultura',   /\b(museo|teatro|biblioteca|catedral|parroquia|capilla|templo|iglesia)\b/i],
  ['Estadio',   /\b(estadio|gimnasio|polideportivo|complejo deportivo|cancha)\b/i],
  ['Terminal',  /\b(terminal|rodoviario|aeropuerto|estaci[oó]n de (?:buses|trenes|ferrocarril)|estaci[oó]n de buses)\b/i],
  ['Camiones',  /\b(cami[oó]n|camiones|truck)\b/i],
  // Comercio con estacionamiento SOLO-CLIENTES (no es parking público general):
  // supermercados, mejoramiento del hogar, bencineras, farmacias, bancos. Antes se
  // mostraban como si fueran públicos; ahora el filtro "Solo públicos" los oculta y
  // el detalle avisa "uso restringido". NO incluye malls (sí son parking público pago).
  ['Comercio',  /\b(unimarc|santa isabel|l[ií]der|jumbo|tottus|acuenta|mayorista\s*10|alvi|ekono|supermercado|sodimac|homecenter|construmart|imperial|copec|shell|petrobras|enex|terpel|aramco|bencinera|estaci[oó]n de servicio|farmacia|cruz verde|salcobrand|scotiabank|santander|\bbci\b|banco estado|banco de chile)\b/i],
];
function categoriaPorNombre(nombre) {
  const n = nombre || '';
  for (const [cat, re] of REGLAS_CATEGORIA) if (re.test(n)) return cat;
  return null;
}
for (const e of FICHAS) {
  if (e.categoria == null) {
    const c = categoriaPorNombre(e.nombre);
    if (c) e.categoria = c;
  }
}

// Conjunto de IDs válidos del dataset (fichas OSM + hechas a mano). Se usa para
// RECHAZAR fotos/aportes dirigidos a ids inventados (evita que un atacante cree
// millones de carpetas de fotos con ids basura y llene el disco). Los lugares
// aportados por la gente (x-rep-…) se validan aparte contra la base.
const IDS_DATASET = new Set(FICHAS.map((e) => e.id));
export function idExiste(id) { return IDS_DATASET.has(id); }

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// NOTA: NO simulamos "cupos en vivo" (sería inventar un dato real). La
// disponibilidad es una ESTIMACIÓN honesta tipo semáforo según la hora/día.

// Nivel de semáforo a partir de un ratio de disponibilidad 0..1.
function nivelPorRatio(ratio) {
  if (ratio >= 0.35) return 'verde';
  if (ratio >= 0.12) return 'amarillo';
  return 'rojo';
}

// Demanda base del lugar (0 = siempre vacío, 1 = siempre disputado). ES UN PRIOR
// HONESTO, no un dato real de ocupación: se deriva de lo que SÍ sabemos de la ficha
// (tipo, categoría, capacidad). La calle con parquímetro es más disputada que un
// recinto con capacidad; los grandes (malls) tienen más holgura. Antes TODAS las
// fichas sin dato usaban 0.55 (semáforo casi siempre verde e inútil por uniforme).
// Sigue siendo estimación y el front lo rotula como tal.
export function demandaBaseDe(e) {
  if (typeof e.demandaBase === 'number') return e.demandaBase;   // respeta lo explícito
  let d = e.tipo === 'calle' ? 0.72 : 0.5;                       // calle = más contestada
  if (e.categoria === 'Salud') d += 0.12;                        // clínicas/hospitales: alta rotación diurna
  else if (e.categoria === 'Terminal') d += 0.06;               // aeropuertos/terminales
  else if (e.categoria === 'Estadio') d += 0.04;
  if (e.capacidad >= 300) d -= 0.12;                             // mucha capacidad => más holgura
  else if (e.capacidad >= 100) d -= 0.06;
  return clamp(d, 0.2, 0.9);
}

// Factor de demanda de la calle según la hora (0 = vacío, 1 = saturado).
function factorHora(hora, dia) {
  // Domingo (0) o noche: poca demanda.
  if (dia === 0) return 0.2;
  if (hora < 8 || hora >= 21) return 0.25;
  // Horas punta.
  if ((hora >= 8 && hora <= 10) || (hora >= 13 && hora <= 14) || (hora >= 18 && hora <= 20)) return 1.0;
  return 0.6;
}

// ¿Está abierto ahora? (según el campo horario, de forma simple).
function abiertoAhora(e, hora) {
  if (!e.horario || e.horario === '24h' || e.horario === 'Libre') return true;   // sin horario → no asumir cerrado
  const m = e.horario.match(/(\d{1,2}):\d{2}\D+(\d{1,2}):\d{2}/);
  if (!m) return true;
  const desde = Number(m[1]), hasta = Number(m[2]);
  if (desde === hasta) return true;                        // "00:00–00:00" = 24h
  if (hasta < desde) return hora >= desde || hora < hasta; // cruza medianoche
  return hora >= desde && hora < hasta;
}

// ¿Es gratis en este momento? Parsea CUALQUIER rango "HH:MM–HH:MM" del texto
// (robusto: no depende de un horario exacto escrito a mano) + "domingos" + "siempre".
function gratisAhora(e, hora, dia) {
  if (!e.gratis) return false;
  // "Gratis para clientes" NO es gratis libre (solo con compra). El frontend lo
  // rotula "🛒 Solo clientes", así que aquí nunca lo marcamos como gratis ahora.
  if (/cliente/i.test(e.gratis)) return false;
  if (/siempre/i.test(e.gratis)) return true;
  if (/domingo/i.test(e.gratis) && dia === 0) return true;
  const m = e.gratis.match(/(\d{1,2}):\d{2}\D+(\d{1,2}):\d{2}/);
  if (m) {
    const desde = Number(m[1]), hasta = Number(m[2]);
    if (desde > hasta) return hora >= desde || hora < hasta; // cruza medianoche (ej. 20–09)
    return hora >= desde && hora < hasta;
  }
  return false;
}

// Hora y día en zona horaria de Chile (America/Santiago), sin importar dónde
// corra el servidor (ej. Railway en UTC). Evita estimaciones corridas 3-4 h.
function nowChile() {
  // Lee hora/día numéricos directo de Intl (no re-parsear un string de fecha, que
  // en runtimes con ICU recortado daría Invalid Date → NaN → semáforo erróneo).
  const tz = { timeZone: 'America/Santiago' };
  const ahora = new Date();
  const hora = Number(new Intl.DateTimeFormat('en-US', { ...tz, hour: '2-digit', hour12: false }).format(ahora)) % 24;
  const wd = new Intl.DateTimeFormat('en-US', { ...tz, weekday: 'short' }).format(ahora);
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
  return { hora, dia };
}

// Da forma al snapshot que consume el frontend para un conjunto de fichas
// (el dataset base o lugares reportados por la gente — mismo shape).
export function shapeFichas(fichas) {
  const { hora, dia } = nowChile();

  return fichas.map((e) => {
    const abierto = abiertoAhora(e, hora);
    const gratis = gratisAhora(e, hora, dia);
    const base = {
      id: e.id, tipo: e.tipo, ciudad: e.ciudad, region: e.region, categoria: e.categoria, nombre: e.nombre, direccion: e.direccion,
      lat: e.lat, lng: e.lng, precioHora: e.precioHora, precioMin: e.precioMin, fraccion: e.fraccion,
      gratisInfo: e.gratis, gratisAhora: gratis, horario: e.horario,
      abierto, verificado: e.verificado, fuente: e.fuente, atributos: e.atributos,
      reportado: e.reportado || false,   // true = aportado por la comunidad (sin verificar)
    };

    {
      // Estimación honesta por hora: prior por tipo/categoría/capacidad × factor horario.
      const demanda = clamp(demandaBaseDe(e) * factorHora(hora, dia), 0, 1);
      const nivel = !abierto ? 'cerrado' : nivelPorRatio(1 - demanda);
      const label = nivel === 'cerrado' ? 'Cerrado ahora'
        : nivel === 'verde' ? 'Suele haber cupo'
        : nivel === 'amarillo' ? 'Puede costar' : 'Difícil ahora';
      return {
        ...base,
        disponibilidad: { modo: 'estimacion', nivel, label },
      };
    }
  });
}

// Curva de disponibilidad estimada por hora (beneficio Pro: "mejor hora para ir").
// Usa EXACTAMENTE el mismo modelo que el semáforo (nada nuevo/inventado), solo que
// recorriendo las 24 horas del día indicado. Devuelve null si el id no está en el
// dataset (ej. un lugar aportado por la comunidad, que no tiene curva confiable).
export function curvaDisponibilidad(id, diaOverride) {
  const e = FICHAS.find((f) => f.id === id);
  if (!e) return null;
  const dia = Number.isInteger(diaOverride) && diaOverride >= 0 && diaOverride <= 6 ? diaOverride : nowChile().dia;
  const horas = [];
  for (let h = 0; h < 24; h++) {
    const abierto = abiertoAhora(e, h);
    const demanda = clamp(demandaBaseDe(e) * factorHora(h, dia), 0, 1);
    const nivel = !abierto ? 'cerrado' : nivelPorRatio(1 - demanda);
    horas.push({ h, nivel, gratis: gratisAhora(e, h, dia), abierto });
  }
  return { dia, horaActual: nowChile().hora, horas };
}

// Snapshot del dataset completo (compat; el servidor usa snapshotCiudad).
export function getEstacionamientos() {
  return shapeFichas(FICHAS);
}

// Snapshot solo de una ciudad: filtra ANTES de dar forma (no recorre las ~1700
// fichas nacionales en cada request).
export function snapshotCiudad(ciudad) {
  return shapeFichas(FICHAS.filter((e) => e.ciudad === ciudad));
}
