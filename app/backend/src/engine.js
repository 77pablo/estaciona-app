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
import { mapaCorrecciones } from './correcciones.js';
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

// Correcciones de campos (dirección/nombre/coords) SIN marcar verificado: arreglan
// un dato erróneo de OSM cuando no tenemos su precio confirmado.
const CORR = mapaCorrecciones();
for (const e of FICHAS) {
  const c = CORR[e.id];
  if (c) { const { id, ...campos } = c; Object.assign(e, campos); }
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

// ── Búsqueda nacional por texto (una sola caja para todo Chile) ─────────────
// Normaliza (minúsculas + sin acentos) para comparar sin importar tildes/mayúsc.
function norm(s) { return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

// Índice liviano precalculado UNA vez (nombre/dirección/ciudad normalizados) para
// no re-normalizar las ~1700 fichas en cada búsqueda.
const INDICE_BUSQUEDA = FICHAS.map((e) => ({
  e, nom: norm(e.nombre), dir: norm(e.direccion), ciu: norm(e.ciudad),
}));

// Busca en TODO el dataset por nombre/dirección/ciudad y devuelve las mejores
// coincidencias (livianas: solo lo que la sugerencia necesita para mostrarse y
// saltar a esa ficha). Ranking: nombre-empieza > nombre-contiene > ciudad-empieza
// > dirección/ciudad-contiene; a igual score, primero los verificados y el nombre
// más corto (más específico). Solo el catálogo fijo (OSM + fichas-extra); los
// lugares aportados por la comunidad son por-ciudad y no entran aquí.
export function buscarFichas(q, limit = 24) {
  const t = norm(q).trim();
  if (t.length < 2) return [];
  const res = [];
  for (const it of INDICE_BUSQUEDA) {
    let score;
    if (it.nom.startsWith(t)) score = 0;
    else if (it.nom.includes(t)) score = 1;
    else if (it.ciu.startsWith(t)) score = 2;
    else if (it.ciu.includes(t) || it.dir.includes(t)) score = 3;
    else continue;
    res.push({ it, score });
  }
  res.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (!!b.it.e.verificado !== !!a.it.e.verificado) return b.it.e.verificado ? 1 : -1;
    return a.it.nom.length - b.it.nom.length;
  });
  return res.slice(0, limit).map(({ it }) => {
    const e = it.e;
    return {
      id: e.id, nombre: e.nombre, ciudad: e.ciudad, region: e.region,
      direccion: e.direccion, tipo: e.tipo, categoria: e.categoria,
      precioHora: e.precioHora, precioMin: e.precioMin, gratisInfo: e.gratis,
      verificado: !!e.verificado, lat: e.lat, lng: e.lng,
    };
  });
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
      telefono: e.telefono, web: e.web,   // contacto (datos oficiales verificados, si hay)
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
        disponibilidad: { fuente: 'estimacion', nivel, label },
      };
    }
  });
}

// Umbral de FRESCURA del reporte de la gente (minutos): un reporte más nuevo que
// esto puede mandar sobre la estimación; más viejo, el cupo ya pudo cambiar
// demasiado para confiar en él como "cupo ahora".
export const FRESCA_MIN = 45;
// Umbral del score ponderado para que la señal de la gente MANDE. 0.5 permite que
// UN reporte reciente y claro alcance (un voto recién dado pesa ~1), pero exige
// corroboración si el único voto ya tiene rato, o si hay "hay"/"no hay" en conflicto.
export const UMBRAL_SENAL = 0.5;

// Resuelve la disponibilidad final tomando la MEJOR fuente disponible, en orden:
//   1) live       → ocupación REAL de un operador (B2B). Manda siempre.
//   2) gente      → reporte fresco y claro de usuarios (crowdsourcing). Manda
//                   sobre la estimación, salvo que el horario lo dé por cerrado
//                   (no inventamos que abrió).
//   3) estimacion → el semáforo por hora/día (fallback actual, siempre presente).
// `base`  = disponibilidad estimada de shapeFichas.
// `senal` = senalReciente()[id] (o undefined) — votos ponderados por frescura.
// `live`  = { libres, minAgo, umbralBajo? } de un operador (o null/undefined hoy).
// Conteo REAL de fichas base por ciudad (incluye TODO lo que se sirve por
// defecto: dataset + calles con parquímetro + fichas extra). Sirve para que el
// contador del selector de ciudades coincida con lo que muestra la lista (antes
// ZONAS traía un `cantidad` horneado que dejaba fuera las calles → el selector
// decía "Temuco (34)" mientras la lista mostraba "39 en Temuco").
export function conteoPorCiudad() {
  const m = {};
  for (const f of FICHAS) if (f.ciudad) m[f.ciudad] = (m[f.ciudad] || 0) + 1;
  return m;
}

export function resolverDisponibilidad(base, senal, live) {
  // 1) Operador en vivo: dato real de cupos.
  if (live && Number.isFinite(live.libres)) {
    const nivel = live.libres <= 0 ? 'rojo' : live.libres < (live.umbralBajo ?? 5) ? 'amarillo' : 'verde';
    return { fuente: 'live', nivel, label: live.libres > 0 ? `${live.libres} cupos libres` : 'Sin cupos ahora', libres: live.libres, minAgo: Math.max(0, Math.round(live.minAgo ?? 0)) };
  }
  // 2) Reporte fresco de la gente (no aplica si el horario lo da por cerrado).
  if (base.nivel !== 'cerrado' && senal && senal.ultimoTs) {
    const minAgo = Math.round((Date.now() - senal.ultimoTs) / 60000);
    if (minAgo >= 0 && minAgo <= FRESCA_MIN) {
      const score = (senal.wUp || 0) - (senal.wDown || 0);   // >0 tiende a "hay", <0 a "no hay"
      if (score >= UMBRAL_SENAL) return { fuente: 'gente', nivel: 'verde', label: 'Cupo confirmado', minAgo, up: senal.up || 0, down: senal.down || 0 };
      if (score <= -UMBRAL_SENAL) return { fuente: 'gente', nivel: 'rojo', label: 'Reportan sin cupo', minAgo, up: senal.up || 0, down: senal.down || 0 };
      // señal débil o en conflicto → no manda: sigue la estimación.
    }
  }
  // 3) Estimación.
  return base;
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
