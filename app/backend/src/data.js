// ============================================================================
// Estaciona — Datos de la zona piloto (Centro de Temuco, La Araucanía, Chile)
// ----------------------------------------------------------------------------
// QUÉ ES REAL Y QUÉ NO (importante para no engañar al usuario):
//   ✅ REAL  → nombre, dirección, coordenadas (lat/lng) y si es pago/gratis.
//              Fuente: OpenStreetMap (descargado vía Overpass API) + reverse
//              geocoding de Nominatim. Junio 2026.
//   ⚠️ ESTIMADO (verificado:false) → precioHora, fracción, horario y capacidad.
//              Nadie publica esto en un dataset; son valores REFERENCIALES de
//              mercado y hay que CONFIRMARLOS en terreno antes de lanzar.
//   🟢 CALLE → nunca tiene cupo "en vivo": solo estimación tipo semáforo.
//
// Para corregir un precio/horario real: edita el número aquí y cambia
// "verificado: false" → "verificado: true" en esa ficha.
// ============================================================================

// Centro de la zona = "estás aquí" simulado (Plaza Aníbal Pinto, Temuco).
export const CENTRO = { lat: -38.73950, lng: -72.59700, nombre: 'Temuco Centro' };

export const ESTACIONAMIENTOS = [
  // ===========================================================================
  // PRIVADOS DE PAGO (ubicación REAL · precio/horario REFERENCIAL por confirmar)
  // ===========================================================================
  {
    id: 'p1', tipo: 'privado', nombre: 'Estac. Portal Temuco (Mall)',
    direccion: 'Av. Alemania 0671', lat: -38.733065, lng: -72.610364,
    precioHora: 1000, fraccion: { min: 15, precio: 300 }, gratis: null,
    horario: '10:00–22:00', capacidad: 400, verificado: false,
    atributos: { techado: true, ev: true, accesible: true, camaras: true },
  },
  {
    id: 'p2', tipo: 'privado', nombre: 'Estac. Plaza de Armas (subterráneo)',
    direccion: 'Claro Solar (Plaza de Armas)', lat: -38.739945, lng: -72.590112,
    precioHora: 1000, fraccion: { min: 15, precio: 300 }, gratis: null,
    horario: '08:00–22:00', capacidad: 200, verificado: false,
    atributos: { techado: true, ev: false, accesible: true, camaras: true },
  },
  {
    id: 'p3', tipo: 'privado', nombre: 'Estac. Manuel Montt',
    direccion: 'Manuel Montt 850', lat: -38.738677, lng: -72.589702,
    precioHora: 800, fraccion: { min: 30, precio: 400 }, gratis: null,
    horario: '08:00–21:00', capacidad: 60, verificado: false,
    atributos: { techado: false, ev: false, accesible: false, camaras: true },
  },
  {
    id: 'p4', tipo: 'privado', nombre: 'Estac. Montt y Cruz',
    direccion: 'Manuel Montt 1162', lat: -38.739399, lng: -72.585594,
    precioHora: 900, fraccion: { min: 30, precio: 450 }, gratis: null,
    horario: '08:00–21:00', capacidad: 70, verificado: false,
    atributos: { techado: true, ev: false, accesible: true, camaras: true },
  },
  {
    id: 'p5', tipo: 'privado', nombre: 'Clínica Alemana (visitas)',
    direccion: 'Senador Estébanez 645', lat: -38.736399, lng: -72.611089,
    precioHora: 1200, fraccion: { min: 15, precio: 400 }, gratis: null,
    horario: '24h', capacidad: 80, verificado: false,
    atributos: { techado: true, ev: true, accesible: true, camaras: true },
  },
  {
    id: 'p6', tipo: 'privado', nombre: 'Estac. Mall Mirage',
    direccion: 'Torremolinos', lat: -38.732326, lng: -72.615139,
    precioHora: 800, fraccion: { min: 15, precio: 250 }, gratis: null,
    horario: '10:00–22:00', capacidad: 250, verificado: false,
    atributos: { techado: true, ev: false, accesible: true, camaras: true },
  },
  {
    id: 'p7', tipo: 'privado', nombre: 'Estac. Claro Solar / V. Mackenna',
    direccion: 'Claro Solar 677', lat: -38.738840, lng: -72.592364,
    precioHora: 900, fraccion: { min: 30, precio: 450 }, gratis: null,
    horario: '08:30–20:30', capacidad: 40, verificado: false,
    atributos: { techado: false, ev: false, accesible: false, camaras: true },
  },

  // ===========================================================================
  // PRIVADOS GRATIS PARA CLIENTES (ubicación REAL · horario REFERENCIAL)
  // ===========================================================================
  {
    id: 'g1', tipo: 'privado', nombre: 'Estac. Líder',
    direccion: 'Pasaje Apóstol Simón', lat: -38.728537, lng: -72.601868,
    precioHora: 0, fraccion: null, gratis: 'Gratis para clientes',
    horario: '08:30–22:00', capacidad: 300, verificado: false,
    atributos: { techado: false, ev: false, accesible: true, camaras: true },
  },
  {
    id: 'g2', tipo: 'privado', nombre: 'Estac. Unimarc (O\'Higgins)',
    direccion: 'Bernardo O\'Higgins 0160', lat: -38.741984, lng: -72.605520,
    precioHora: 0, fraccion: null, gratis: 'Gratis para clientes',
    horario: '08:30–22:00', capacidad: 100, verificado: false,
    atributos: { techado: true, ev: false, accesible: true, camaras: true },
  },
  {
    id: 'g3', tipo: 'privado', nombre: 'Estac. Unimarc (San Ernesto)',
    direccion: 'Pasaje San Ernesto', lat: -38.739079, lng: -72.610993,
    precioHora: 0, fraccion: null, gratis: 'Gratis para clientes',
    horario: '08:30–22:00', capacidad: 50, verificado: false,
    atributos: { techado: true, ev: false, accesible: false, camaras: true },
  },
  {
    id: 'g4', tipo: 'privado', nombre: 'Estac. Easy',
    direccion: 'Los Notros', lat: -38.746765, lng: -72.607944,
    precioHora: 0, fraccion: null, gratis: 'Gratis para clientes',
    horario: '09:00–21:00', capacidad: 200, verificado: false,
    atributos: { techado: false, ev: false, accesible: true, camaras: true },
  },
  {
    id: 'g5', tipo: 'privado', nombre: 'Estac. Construmart',
    direccion: 'Av. Pedro de Valdivia', lat: -38.729818, lng: -72.605788,
    precioHora: 0, fraccion: null, gratis: 'Gratis para clientes',
    horario: '09:00–20:00', capacidad: 80, verificado: false,
    atributos: { techado: false, ev: false, accesible: false, camaras: true },
  },
  {
    id: 'g6', tipo: 'privado', nombre: 'Estac. Centro Comercial Alemania',
    direccion: 'Av. Alemania 0870', lat: -38.733683, lng: -72.615185,
    precioHora: 0, fraccion: null, gratis: 'Gratis para clientes',
    horario: '10:00–21:00', capacidad: 60, verificado: false,
    atributos: { techado: false, ev: false, accesible: false, camaras: false },
  },
  {
    id: 'g7', tipo: 'privado', nombre: 'Estac. Mayorista 10',
    direccion: 'Francisco Salazar', lat: -38.753629, lng: -72.619081,
    precioHora: 0, fraccion: null, gratis: 'Gratis para clientes',
    horario: '08:30–20:00', capacidad: 100, verificado: false,
    atributos: { techado: false, ev: false, accesible: true, camaras: true },
  },
  {
    id: 'g8', tipo: 'privado', nombre: 'Estac. Estadio Germán Becker',
    direccion: 'Av. Pablo Neruda 01110', lat: -38.741275, lng: -72.620476,
    precioHora: 0, fraccion: null, gratis: 'Gratis (días sin evento)',
    horario: '08:00–20:00', capacidad: 150, verificado: false,
    atributos: { techado: false, ev: false, accesible: true, camaras: false },
  },

  // ===========================================================================
  // CALLE / PARQUÍMETRO (calles REALES del centro · disponibilidad ESTIMADA,
  // nunca cupo exacto · tarifa de parquímetro REFERENCIAL por confirmar)
  // ===========================================================================
  {
    id: 'c1', tipo: 'calle', nombre: 'Calle Arturo Prat',
    direccion: 'Arturo Prat 500', lat: -38.73850, lng: -72.59650,
    precioHora: 500, fraccion: null, gratis: '20:00–09:00 y domingos',
    horario: 'Parquímetro 09:00–20:00', demandaBase: 0.85, verificado: false,
    atributos: { techado: false, ev: false, accesible: false, camaras: false },
  },
  {
    id: 'c2', tipo: 'calle', nombre: 'Calle Claro Solar',
    direccion: 'Claro Solar 600', lat: -38.74020, lng: -72.59500,
    precioHora: 500, fraccion: null, gratis: '20:00–09:00 y domingos',
    horario: 'Parquímetro 09:00–20:00', demandaBase: 0.6, verificado: false,
    atributos: { techado: false, ev: false, accesible: false, camaras: false },
  },
  {
    id: 'c3', tipo: 'calle', nombre: 'Calle Vicuña Mackenna',
    direccion: 'Vicuña Mackenna 720', lat: -38.73780, lng: -72.59850,
    precioHora: 500, fraccion: null, gratis: '20:00–09:00 y domingos',
    horario: 'Parquímetro 09:00–20:00', demandaBase: 0.5, verificado: false,
    atributos: { techado: false, ev: false, accesible: false, camaras: false },
  },
  {
    id: 'c4', tipo: 'calle', nombre: 'Calle Antonio Varas',
    direccion: 'Antonio Varas 980', lat: -38.74100, lng: -72.59800,
    precioHora: 500, fraccion: null, gratis: '20:00–09:00 y domingos',
    horario: 'Parquímetro 09:00–20:00', demandaBase: 0.55, verificado: false,
    atributos: { techado: false, ev: false, accesible: false, camaras: false },
  },
  {
    id: 'c5', tipo: 'calle', nombre: 'Calle Lautaro',
    direccion: 'Lautaro 1100', lat: -38.73600, lng: -72.59580,
    precioHora: 0, fraccion: null, gratis: 'Siempre gratis',
    horario: 'Libre', demandaBase: 0.9, verificado: false,
    atributos: { techado: false, ev: false, accesible: false, camaras: false },
  },
];
