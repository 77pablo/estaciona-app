// ============================================================================
// Estaciona — CORRECCIONES de campos puntuales
// ----------------------------------------------------------------------------
// Arregla un campo equivocado de una ficha del dataset OSM (data.js) —una
// dirección, un nombre, una coordenada— SIN cambiar el precio y SIN marcarla
// "verificado". Sirve cuando OSM traía un dato genérico o erróneo y sabemos el
// correcto, pero NO tenemos su tarifa confirmada (así que sigue siendo estimación).
//
// El engine las aplica con Object.assign encima de la ficha, respetando el
// `verificado` que ya tenga. Sobreviven a la regeneración de data.js.
//
// CÓMO AGREGAR: una línea con el `id` de la ficha + los campos a corregir.
//   { id: 'temuco-26', direccion: 'Senador Estébanez 645, Temuco' }
// ============================================================================

export const CORRECCIONES = [
  // Clínica Alemana de Temuco: OSM traía dirección genérica ("Temuco (centro)");
  // la real es Senador Estébanez 645 (web oficial + Waze, jul-2026). Precio NO
  // verificado → sigue como estimación.
  { id: 'temuco-26', direccion: 'Senador Estébanez 645, Temuco' },
];

// Devuelve un mapa id -> correccion.
export function mapaCorrecciones() {
  const m = {};
  for (const c of CORRECCIONES) if (c && c.id) m[c.id] = c;
  return m;
}
