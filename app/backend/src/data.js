// ============================================================================
// Estaciona — Datos REGIONALES (Región de La Araucanía, Chile)
// ----------------------------------------------------------------------------
// QUÉ ES REAL Y QUÉ NO:
//   ✅ REAL  → nombre, ciudad, coordenadas (lat/lng) y si es pago/gratis.
//              Fuente: OpenStreetMap (Overpass API), junio 2026. 99
//              estacionamientos en 17 ciudades de la región.
//   ⚠️ ESTIMADO (verificado:false) → precioHora, horario, capacidad y dirección
//              cuando OSM no la trae. Hay que CONFIRMARLOS en terreno.
//   🟢 CALLE → estimación tipo semáforo (parquímetros de Temuco).
//
// Generado automáticamente (scripts/scratchpad). Editar precios reales aquí y
// poner "verificado: true" en la ficha confirmada.
// ============================================================================

export const CENTRO = {"lat":-38.7358908,"lng":-72.590538,"nombre":"Temuco"};

// Ciudades con datos, de mayor a menor cantidad (para el selector de la app).
export const ZONAS = [
  {
    "nombre": "Temuco",
    "lat": -38.7358908,
    "lng": -72.590538,
    "cantidad": 34
  },
  {
    "nombre": "Villarrica",
    "lat": -39.2780911,
    "lng": -72.2274364,
    "cantidad": 12
  },
  {
    "nombre": "Pucón",
    "lat": -39.2731173,
    "lng": -71.9777605,
    "cantidad": 11
  },
  {
    "nombre": "Curarrehue",
    "lat": -39.35898,
    "lng": -71.5873592,
    "cantidad": 10
  },
  {
    "nombre": "Curacautín",
    "lat": -38.4372985,
    "lng": -71.8883419,
    "cantidad": 8
  },
  {
    "nombre": "Padre Las Casas",
    "lat": -38.7674245,
    "lng": -72.5956312,
    "cantidad": 8
  },
  {
    "nombre": "Freire",
    "lat": -38.9514242,
    "lng": -72.6254333,
    "cantidad": 5
  },
  {
    "nombre": "Galvarino",
    "lat": -38.4111234,
    "lng": -72.7812506,
    "cantidad": 3
  },
  {
    "nombre": "Lautaro",
    "lat": -38.534312,
    "lng": -72.4350504,
    "cantidad": 3
  },
  {
    "nombre": "Labranza",
    "lat": -38.7665376,
    "lng": -72.7534177,
    "cantidad": 2
  },
  {
    "nombre": "Victoria",
    "lat": -38.2339494,
    "lng": -72.3316568,
    "cantidad": 2
  },
  {
    "nombre": "Ercilla",
    "lat": -38.0609055,
    "lng": -72.3754686,
    "cantidad": 1
  },
  {
    "nombre": "Lonquimay",
    "lat": -38.454068,
    "lng": -71.3706282,
    "cantidad": 1
  },
  {
    "nombre": "Nueva Imperial",
    "lat": -38.7453101,
    "lng": -72.9519984,
    "cantidad": 1
  },
  {
    "nombre": "Perquenco",
    "lat": -38.4212493,
    "lng": -72.3778344,
    "cantidad": 1
  },
  {
    "nombre": "Pitrufquén",
    "lat": -38.9862884,
    "lng": -72.63725,
    "cantidad": 1
  },
  {
    "nombre": "Puerto Saavedra",
    "lat": -38.7923166,
    "lng": -73.3968651,
    "cantidad": 1
  }
];

export const ESTACIONAMIENTOS = [
  {
    "id": "curacautin-1",
    "tipo": "privado",
    "ciudad": "Curacautín",
    "nombre": "Cementerio Curacautin",
    "direccion": "Curacautín (centro)",
    "lat": -38.446302,
    "lng": -71.881708,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "curacautin-2",
    "tipo": "privado",
    "ciudad": "Curacautín",
    "nombre": "Estación de Buses Curacautín",
    "direccion": "Curacautín (centro)",
    "lat": -38.435871,
    "lng": -71.893399,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "curacautin-3",
    "tipo": "privado",
    "ciudad": "Curacautín",
    "nombre": "Hospital Curacautin",
    "direccion": "Curacautín (centro)",
    "lat": -38.439379,
    "lng": -71.891211,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "curacautin-4",
    "tipo": "privado",
    "ciudad": "Curacautín",
    "nombre": "Liceo Las Araucarias",
    "direccion": "Curacautín (centro)",
    "lat": -38.435826,
    "lng": -71.894268,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "curacautin-5",
    "tipo": "privado",
    "ciudad": "Curacautín",
    "nombre": "Plaza Curacautin",
    "direccion": "Curacautín (centro)",
    "lat": -38.437557,
    "lng": -71.887769,
    "precioHora": 0,
    "fraccion": null,
    "gratis": "Gratis para clientes",
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "curacautin-6",
    "tipo": "privado",
    "ciudad": "Curacautín",
    "nombre": "Plaza Curacautin",
    "direccion": "Curacautín (centro)",
    "lat": -38.437759,
    "lng": -71.88866,
    "precioHora": 0,
    "fraccion": null,
    "gratis": "Gratis para clientes",
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "curacautin-7",
    "tipo": "privado",
    "ciudad": "Curacautín",
    "nombre": "Plaza Curacautin",
    "direccion": "Curacautín (centro)",
    "lat": -38.437187,
    "lng": -71.887725,
    "precioHora": 0,
    "fraccion": null,
    "gratis": "Gratis para clientes",
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "curacautin-8",
    "tipo": "privado",
    "ciudad": "Curacautín",
    "nombre": "Unimarc",
    "direccion": "Curacautín (centro)",
    "lat": -38.437482,
    "lng": -71.89125,
    "precioHora": 0,
    "fraccion": null,
    "gratis": "Gratis para clientes",
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "curarrehue-1",
    "tipo": "privado",
    "ciudad": "Curarrehue",
    "nombre": "Estacionamiento Salto el Puma",
    "direccion": "Curarrehue (centro)",
    "lat": -39.418956,
    "lng": -71.765785,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "curarrehue-2",
    "tipo": "privado",
    "ciudad": "Curarrehue",
    "nombre": "Los Tres Saltos de Huepil",
    "direccion": "Curarrehue (centro)",
    "lat": -39.209112,
    "lng": -71.737197,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "curarrehue-3",
    "tipo": "privado",
    "ciudad": "Curarrehue",
    "nombre": "Montevivo Parque Termal",
    "direccion": "Curarrehue (centro)",
    "lat": -39.340371,
    "lng": -71.693568,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "curarrehue-4",
    "tipo": "privado",
    "ciudad": "Curarrehue",
    "nombre": "Parque Termal y Complejo Turístico Trancura",
    "direccion": "Curarrehue (centro)",
    "lat": -39.340872,
    "lng": -71.695239,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "curarrehue-5",
    "tipo": "privado",
    "ciudad": "Curarrehue",
    "nombre": "Salto al paguin entrance",
    "direccion": "Curarrehue (centro)",
    "lat": -39.385077,
    "lng": -71.784966,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "curarrehue-6",
    "tipo": "privado",
    "ciudad": "Curarrehue",
    "nombre": "Termas de Curarrehue",
    "direccion": "Curarrehue (centro)",
    "lat": -39.347967,
    "lng": -71.596714,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "curarrehue-7",
    "tipo": "privado",
    "ciudad": "Curarrehue",
    "nombre": "Termas de Menetue",
    "direccion": "Curarrehue (centro)",
    "lat": -39.330156,
    "lng": -71.721544,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "curarrehue-8",
    "tipo": "privado",
    "ciudad": "Curarrehue",
    "nombre": "Termas de Palguin",
    "direccion": "Curarrehue (centro)",
    "lat": -39.41973,
    "lng": -71.783476,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "curarrehue-9",
    "tipo": "privado",
    "ciudad": "Curarrehue",
    "nombre": "Termas de Quimey-Co",
    "direccion": "Curarrehue (centro)",
    "lat": -39.219613,
    "lng": -71.695859,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "curarrehue-10",
    "tipo": "privado",
    "ciudad": "Curarrehue",
    "nombre": "Termas Los Pozones",
    "direccion": "Curarrehue (centro)",
    "lat": -39.226087,
    "lng": -71.64885,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "ercilla-1",
    "tipo": "privado",
    "ciudad": "Ercilla",
    "nombre": "Área de Descanso",
    "direccion": "Ercilla (centro)",
    "lat": -38.125673,
    "lng": -72.330504,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "freire-1",
    "tipo": "privado",
    "ciudad": "Freire",
    "nombre": "Área Descanso Freire",
    "direccion": "Ruta 5 Sur",
    "lat": -38.937632,
    "lng": -72.623124,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "freire-2",
    "tipo": "privado",
    "ciudad": "Freire",
    "nombre": "Estacion de Trenes de Freire",
    "direccion": "Freire (centro)",
    "lat": -38.94847,
    "lng": -72.628125,
    "precioHora": 0,
    "fraccion": null,
    "gratis": "Gratis para clientes",
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "freire-3",
    "tipo": "privado",
    "ciudad": "Freire",
    "nombre": "Estacionamiento Supersur",
    "direccion": "Freire (centro)",
    "lat": -38.95547,
    "lng": -72.625016,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "freire-4",
    "tipo": "privado",
    "ciudad": "Freire",
    "nombre": "Feria Araucanía",
    "direccion": "Freire (centro)",
    "lat": -38.960825,
    "lng": -72.618851,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "freire-5",
    "tipo": "privado",
    "ciudad": "Freire",
    "nombre": "Feria Araucanía",
    "direccion": "Freire (centro)",
    "lat": -38.960459,
    "lng": -72.62001,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "galvarino-1",
    "tipo": "privado",
    "ciudad": "Galvarino",
    "nombre": "Estacionamiento Hospital Galvarino",
    "direccion": "Galvarino (centro)",
    "lat": -38.410645,
    "lng": -72.785681,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "galvarino-2",
    "tipo": "privado",
    "ciudad": "Galvarino",
    "nombre": "Media Luna Club de Huasos Santa Rosa de Galvarino",
    "direccion": "Galvarino (centro)",
    "lat": -38.410173,
    "lng": -72.775903,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "galvarino-3",
    "tipo": "privado",
    "ciudad": "Galvarino",
    "nombre": "Plaza Galvarino",
    "direccion": "Galvarino (centro)",
    "lat": -38.411652,
    "lng": -72.781207,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "labranza-1",
    "tipo": "privado",
    "ciudad": "Labranza",
    "nombre": "Estacionamiento Acuenta",
    "direccion": "Labranza (centro)",
    "lat": -38.767857,
    "lng": -72.760165,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "labranza-2",
    "tipo": "privado",
    "ciudad": "Labranza",
    "nombre": "Estacionamiento Santa Isabel",
    "direccion": "Labranza (centro)",
    "lat": -38.767519,
    "lng": -72.766685,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "lautaro-1",
    "tipo": "privado",
    "ciudad": "Lautaro",
    "nombre": "Area de Descanso",
    "direccion": "Ruta 5 Sur",
    "lat": -38.649837,
    "lng": -72.472967,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "lautaro-2",
    "tipo": "privado",
    "ciudad": "Lautaro",
    "nombre": "Estacionamiento Quincho Huasos",
    "direccion": "Lautaro (centro)",
    "lat": -38.544712,
    "lng": -72.43096,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 30,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "lautaro-3",
    "tipo": "privado",
    "ciudad": "Lautaro",
    "nombre": "Plaza de Armas Lautaro",
    "direccion": "Lautaro (centro)",
    "lat": -38.533931,
    "lng": -72.435502,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "lonquimay-1",
    "tipo": "privado",
    "ciudad": "Lonquimay",
    "nombre": "Conaf Reserva Nacional Malalcahuello",
    "direccion": "Lonquimay (centro)",
    "lat": -38.470959,
    "lng": -71.570748,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "nueva-imperial-1",
    "tipo": "privado",
    "ciudad": "Nueva Imperial",
    "nombre": "Super Bodega Acuenta",
    "direccion": "Nueva Imperial (centro)",
    "lat": -38.741453,
    "lng": -72.952927,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "padre-las-casas-1",
    "tipo": "privado",
    "ciudad": "Padre Las Casas",
    "nombre": "Estacionamiento Acuenta",
    "direccion": "Padre Las Casas (centro)",
    "lat": -38.77184,
    "lng": -72.597168,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "padre-las-casas-2",
    "tipo": "privado",
    "ciudad": "Padre Las Casas",
    "nombre": "Estacionamiento Aeropuerto Maquehue de Temuco",
    "direccion": "Padre Las Casas (centro)",
    "lat": -38.770569,
    "lng": -72.638018,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "padre-las-casas-3",
    "tipo": "privado",
    "ciudad": "Padre Las Casas",
    "nombre": "Estacionamiento Mayorista 10",
    "direccion": "Padre Las Casas (centro)",
    "lat": -38.753629,
    "lng": -72.619081,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "padre-las-casas-4",
    "tipo": "privado",
    "ciudad": "Padre Las Casas",
    "nombre": "Estacionamiento Municipalidad",
    "direccion": "Padre Las Casas (centro)",
    "lat": -38.773329,
    "lng": -72.597489,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "padre-las-casas-5",
    "tipo": "privado",
    "ciudad": "Padre Las Casas",
    "nombre": "Estacionamiento Supermercado el Trébol",
    "direccion": "Padre Las Casas (centro)",
    "lat": -38.75442,
    "lng": -72.627705,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "padre-las-casas-6",
    "tipo": "privado",
    "ciudad": "Padre Las Casas",
    "nombre": "Estacionamiento Supermercado Santa ISabel",
    "direccion": "Padre Las Casas (centro)",
    "lat": -38.767693,
    "lng": -72.596493,
    "precioHora": 0,
    "fraccion": null,
    "gratis": "Gratis para clientes",
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "padre-las-casas-7",
    "tipo": "privado",
    "ciudad": "Padre Las Casas",
    "nombre": "Estacionamiento Unimarc",
    "direccion": "Padre Las Casas (centro)",
    "lat": -38.771535,
    "lng": -72.597816,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "padre-las-casas-8",
    "tipo": "privado",
    "ciudad": "Padre Las Casas",
    "nombre": "Mercado Padre Las Casas",
    "direccion": "Padre Las Casas (centro)",
    "lat": -38.768367,
    "lng": -72.598583,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "perquenco-1",
    "tipo": "privado",
    "ciudad": "Perquenco",
    "nombre": "Estacionamiento para vehículos",
    "direccion": "Perquenco (centro)",
    "lat": -38.490551,
    "lng": -72.251344,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 6,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "pitrufquen-1",
    "tipo": "privado",
    "ciudad": "Pitrufquén",
    "nombre": "Roma Pub Discotheque",
    "direccion": "Pitrufquén (centro)",
    "lat": -38.968981,
    "lng": -72.631209,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "pucon-1",
    "tipo": "privado",
    "ciudad": "Pucón",
    "nombre": "Aeródromo de Pucón (SCPC)",
    "direccion": "Pucón (centro)",
    "lat": -39.289909,
    "lng": -71.922428,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "pucon-2",
    "tipo": "privado",
    "ciudad": "Pucón",
    "nombre": "Centro Comercial Alto Pucón",
    "direccion": "Pucón (centro)",
    "lat": -39.283221,
    "lng": -71.95048,
    "precioHora": 0,
    "fraccion": null,
    "gratis": "Gratis para clientes",
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "pucon-3",
    "tipo": "privado",
    "ciudad": "Pucón",
    "nombre": "Eltit",
    "direccion": "Pucón (centro)",
    "lat": -39.274353,
    "lng": -71.971597,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "pucon-4",
    "tipo": "privado",
    "ciudad": "Pucón",
    "nombre": "Estacionamiento (Pucón)",
    "direccion": "Pucón (centro)",
    "lat": -39.303738,
    "lng": -72.032147,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "pucon-5",
    "tipo": "privado",
    "ciudad": "Pucón",
    "nombre": "Estacionamiento Fresia",
    "direccion": "Pucón (centro)",
    "lat": -39.276944,
    "lng": -71.975539,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "pucon-6",
    "tipo": "privado",
    "ciudad": "Pucón",
    "nombre": "Estacionamiento O'Higgins",
    "direccion": "Pucón (centro)",
    "lat": -39.276764,
    "lng": -71.975124,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "pucon-7",
    "tipo": "privado",
    "ciudad": "Pucón",
    "nombre": "Estacionamiento Pucón Green Park",
    "direccion": "Pucón (centro)",
    "lat": -39.287774,
    "lng": -71.938959,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "pucon-8",
    "tipo": "privado",
    "ciudad": "Pucón",
    "nombre": "Lider Express",
    "direccion": "Pucón (centro)",
    "lat": -39.275994,
    "lng": -71.966032,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "pucon-9",
    "tipo": "privado",
    "ciudad": "Pucón",
    "nombre": "Ojos del Caburgua",
    "direccion": "Pucón (centro)",
    "lat": -39.23969,
    "lng": -71.83441,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "pucon-10",
    "tipo": "privado",
    "ciudad": "Pucón",
    "nombre": "Ojos del Caburgua",
    "direccion": "Pucón (centro)",
    "lat": -39.2378,
    "lng": -71.833923,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "pucon-11",
    "tipo": "privado",
    "ciudad": "Pucón",
    "nombre": "Plaza Sor Huberta Bohn",
    "direccion": "Pucón (centro)",
    "lat": -39.278279,
    "lng": -71.977244,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "puerto-saavedra-1",
    "tipo": "privado",
    "ciudad": "Puerto Saavedra",
    "nombre": "Playa Maule",
    "direccion": "Puerto Saavedra (centro)",
    "lat": -38.814261,
    "lng": -73.401468,
    "precioHora": 600,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-1",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Andres Bello / Vicuña Mackenna",
    "direccion": "Temuco (centro)",
    "lat": -38.741445,
    "lng": -72.592974,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-2",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Centro Comercial Barrio Inglés",
    "direccion": "Temuco (centro)",
    "lat": -38.740892,
    "lng": -72.642313,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-3",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Clinica Alemana",
    "direccion": "Temuco (centro)",
    "lat": -38.736399,
    "lng": -72.611089,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-4",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Construmart",
    "direccion": "Temuco (centro)",
    "lat": -38.729818,
    "lng": -72.605788,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-5",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Easy",
    "direccion": "Temuco (centro)",
    "lat": -38.746765,
    "lng": -72.607944,
    "precioHora": 0,
    "fraccion": null,
    "gratis": "Gratis para clientes",
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-6",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Ebema",
    "direccion": "Temuco (centro)",
    "lat": -38.714036,
    "lng": -72.564114,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-7",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Estacionamiento Centro Comercial Alemania",
    "direccion": "Temuco (centro)",
    "lat": -38.733683,
    "lng": -72.615185,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-8",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Estacionamiento Clínica RedSalud Mayor de Temuco",
    "direccion": "Temuco (centro)",
    "lat": -38.729449,
    "lng": -72.628409,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-9",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Estacionamiento German Becker",
    "direccion": "Temuco (centro)",
    "lat": -38.741275,
    "lng": -72.620476,
    "precioHora": 0,
    "fraccion": null,
    "gratis": "Gratis para clientes",
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-10",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Estacionamiento Manuel Montt",
    "direccion": "Temuco (centro)",
    "lat": -38.738677,
    "lng": -72.589702,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-11",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Estacionamiento Montt y Cruz",
    "direccion": "Manuel Montt 1162",
    "lat": -38.739399,
    "lng": -72.585594,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "10:00–22:00",
    "capacidad": 60,
    "verificado": false,
    "atributos": {
      "techado": true,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-12",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Estacionamiento Plaza de Armas Temuco",
    "direccion": "Temuco (centro)",
    "lat": -38.739945,
    "lng": -72.590112,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "10:00–22:00",
    "capacidad": 150,
    "verificado": false,
    "atributos": {
      "techado": true,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-13",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Estacionamiento Unimarc",
    "direccion": "Temuco (centro)",
    "lat": -38.739079,
    "lng": -72.610993,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "10:00–22:00",
    "capacidad": 50,
    "verificado": false,
    "atributos": {
      "techado": true,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-14",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Inacap",
    "direccion": "Temuco (centro)",
    "lat": -38.725736,
    "lng": -72.630872,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-15",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Lider",
    "direccion": "Temuco (centro)",
    "lat": -38.728537,
    "lng": -72.601868,
    "precioHora": 0,
    "fraccion": null,
    "gratis": "Gratis para clientes",
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-16",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Líder",
    "direccion": "Temuco (centro)",
    "lat": -38.73485,
    "lng": -72.640839,
    "precioHora": 0,
    "fraccion": null,
    "gratis": "Gratis para clientes",
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-17",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Mall Mirage",
    "direccion": "Temuco (centro)",
    "lat": -38.732326,
    "lng": -72.615139,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-18",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Minimarket San Martin",
    "direccion": "Temuco (centro)",
    "lat": -38.735463,
    "lng": -72.624892,
    "precioHora": 0,
    "fraccion": null,
    "gratis": "Gratis para clientes",
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-19",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Museo Ferroviario",
    "direccion": "Temuco (centro)",
    "lat": -38.728946,
    "lng": -72.570167,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-20",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Portal Temuco",
    "direccion": "Avenida Alemania 0671",
    "lat": -38.733065,
    "lng": -72.610364,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "10:00–22:00",
    "capacidad": 150,
    "verificado": false,
    "atributos": {
      "techado": true,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-21",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Revisión Técnica",
    "direccion": "Temuco (centro)",
    "lat": -38.713556,
    "lng": -72.565217,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-22",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Santa isabel",
    "direccion": "Temuco (centro)",
    "lat": -38.738883,
    "lng": -72.632174,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-23",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Solar / Vicuña Mackenna",
    "direccion": "Temuco (centro)",
    "lat": -38.73884,
    "lng": -72.592364,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-24",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Solar / Vicuña Mackenna",
    "direccion": "Temuco (centro)",
    "lat": -38.739498,
    "lng": -72.591738,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-25",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Teatro Municipal",
    "direccion": "Temuco (centro)",
    "lat": -38.740437,
    "lng": -72.623647,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-26",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Terminal Tur Bus Temuco",
    "direccion": "Temuco (centro)",
    "lat": -38.716189,
    "lng": -72.568286,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-27",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Unimarc",
    "direccion": "Temuco (centro)",
    "lat": -38.74299,
    "lng": -72.631737,
    "precioHora": 0,
    "fraccion": null,
    "gratis": "Gratis para clientes",
    "horario": "10:00–22:00",
    "capacidad": 150,
    "verificado": false,
    "atributos": {
      "techado": true,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-28",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Unimarc",
    "direccion": "Temuco (centro)",
    "lat": -38.741984,
    "lng": -72.60552,
    "precioHora": 0,
    "fraccion": null,
    "gratis": "Gratis para clientes",
    "horario": "10:00–22:00",
    "capacidad": 150,
    "verificado": false,
    "atributos": {
      "techado": true,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "temuco-29",
    "tipo": "privado",
    "ciudad": "Temuco",
    "nombre": "Unimarc",
    "direccion": "Temuco (centro)",
    "lat": -38.742061,
    "lng": -72.605113,
    "precioHora": 0,
    "fraccion": null,
    "gratis": "Gratis para clientes",
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "victoria-1",
    "tipo": "privado",
    "ciudad": "Victoria",
    "nombre": "Estacionamientos Plaza de Armas",
    "direccion": "Victoria (centro)",
    "lat": -38.233945,
    "lng": -72.332093,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "victoria-2",
    "tipo": "privado",
    "ciudad": "Victoria",
    "nombre": "Estacionamientos Plaza de Armas",
    "direccion": "Victoria (centro)",
    "lat": -38.233515,
    "lng": -72.331556,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "villarrica-1",
    "tipo": "privado",
    "ciudad": "Villarrica",
    "nombre": "ACuenta",
    "direccion": "Villarrica (centro)",
    "lat": -39.291472,
    "lng": -72.229835,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "villarrica-2",
    "tipo": "privado",
    "ciudad": "Villarrica",
    "nombre": "Costanera Villarrica",
    "direccion": "Villarrica (centro)",
    "lat": -39.283012,
    "lng": -72.222086,
    "precioHora": 0,
    "fraccion": null,
    "gratis": "Gratis para clientes",
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "villarrica-3",
    "tipo": "privado",
    "ciudad": "Villarrica",
    "nombre": "estacionamiento consultorio",
    "direccion": "Villarrica (centro)",
    "lat": -39.489562,
    "lng": -72.154507,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 3,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "villarrica-4",
    "tipo": "privado",
    "ciudad": "Villarrica",
    "nombre": "Estacionamiento Costanera Villarrica",
    "direccion": "Villarrica (centro)",
    "lat": -39.284394,
    "lng": -72.221825,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "villarrica-5",
    "tipo": "privado",
    "ciudad": "Villarrica",
    "nombre": "Estacionamiento Lafquén",
    "direccion": "Villarrica (centro)",
    "lat": -39.281022,
    "lng": -72.227706,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "villarrica-6",
    "tipo": "privado",
    "ciudad": "Villarrica",
    "nombre": "General Basilio Urrutia",
    "direccion": "Villarrica (centro)",
    "lat": -39.490179,
    "lng": -72.155826,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "villarrica-7",
    "tipo": "privado",
    "ciudad": "Villarrica",
    "nombre": "General Basilio Urrutia",
    "direccion": "Villarrica (centro)",
    "lat": -39.489382,
    "lng": -72.156919,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "villarrica-8",
    "tipo": "privado",
    "ciudad": "Villarrica",
    "nombre": "General Basilio Urrutia",
    "direccion": "Villarrica (centro)",
    "lat": -39.489521,
    "lng": -72.15691,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "villarrica-9",
    "tipo": "privado",
    "ciudad": "Villarrica",
    "nombre": "Lider Express",
    "direccion": "Villarrica (centro)",
    "lat": -39.289517,
    "lng": -72.223354,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "villarrica-10",
    "tipo": "privado",
    "ciudad": "Villarrica",
    "nombre": "Sodimac",
    "direccion": "Villarrica (centro)",
    "lat": -39.291132,
    "lng": -72.218999,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "villarrica-11",
    "tipo": "privado",
    "ciudad": "Villarrica",
    "nombre": "Sodimac",
    "direccion": "Villarrica (centro)",
    "lat": -39.291777,
    "lng": -72.220152,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "id": "villarrica-12",
    "tipo": "privado",
    "ciudad": "Villarrica",
    "nombre": "Supermercado Eltit",
    "direccion": "Villarrica (centro)",
    "lat": -39.29098,
    "lng": -72.221115,
    "precioHora": 900,
    "fraccion": null,
    "gratis": null,
    "horario": "08:30–20:00",
    "capacidad": 40,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "tipo": "calle",
    "ciudad": "Temuco",
    "id": "temuco-calle-1",
    "nombre": "Calle Arturo Prat",
    "direccion": "Arturo Prat 500",
    "lat": -38.7385,
    "lng": -72.5965,
    "precioHora": 500,
    "gratis": "20:00–09:00 y domingos",
    "horario": "Parquímetro 09:00–20:00",
    "demandaBase": 0.85,
    "fraccion": null,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "tipo": "calle",
    "ciudad": "Temuco",
    "id": "temuco-calle-2",
    "nombre": "Calle Claro Solar",
    "direccion": "Claro Solar 600",
    "lat": -38.7402,
    "lng": -72.595,
    "precioHora": 500,
    "gratis": "20:00–09:00 y domingos",
    "horario": "Parquímetro 09:00–20:00",
    "demandaBase": 0.6,
    "fraccion": null,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "tipo": "calle",
    "ciudad": "Temuco",
    "id": "temuco-calle-3",
    "nombre": "Calle Vicuña Mackenna",
    "direccion": "Vicuña Mackenna 720",
    "lat": -38.7378,
    "lng": -72.5985,
    "precioHora": 500,
    "gratis": "20:00–09:00 y domingos",
    "horario": "Parquímetro 09:00–20:00",
    "demandaBase": 0.5,
    "fraccion": null,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "tipo": "calle",
    "ciudad": "Temuco",
    "id": "temuco-calle-4",
    "nombre": "Calle Antonio Varas",
    "direccion": "Antonio Varas 980",
    "lat": -38.741,
    "lng": -72.598,
    "precioHora": 500,
    "gratis": "20:00–09:00 y domingos",
    "horario": "Parquímetro 09:00–20:00",
    "demandaBase": 0.55,
    "fraccion": null,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  },
  {
    "tipo": "calle",
    "ciudad": "Temuco",
    "id": "temuco-calle-5",
    "nombre": "Calle Lautaro",
    "direccion": "Lautaro 1100",
    "lat": -38.736,
    "lng": -72.5958,
    "precioHora": 0,
    "gratis": "Siempre gratis",
    "horario": "Libre",
    "demandaBase": 0.9,
    "fraccion": null,
    "verificado": false,
    "atributos": {
      "techado": false,
      "ev": false,
      "accesible": false,
      "camaras": false
    }
  }
];
