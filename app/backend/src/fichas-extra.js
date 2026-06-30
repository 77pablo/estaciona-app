// ============================================================================
// Estaciona — FICHAS EXTRA hechas a mano
// ----------------------------------------------------------------------------
// Estacionamientos REALES con precio verificado que NO están en el dataset OSM
// (data.js). El engine las concatena a ESTACIONAMIENTOS al arrancar, así que
// aparecen como fichas normales y SOBREVIVEN a la regeneración de data.js
// (este archivo no se regenera).
//
// CÓMO AGREGAR: copia un objeto, pon un id único (prefijo "x-"), ciudad EXACTA
// como en el dataset (para que el selector/filtro la muestren), region, coords
// (lat/lng — geocodifica el lugar), precio (precioMin o precioHora; si pones
// precioMin agrega también precioHora = min×60), horario, gratis, y la fuente.
// Marca verificado: true.
// ============================================================================

export const FICHAS_EXTRA = [
  // ── Malls grandes con tarifa oficial (barrido región por región, jun-2026) ──
  {
    id: 'x-providencia-costanera', tipo: 'privado', ciudad: 'Providencia', region: 'Metropolitana',
    categoria: null, nombre: 'Costanera Center', direccion: 'Av. Andrés Bello 2447, Providencia',
    lat: -33.417494, lng: -70.605439, precioMin: 30, precioHora: 1800, fraccion: null,
    gratis: null, horario: '07:00–21:00', verificado: true, fuente: 'cencomalls.cl (Cenco Costanera Center)',
    atributos: { techado: true, ev: false, accesible: true, camaras: true },
  },
  {
    id: 'x-chillan-arauco', tipo: 'privado', ciudad: 'Chillán', region: 'Ñuble',
    categoria: null, nombre: 'Mall Arauco Chillán', direccion: 'Av. Brasil 1500, Chillán',
    lat: -36.609779, lng: -72.100517, precioMin: 37, precioHora: 2220, fraccion: null,
    gratis: null, horario: '08:00–22:00', verificado: true, fuente: 'araucochillan.cl',
    atributos: { techado: true, ev: false, accesible: true, camaras: true },
  },
  {
    id: 'x-curico-mall', tipo: 'privado', ciudad: 'Curicó', region: 'Maule',
    categoria: null, nombre: 'Mall Curicó', direccion: "Av. Bernardo O'Higgins 201, Curicó",
    lat: -34.991144, lng: -71.245095, precioMin: 24, precioHora: 1440, fraccion: null,
    gratis: null, horario: '10:00–21:00', verificado: true, fuente: 'mallcurico.cl (máx $10.000/día)',
    atributos: { techado: true, ev: false, accesible: true, camaras: true },
  },
  {
    id: 'x-coronel-arauco', tipo: 'privado', ciudad: 'Coronel', region: 'Biobío',
    categoria: null, nombre: 'Mall Arauco Coronel', direccion: 'Carlos Prats 913, Coronel',
    lat: -37.013580, lng: -73.160864, precioHora: 0, fraccion: null,
    gratis: 'Estacionamiento gratis', horario: '06:00–01:00', verificado: true, fuente: 'araucocoronel.cl',
    atributos: { techado: true, ev: false, accesible: true, camaras: true },
  },
  {
    id: 'x-rancagua-cenco', tipo: 'privado', ciudad: 'Rancagua', region: "O'Higgins",
    categoria: null, nombre: 'Mall Cenco Rancagua', direccion: 'Av. Manzanal 750, Rancagua',
    lat: -34.185455, lng: -70.725562, precioHora: 0, fraccion: null,
    gratis: 'Gratis para clientes', horario: '10:00–22:00', verificado: true, fuente: 'cencomalls.cl (Cenco Rancagua)',
    atributos: { techado: true, ev: false, accesible: true, camaras: true },
  },
  {
    id: 'x-osorno-cenco', tipo: 'privado', ciudad: 'Osorno', region: 'Los Lagos',
    categoria: null, nombre: 'Mall Cenco Osorno', direccion: 'Av. Real 645, Osorno',
    lat: -40.574140, lng: -73.130515, precioMin: 30, precioHora: 1800, fraccion: null,
    gratis: null, horario: '07:00–21:00', verificado: true, fuente: 'cencomalls.cl (Cenco Osorno)',
    atributos: { techado: true, ev: false, accesible: true, camaras: true },
  },

  // ── Parquímetros municipales centro (vía pública), tarifa verificada por ──
  // ── ordenanza/concesión municipal. Coords = centro de la ciudad (referencial). ──
  // Horario/gratis aproximan la ventana de cobro publicada; el precio es el verificado.
  {
    id: 'x-valparaiso-calle', tipo: 'calle', ciudad: 'Valparaíso', region: 'Valparaíso',
    categoria: null, nombre: 'Parquímetros centro (Yo Estaciono en Valpo)', direccion: 'Centro de Valparaíso',
    lat: -33.043273, lng: -71.624573, precioMin: 25, precioHora: 1500, fraccion: null,
    gratis: '19:00–08:30 y domingos', horario: 'Parquímetro 08:30–19:00', demandaBase: 0.78,
    verificado: true, fuente: 'municipalidaddevalparaiso.cl',
    atributos: { techado: false, ev: false, accesible: false, camaras: false },
  },
  {
    id: 'x-sanantonio-calle', tipo: 'calle', ciudad: 'San Antonio', region: 'Valparaíso',
    categoria: null, nombre: 'Parquímetros centro (vía pública)', direccion: 'Centro de San Antonio',
    lat: -33.580841, lng: -71.613289, precioMin: 15, precioHora: 900, fraccion: null,
    gratis: '20:00–09:00 y domingos', horario: 'Parquímetro 09:00–20:00', demandaBase: 0.65,
    verificado: true, fuente: 'sanantonio.cl (invierno $15/min; verano $20/min)',
    atributos: { techado: false, ev: false, accesible: false, camaras: false },
  },
  {
    id: 'x-quillota-calle', tipo: 'calle', ciudad: 'Quillota', region: 'Valparaíso',
    categoria: null, nombre: 'Parquímetros centro (vía pública)', direccion: 'Centro de Quillota',
    lat: -32.879957, lng: -71.247428, precioMin: 19, precioHora: 1140, fraccion: null,
    gratis: '20:00–09:00 y domingos', horario: 'Parquímetro 09:00–20:00', demandaBase: 0.6,
    verificado: true, fuente: 'secmuquillota.cl (Decreto/Ordenanza 2025; discapacidad 60 min gratis)',
    atributos: { techado: false, ev: false, accesible: true, camaras: false },
  },
  {
    id: 'x-talca-calle', tipo: 'calle', ciudad: 'Talca', region: 'Maule',
    categoria: null, nombre: 'Parquímetros centro (letrero azul)', direccion: 'Centro de Talca',
    lat: -35.245710, lng: -71.981629, precioHora: 1536, fraccion: null,
    gratis: '20:00–09:00 y domingos', horario: 'Parquímetro 09:00–20:00', demandaBase: 0.7,
    verificado: true, fuente: 'diarioelcentro.cl ($512 por cada 20 min)',
    atributos: { techado: false, ev: false, accesible: false, camaras: false },
  },
  {
    id: 'x-concepcion-calle', tipo: 'calle', ciudad: 'Concepción', region: 'Biobío',
    categoria: null, nombre: 'Parquímetros centro (vía pública)', direccion: 'Centro de Concepción',
    lat: -36.827082, lng: -73.050227, precioMin: 30, precioHora: 1800, fraccion: null,
    gratis: '19:00–09:00 y domingos', horario: 'Parquímetro 09:00–19:00', demandaBase: 0.8,
    verificado: true, fuente: 'saladeprensa.cl (L-V $30/min; Sáb $16/min)',
    atributos: { techado: false, ev: false, accesible: false, camaras: false },
  },
  {
    id: 'x-valdivia-calle', tipo: 'calle', ciudad: 'Valdivia', region: 'Los Ríos',
    categoria: null, nombre: 'Parquímetros centro (vía pública)', direccion: 'Centro de Valdivia',
    lat: -39.870513, lng: -73.400413, precioMin: 26, precioHora: 1560, fraccion: null,
    gratis: '19:30–09:00 y domingos', horario: 'Parquímetro 09:00–19:30', demandaBase: 0.72,
    verificado: true, fuente: 'mivaldivia.cl (concesión 2026, Neogreen)',
    atributos: { techado: false, ev: false, accesible: false, camaras: false },
  },
  {
    id: 'x-puertomontt-calle', tipo: 'calle', ciudad: 'Puerto Montt', region: 'Los Lagos',
    categoria: null, nombre: 'Parquímetros centro (vía pública)', direccion: 'Centro de Puerto Montt',
    lat: -41.471815, lng: -72.939592, precioMin: 30, precioHora: 1800, fraccion: null,
    gratis: '20:00–09:00 y domingos', horario: 'Parquímetro 09:00–20:00', demandaBase: 0.72,
    verificado: true, fuente: 'Municipalidad Puerto Montt (concesión 2025; periferia $23/min)',
    atributos: { techado: false, ev: false, accesible: true, camaras: false },
  },
  {
    id: 'x-osorno-calle', tipo: 'calle', ciudad: 'Osorno', region: 'Los Lagos',
    categoria: null, nombre: 'Parquímetros centro (vía pública)', direccion: 'Centro de Osorno',
    lat: -40.912897, lng: -73.158192, precioMin: 25, precioHora: 1500, fraccion: null,
    gratis: '20:00–08:30 y domingos', horario: 'Parquímetro 08:30–20:00', demandaBase: 0.7,
    verificado: true, fuente: 'municipalidadosorno.cl (concesión jun-2025)',
    atributos: { techado: false, ev: false, accesible: false, camaras: false },
  },
  {
    id: 'x-coyhaique-calle', tipo: 'calle', ciudad: 'Coyhaique', region: 'Aysén',
    categoria: null, nombre: 'Parquímetros centro (vía pública)', direccion: 'Centro de Coyhaique',
    lat: -45.571226, lng: -72.068412, precioMin: 25, precioHora: 1500, fraccion: null,
    gratis: '19:00–09:00 y domingos', horario: 'Parquímetro 09:00–19:00', demandaBase: 0.65,
    verificado: true, fuente: 'Municipalidad Coyhaique (tarifa única $25/min, dic-2025)',
    atributos: { techado: false, ev: false, accesible: false, camaras: false },
  },
  {
    id: 'x-puntaarenas-calle', tipo: 'calle', ciudad: 'Punta Arenas', region: 'Magallanes',
    categoria: null, nombre: 'Parquímetros centro (vía pública)', direccion: 'Centro de Punta Arenas',
    lat: -53.162710, lng: -70.908117, precioMin: 25, precioHora: 1500, fraccion: null,
    gratis: '20:00–09:00 y fines de semana', horario: 'Parquímetro 09:00–20:00', demandaBase: 0.6,
    verificado: true, fuente: 'elmagallanico.com (Perera y Contreras; $28/min desde 3ª h)',
    atributos: { techado: false, ev: false, accesible: true, camaras: false },
  },
  {
    id: 'x-pucon-calle', tipo: 'calle', ciudad: 'Pucón', region: 'La Araucanía',
    categoria: null, nombre: 'Parquímetros centro (Simple Park)', direccion: 'Centro de Pucón',
    lat: -39.282000, lng: -71.955000, precioMin: 35, precioHora: 2100, fraccion: null,
    gratis: '00:00–11:00', horario: 'Parquímetro 11:00–24:00', demandaBase: 0.8,
    verificado: true, fuente: 'municipalidadpucon.cl (zona amarilla visitante; varía por zona y residencia)',
    atributos: { techado: false, ev: false, accesible: false, camaras: false },
  },

  // ── Otros lugares con tarifa verificada (2ª tanda) ──
  {
    id: 'x-puntaarenas-aeropuerto', tipo: 'privado', ciudad: 'Punta Arenas', region: 'Magallanes',
    categoria: 'Terminal', nombre: 'Aeropuerto Carlos Ibáñez (estacionamiento)', direccion: 'Aeropuerto Pdte. Carlos Ibáñez del Campo',
    lat: -53.003809, lng: -70.846482, precioMin: 54, precioHora: 3240, fraccion: null,
    gratis: null, horario: '24h', verificado: true, fuente: 'aeropuertosaustrales.cl (24h = $19.440)',
    atributos: { techado: false, ev: false, accesible: true, camaras: true },
  },
  {
    id: 'x-concepcion-mirador', tipo: 'privado', ciudad: 'Concepción', region: 'Biobío',
    categoria: null, nombre: 'Mallplaza Mirador Biobío', direccion: 'Av. 21 de Mayo, Concepción',
    lat: -36.829681, lng: -73.063334, precioMin: 20, precioHora: 1200, fraccion: null,
    gratis: null, horario: '24h', verificado: true, fuente: 'mallplaza.com (tarifario 2025, "Mallplaza Bío Bío")',
    atributos: { techado: true, ev: false, accesible: true, camaras: true },
  },
  {
    id: 'x-santiago-calle', tipo: 'calle', ciudad: 'Santiago', region: 'Metropolitana',
    categoria: null, nombre: 'Parquímetros centro (E Santiago)', direccion: 'Centro de Santiago',
    lat: -33.437415, lng: -70.651278, precioHora: 1260, fraccion: null,
    gratis: '20:00–08:30 y domingos', horario: 'Parquímetro 08:30–20:00', demandaBase: 0.82,
    verificado: true, fuente: 'encancha.cl (E Santiago, $420 por cada 20 min, mar-2024)',
    atributos: { techado: false, ev: false, accesible: false, camaras: false },
  },

  // ── Mallplaza que NO están en OSM (tarifario oficial 2025, cobro 24h) ──
  {
    id: 'x-talcahuano-trebol', tipo: 'privado', ciudad: 'Talcahuano', region: 'Biobío',
    categoria: null, nombre: 'Mallplaza Trébol', direccion: 'Av. Jorge Alessandri 3177, Talcahuano',
    lat: -36.792134, lng: -73.068140, precioMin: 28, precioHora: 1680, fraccion: null,
    gratis: null, horario: '24h', verificado: true, fuente: 'mallplaza.com (tarifario 2025)',
    atributos: { techado: true, ev: false, accesible: true, camaras: true },
  },
  {
    id: 'x-copiapo-mallplaza', tipo: 'privado', ciudad: 'Copiapó', region: 'Atacama',
    categoria: null, nombre: 'Mall Plaza Copiapó', direccion: 'Av. Maipú 109, Copiapó',
    lat: -27.369225, lng: -70.339391, precioMin: 21, precioHora: 1260, fraccion: null,
    gratis: null, horario: '24h', verificado: true, fuente: 'mallplaza.com (tarifario 2025)',
    atributos: { techado: true, ev: false, accesible: true, camaras: true },
  },
  {
    id: 'x-arica-mallplaza', tipo: 'privado', ciudad: 'Arica', region: 'Arica y Parinacota',
    categoria: null, nombre: 'Mallplaza Arica', direccion: 'Av. Diego Portales 640, Arica',
    lat: -18.469142, lng: -70.308501, precioMin: 23, precioHora: 1380, fraccion: null,
    gratis: null, horario: '24h', verificado: true, fuente: 'mallplaza.com (tarifario 2025)',
    atributos: { techado: true, ev: false, accesible: true, camaras: true },
  },
  {
    id: 'x-estacioncentral-alameda', tipo: 'privado', ciudad: 'Estación Central', region: 'Metropolitana',
    categoria: null, nombre: 'Mallplaza Alameda', direccion: 'Alameda 3470, Estación Central',
    lat: -33.452957, lng: -70.682209, precioMin: 35, precioHora: 2100, fraccion: null,
    gratis: null, horario: '24h', verificado: true, fuente: 'mallplaza.com (tarifario 2025)',
    atributos: { techado: true, ev: false, accesible: true, camaras: true },
  },
  {
    id: 'x-lascondes-dominicos', tipo: 'privado', ciudad: 'Las Condes', region: 'Metropolitana',
    categoria: null, nombre: 'Mallplaza Los Dominicos', direccion: 'Av. Padre Hurtado Sur 875, Las Condes',
    lat: -33.415593, lng: -70.539816, precioMin: 25, precioHora: 1500, fraccion: null,
    gratis: null, horario: '24h', verificado: true, fuente: 'mallplaza.com (tarifario 2025)',
    atributos: { techado: true, ev: false, accesible: true, camaras: true },
  },
];
