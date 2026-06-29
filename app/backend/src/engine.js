// ============================================================================
// Estaciona — Motor de disponibilidad (en vivo)
// ----------------------------------------------------------------------------
// - Privados: simula cupos libres que cambian con el tiempo (como si vinieran
//   del sistema de barrera del operador). Dato "en vivo".
// - Calle: NO inventa un número exacto (sería mentir). Calcula una ESTIMACIÓN
//   tipo semáforo según la hora del día y la demanda base de esa calle.
// ============================================================================

import { ESTACIONAMIENTOS } from './data.js';

const TICK_MS = 4000;

// Estado dinámico solo para privados (cupos libres).
const estado = {};
for (const e of ESTACIONAMIENTOS) {
  if (e.tipo === 'privado') {
    // Arranca con una ocupación aleatoria realista (40%–95%).
    const ocup = 0.4 + Math.random() * 0.55;
    estado[e.id] = Math.max(0, Math.round(e.capacidad * (1 - ocup)));
  }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Avanza la simulación de cupos de privados.
function tick() {
  for (const e of ESTACIONAMIENTOS) {
    if (e.tipo !== 'privado') continue;
    // Variación suave: entran y salen autos.
    const delta = Math.round((Math.random() - 0.5) * 4);
    estado[e.id] = clamp(estado[e.id] + delta, 0, e.capacidad);
  }
}
const timer = setInterval(tick, TICK_MS);
if (timer.unref) timer.unref();

// Nivel de semáforo a partir de un ratio de disponibilidad 0..1.
function nivelPorRatio(ratio) {
  if (ratio >= 0.35) return 'verde';
  if (ratio >= 0.12) return 'amarillo';
  return 'rojo';
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
  if (e.horario === '24h' || e.horario === 'Libre') return true;
  const m = e.horario.match(/(\d{1,2}):\d{2}\D+(\d{1,2}):\d{2}/);
  if (!m) return true;
  const desde = Number(m[1]), hasta = Number(m[2]);
  if (hasta < desde) return hora >= desde || hora < hasta; // cruza medianoche
  return hora >= desde && hora < hasta;
}

// ¿Es gratis en este momento? Parsea CUALQUIER rango "HH:MM–HH:MM" del texto
// (robusto: no depende de un horario exacto escrito a mano) + "domingos" + "siempre".
function gratisAhora(e, hora, dia) {
  if (!e.gratis) return false;
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
  const s = new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' });
  const d = new Date(s);
  return { hora: d.getHours(), dia: d.getDay() };
}

// Devuelve el snapshot que consume el frontend.
export function getEstacionamientos() {
  const { hora, dia } = nowChile();

  return ESTACIONAMIENTOS.map((e) => {
    const abierto = abiertoAhora(e, hora);
    const gratis = gratisAhora(e, hora, dia);
    const base = {
      id: e.id, tipo: e.tipo, ciudad: e.ciudad, nombre: e.nombre, direccion: e.direccion,
      lat: e.lat, lng: e.lng, precioHora: e.precioHora, fraccion: e.fraccion,
      gratisInfo: e.gratis, gratisAhora: gratis, horario: e.horario,
      abierto, atributos: e.atributos,
    };

    if (e.tipo === 'privado') {
      const libres = estado[e.id];
      const ratio = libres / e.capacidad;
      return {
        ...base,
        disponibilidad: {
          modo: 'envivo',
          cuposLibres: libres,
          capacidad: e.capacidad,
          nivel: !abierto ? 'cerrado' : nivelPorRatio(ratio),
        },
      };
    } else {
      const demanda = clamp(e.demandaBase * factorHora(hora, dia), 0, 1);
      const disp = 1 - demanda; // disponibilidad estimada
      const nivel = nivelPorRatio(disp);
      const label = nivel === 'verde' ? 'Suele haber cupo'
        : nivel === 'amarillo' ? 'Puede costar' : 'Difícil ahora';
      return {
        ...base,
        disponibilidad: { modo: 'estimacion', nivel, label },
      };
    }
  });
}
