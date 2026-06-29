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

  // ── Temuco (por confirmar en terreno) ──
  // Ejemplo simple:   { id: "temuco-1", precioHora: 1200, fuente: "en terreno" },  // Portal Temuco
  // Ejemplo completo (todos los campos opcionales que puedes confirmar):
  //   {
  //     id: "temuco-1",
  //     precioHora: 1200,            // precio por hora en pesos (o usa precioMin)
  //     horario: "08:00–22:00",      // horario real (usa guion largo "–")
  //     gratis: "primeros 15 min",   // texto si hay tramo/condición gratis
  //     capacidad: 350,              // n.º de plazas, si lo sabes
  //     fuente: "en terreno",        // de dónde salió el dato (web, cartel, etc.)
  //   },
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
