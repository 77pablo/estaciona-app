// ============================================================================
// Estaciona — Ocupación EN VIVO de operadores (adaptador B2B) · ENCHUFE
// ----------------------------------------------------------------------------
// Este es el punto de conexión para el nivel #1 de disponibilidad: cupos REALES
// que reporta el sistema del operador (barrera/contador de un mall o garaje).
//
// HOY devuelve {}: no hay convenios ni feeds, así que NADIE alimenta el nivel
// "en vivo · oficial". No se inventan datos — sin feed real, el mapa queda vacío
// y la disponibilidad la resuelven la gente (crowdsourcing) o la estimación.
//
// Cuando un operador exponga su ocupación, acá se consulta su API y se devuelve,
// SOLO para los ids con feed, un mapa:
//     { [id]: { libres: <nº cupos libres>, minAgo: <antigüedad del dato en min>,
//               umbralBajo?: <nº bajo el cual se marca "quedan pocos"> } }
// resolverDisponibilidad() (engine.js) ya le da prioridad sobre gente/estimación
// y el frontend ya sabe rotularlo "en vivo · oficial".
//
// Nota de diseño: se recibe la lista de ids visibles para poder consultar solo
// lo necesario (y cachear/batchear por operador) cuando existan feeds reales.
// ============================================================================

export async function liveOcupacionMapa(/* ids = [] */) {
  return {};
}
