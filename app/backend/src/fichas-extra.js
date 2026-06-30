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
];
