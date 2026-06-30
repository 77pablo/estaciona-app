// ============================================================================
// Estaciona — ESTIMACIONES de precio por comuna (NO verificado)
// ----------------------------------------------------------------------------
// Precio por hora ESTIMADO para fichas que NO tienen precio real verificado.
// Sustituye el estimado genérico ($900/600) por un promedio REAL de la comuna,
// para que el "~est." no mienta hacia abajo. SIGUE siendo estimación (la ficha
// queda verificado:false y muestra "~$X est."), porque es un promedio de comuna,
// no el precio de ese recinto puntual.
//
// Fuente: La Tercera / Pulso, 13-abr-2026 — estudio de ~2.200 estacionamientos
// pagados de la Región Metropolitana (precio PROMEDIO por minuto por comuna).
// Se guarda como precio/hora = promedio $/min × 60.
//
// El engine SOLO lo aplica a fichas con precioHora > 0 (pagadas) y verificado:false;
// nunca pisa un precio real ni un estacionamiento gratis.
// ============================================================================

export const ESTIMACIONES_COMUNA = {
  'Providencia': 3240,   // $54/min prom (rango $42–68)
  'Vitacura':    3060,   // $51/min prom (rango $40–70)
  'Las Condes':  2880,   // $48/min prom (rango $20–75)
  'Santiago':    2760,   // $46/min prom (rango $35–60)
  'La Florida':  1560,   // $26/min prom (rango $15–50)
  'Maipú':       1560,   // $26/min prom
  'Puente Alto': 1560,   // $26/min prom
};
