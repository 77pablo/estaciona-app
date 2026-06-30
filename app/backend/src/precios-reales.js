// ============================================================================
// Estaciona — PRECIOS REALES (verificados a mano)
// ----------------------------------------------------------------------------
// Este archivo es la ÚNICA fuente de los precios confirmados. El servidor los
// aplica ENCIMA de data.js al arrancar: la ficha pasa a `verificado: true` y
// muestra el precio real (sin el "~ aprox."). Es permanente: no se borra al
// regenerar data.js.
//
// CÓMO AGREGAR UN PRECIO REAL:
//   1. Busca el `id` de la ficha (sale en data.js, o pídeselo a Claude).
//   2. Copia una línea de abajo y pon el id + el precio real:
//        - por hora:   { id: "temuco-1", precioHora: 1200, fuente: "en terreno" }
//        - por minuto: { id: "temuco-1", precioMin: 30, fuente: "en terreno" }
//          (si pones precioMin, el precio por hora se calcula solo = min × 60)
//   3. Campos opcionales: horario, gratis (texto), capacidad.
//   4. Guarda y sube. Listo: esa ficha queda con precio real verificado.
// ============================================================================

export const PRECIOS_REALES = [
  // ── Saba (fuente: autopase.cl). Cobro por minuto (Ley 20.967). ──
  { id: 'providencia-20', precioMin: 57, fuente: 'autopase.cl (Saba)' }, // Ricardo Lyon
  { id: 'providencia-19', precioMin: 57, fuente: 'autopase.cl (Saba)' }, // Concesionados Pedro de Valdivia
  { id: 'providencia-18', precioMin: 57, fuente: 'autopase.cl (Saba)' }, // Concesionados Marchant Pereira
  { id: 'santiago-12',    precioMin: 57, fuente: 'autopase.cl (Saba)' }, // Santa Lucía
  { id: 'santiago-6',     precioMin: 57, fuente: 'autopase.cl (Saba)' }, // Parque Forestal
  { id: 'santiago-34',    precioMin: 57, fuente: 'autopase.cl (Saba)' }, // Paseo Bulnes
  { id: 'valparaiso-1',   precioMin: 57, fuente: 'autopase.cl (Saba)' }, // Bellavista Saba

  // ── Temuco ──
  // Portal Temuco (Cenco Temuco, operador Cenco Malls): $20/min. OJO: es la tarifa
  // PROMOCIONAL del 1er año; la base es $25/min y sube ~nov-2026 (revisar entonces).
  // Cobro 07:00–21:00 (fuera de ese tramo no se cobra). Fuente: cencomalls.cl + prensa (nov-2025).
  { id: 'temuco-1', precioMin: 20, horario: '07:00–21:00', fuente: 'cencomalls.cl (Cenco Temuco, nov-2025; promo 1er año)' }, // Portal Temuco

  // Calles del centro con cobro vía app Parksur: $30/min (vía pública, Ley 20.967).
  // L-V 08:30–20:00 (Sáb 09:00–14:00 no se modela); gratis de noche y domingos.
  // Fuente: parksur.cl. NOTA: tarifa de la app Parksur para vía pública en Temuco;
  // el operador exacto por calle puede variar (parquímetro municipal vs Parksur).
  { id: 'temuco-calle-1', precioMin: 30, horario: 'Parquímetro 08:30–20:00', gratis: '20:00–08:30 y domingos', fuente: 'parksur.cl (app vía pública Temuco)' }, // Arturo Prat
  { id: 'temuco-calle-2', precioMin: 30, horario: 'Parquímetro 08:30–20:00', gratis: '20:00–08:30 y domingos', fuente: 'parksur.cl (app vía pública Temuco)' }, // Claro Solar
  { id: 'temuco-calle-3', precioMin: 30, horario: 'Parquímetro 08:30–20:00', gratis: '20:00–08:30 y domingos', fuente: 'parksur.cl (app vía pública Temuco)' }, // Vicuña Mackenna
  { id: 'temuco-calle-4', precioMin: 30, horario: 'Parquímetro 08:30–20:00', gratis: '20:00–08:30 y domingos', fuente: 'parksur.cl (app vía pública Temuco)' }, // Antonio Varas

  // ── Santiago / Las Condes — malls grandes (fuente oficial del operador) ──
  // Parque Arauco Kennedy (Las Condes): $25/min general, cobro 07:00–00:00. Fuente parquearauco.cl.
  // (3 fichas OSM del mismo mall: accesos/polígonos distintos.) Express $39/min NO se modela.
  { id: 'las-condes-2',  precioMin: 25, horario: '07:00–00:00', fuente: 'parquearauco.cl (Parque Arauco Kennedy)' }, // Estacionamientos Parque Arauco
  { id: 'las-condes-22', precioMin: 25, horario: '07:00–00:00', fuente: 'parquearauco.cl (Parque Arauco Kennedy)' }, // Mall Parque Arauco
  { id: 'las-condes-35', precioMin: 25, horario: '07:00–00:00', fuente: 'parquearauco.cl (Parque Arauco Kennedy)' }, // Parque Arauco Oriente
  // Alto Las Condes (Cenco Malls): $19/min, cobro 07:00–21:00. Fuente cencomalls.cl.
  { id: 'las-condes-16', precioMin: 19, horario: '07:00–21:00', fuente: 'cencomalls.cl (Alto Las Condes)' }, // Alto Las Condes
  { id: 'vitacura-4',    precioMin: 19, horario: '07:00–21:00', fuente: 'cencomalls.cl (Alto Las Condes)' }, // Alto Las Condes (acceso lado Vitacura)

  // ── Regiones (barrido región por región, fuente oficial del operador) ──
  // Mall Marina Arauco (Viña del Mar): $36/min efectivo. Fuente mallmarina.cl / saba-chile.cl.
  { id: 'vina-del-mar-4', precioMin: 36, horario: '07:00–22:15', fuente: 'mallmarina.cl (Marina Arauco)' }, // Mall Marina Arauco
  // Mall Florida Center (Cenco Malls, La Florida): $15/min, cobro 07:00–21:00, 15 min gracia. Fuente cencomalls.cl.
  { id: 'la-florida-1', precioMin: 15, horario: '07:00–21:00', fuente: 'cencomalls.cl (Florida Center)' }, // Mall Florida Center
  { id: 'la-florida-2', precioMin: 15, horario: '07:00–21:00', fuente: 'cencomalls.cl (Florida Center)' }, // Mall Florida Center (2)
  { id: 'la-florida-3', precioMin: 15, horario: '07:00–21:00', fuente: 'cencomalls.cl (Florida Center)' }, // Mall Florida Center (3)
  // Mall Arauco Maipú: estacionamiento GRATIS (autos/motos/bicis). Fuente araucomaipu.cl.
  { id: 'maipu-2', precioHora: 0, gratis: 'Estacionamiento gratis', horario: '09:30–20:30', fuente: 'araucomaipu.cl' }, // Mall Arauco Maipu

  // ── Mallplaza (tarifario OFICIAL 2025, cobro 24h, 15 min de tolerancia) ──
  // Fuente: mallplaza.com/cl/tarifario-parking-mallplaza (imagen leída por Claude).
  { id: 'nunoa-4',           precioMin: 28, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Egaña
  { id: 'la-serena-2',       precioMin: 28, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza La Serena
  { id: 'conchali-1',        precioMin: 25, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Norte
  { id: 'conchali-2',        precioMin: 25, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Norte (2)
  { id: 'lo-espejo-1',       precioMin: 25, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Oeste
  { id: 'lo-espejo-4',       precioMin: 25, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Oeste (2)
  { id: 'lo-espejo-5',       precioMin: 25, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Oeste (3)
  { id: 'lo-espejo-6',       precioMin: 25, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Oeste (4)
  { id: 'lo-espejo-7',       precioMin: 25, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Oeste (5)
  { id: 'lo-espejo-8',       precioMin: 25, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Oeste (6)
  { id: 'lo-espejo-9',       precioMin: 25, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Oeste (7)
  { id: 'la-florida-7',      precioMin: 23, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Vespucio
  { id: 'la-florida-8',      precioMin: 23, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Vespucio (2)
  { id: 'iquique-6',         precioMin: 23, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Iquique
  { id: 'puente-alto-8',     precioMin: 20, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Tobalaba
  { id: 'puente-alto-10',    precioMin: 20, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Tobalaba (2)
  { id: 'san-bernardo-1',    precioMin: 20, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Sur
  { id: 'san-bernardo-2',    precioMin: 20, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Sur (2)
  { id: 'san-bernardo-3',    precioMin: 20, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Sur (3)
  { id: 'calera-de-tango-1', precioMin: 20, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Sur (Calera de Tango)
  { id: 'antofagasta-7',     precioMin: 28, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Antofagasta
  { id: 'antofagasta-12',    precioMin: 28, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Antofagasta (2)
  { id: 'calama-3',          precioMin: 23, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Calama
  { id: 'los-angeles-23',    precioMin: 27, horario: '24h', fuente: 'mallplaza.com (tarifario 2025)' }, // Mallplaza Los Ángeles
];

// Devuelve un mapa id -> override, con precioHora derivado de precioMin si falta.
export function mapaPreciosReales() {
  const m = {};
  for (const o of PRECIOS_REALES) {
    if (!o || !o.id) continue;
    const ov = { ...o };
    if (ov.precioMin && ov.precioHora == null) ov.precioHora = ov.precioMin * 60;
    m[o.id] = ov;
  }
  return m;
}
