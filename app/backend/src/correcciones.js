// ============================================================================
// Estaciona — CORRECCIONES y DATOS DE CONTACTO verificados
// ----------------------------------------------------------------------------
// Arregla campos de una ficha del dataset OSM (data.js) que venían genéricos o
// erróneos —dirección, nombre, horario, teléfono, web, servicios, y si es gratis
// o pago— cuando lo sabemos por FUENTE OFICIAL (web del operador/institución).
//
// NO inventa tarifas: el PRECIO por hora solo se toca aquí para corregir un
// "gratis/pago" mal clasificado (ej. una playa de supermercado que OSM marcó
// como pago y en realidad es gratis para clientes → precioHora:0 + gratis). La
// tarifa exacta confirmada va en precios-reales.js (marca verificado:true); si
// aquí no se toca el precio, la ficha sigue siendo estimación ("~est.").
//
// El engine las aplica con Object.assign encima de la ficha. Sobreviven a la
// regeneración de data.js.
//
// CÓMO AGREGAR: una línea con el `id` de la ficha + los campos a corregir.
//   { id: 'temuco-26', direccion: '...', telefono: '...', web: '...' }
// ============================================================================

export const CORRECCIONES = [
  // ── TEMUCO (zona piloto) — datos verificados con fuente oficial, jul-2026 ──
  // Investigación web (sitios de operadores/instituciones). Ninguno publica su
  // tarifa exacta, así que los pagos siguen como estimación; sí corregimos
  // dirección/horario/contacto y los gratis/pago mal clasificados.

  // Estadio Germán Becker (recinto municipal): dirección oficial. Uso ligado a
  // eventos deportivos; se mantiene gratis.
  { id: 'temuco-2', direccion: 'Av. Pablo Neruda 01110, Temuco' },

  // Supermercados / retail: estacionamiento GRATIS para clientes (con compra),
  // no parking público. OSM los traía como pago estimado → se corrige.
  { id: 'temuco-3', precioHora: 0, gratis: 'Gratis para clientes (con compra)' },       // Santa Isabel
  { id: 'temuco-12', precioHora: 0, gratis: 'Gratis para clientes (con compra)' },      // Estacionamiento Unimarc
  { id: 'temuco-7', direccion: 'Av. Caupolicán 0650, Temuco', precioHora: 0, gratis: 'Gratis para clientes (con compra)' },   // Easy (Cencosud)
  { id: 'temuco-23', direccion: 'Av. Pedro de Valdivia 0535, Temuco', horario: 'Lun a Vie 08:00–20:00, Sáb 08:30–20:00, Dom 09:00–17:30', telefono: '+56 45 223 8400', precioHora: 0, gratis: 'Gratis para clientes (con compra)' },   // Construmart
  { id: 'temuco-9', direccion: 'Reyes Católicos 1550, Temuco', horario: 'Lun a Vie 08:30–17:30', telefono: '+56 45 299 3200', precioHora: 0, gratis: 'Gratis para clientes (con compra)' },   // Ebema

  // Teatro Municipal de Temuco (Municipalidad): dirección + contacto oficiales.
  { id: 'temuco-4', direccion: 'Av. Pablo Neruda 01380, Temuco', telefono: '+56 45 297 3470', web: 'teatromunicipaltemuco.cl' },

  // Planta de Revisión Técnica (TÜV Rheinland): no es parking público; el patio
  // es para clientes en trámite. Dirección + horario + contacto oficiales.
  { id: 'temuco-8', direccion: 'Rudecindo Ortega 02351, Temuco', horario: 'Lun a Vie 08:30–18:00, Sáb 08:30–13:30', telefono: '+56 2 2352 4226', precioHora: 0, gratis: 'Gratis para clientes (en trámite)' },

  // Terminal Rodoviario (Tur Bus): dirección + horario 24h + contacto. Pago
  // (sin tarifa oficial publicada → sigue estimación).
  { id: 'temuco-10', direccion: 'Vicente Pérez Rosales 01609, Temuco', horario: '24h', telefono: '+56 45 222 6717' },

  // Museo Nacional Ferroviario Pablo Neruda: estacionamiento GRATIS para
  // visitantes (web oficial). OSM lo traía como pago estimado → se corrige.
  { id: 'temuco-11', nombre: 'Museo Nacional Ferroviario Pablo Neruda', direccion: 'Av. Barros Arana 0565, Temuco', horario: 'Mar a Vie 09:00–18:00, Sáb 10:00–18:00, Dom 11:00–17:00', telefono: '+56 45 297 3945', web: 'museoferroviariopabloneruda.cl', precioHora: 0, gratis: 'Gratis' },

  // Playas privadas de superficie del centro (OSM las tenía con nombres de
  // esquina genéricos): se aclara la esquina real. Siguen como pago estimado.
  { id: 'temuco-14', direccion: 'Calle Manuel Montt, Temuco (centro)' },
  { id: 'temuco-15', direccion: 'Claro Solar esq. Vicuña Mackenna, Temuco' },
  { id: 'temuco-16', direccion: 'Andrés Bello esq. Vicuña Mackenna, Temuco' },
  { id: 'temuco-17', direccion: 'Claro Solar esq. Vicuña Mackenna, Temuco' },

  // Subterráneo Plaza de Armas (Plaza Aníbal Pinto), operador Estacionamientos
  // Araucanía: dirección/horario 24h/contacto/servicios oficiales. Techado,
  // accesible y con cámaras/guardias 24/7 (cap. 315). Pago (promo "7h por 24h";
  // tarifa por hora no publicada → sigue estimación).
  { id: 'temuco-19', nombre: 'Estacionamiento Plaza de Armas (Aníbal Pinto)', direccion: 'Claro Solar 850, Temuco', horario: '24h', telefono: '+56 9 9553 5593', web: 'estacionamientosaraucania.cl', atributos: { techado: true, ev: false, accesible: true, camaras: true } },

  // Estacionamiento Montt y Cruz Ltda.: teléfono (Cámara de Comercio Araucanía).
  { id: 'temuco-21', telefono: '+56 45 221 0818' },

  // Mall Mirage: dirección real (Torremolinos 410) + horario + contacto oficiales.
  { id: 'temuco-25', direccion: 'Torremolinos 410, Temuco', horario: 'Lun a Vie 10:30–19:30, Sáb 11:30–19:30', telefono: '+56 45 224 8567', web: 'mallmirage.cl' },

  // Clínica Alemana de Temuco: dirección + horario 24h + contacto oficiales.
  // Uso para pacientes/visitantes (categoría Salud, uso restringido).
  { id: 'temuco-26', direccion: 'Senador Estébanez 645, Temuco', horario: '24h', telefono: '+56 45 220 1201', web: 'clinicaalemanatemuco.cl' },

  // INACAP sede Temuco: dirección + web oficiales. Estacionamiento institucional
  // (alumnos/funcionarios), uso restringido.
  { id: 'temuco-27', direccion: 'Luis Durand 02150, Temuco', web: 'portal.inacap.cl/sede-temuco' },

  // Clínica RedSalud Mayor de Temuco: dirección + horario 24h + contacto.
  { id: 'temuco-29', direccion: 'Av. Gabriela Mistral 1955, Temuco', horario: '24h', telefono: '+56 45 231 0200', web: 'redsalud.cl' },
];

// Devuelve un mapa id -> correccion.
export function mapaCorrecciones() {
  const m = {};
  for (const c of CORRECCIONES) if (c && c.id) m[c.id] = c;
  return m;
}
