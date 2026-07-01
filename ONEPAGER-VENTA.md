# Estaciona — Plataforma de estacionamientos

**Encuentra estacionamiento en segundos.** Web app (instalable) que muestra estacionamientos cercanos en un mapa, con precio, horario, disponibilidad y cómo llegar. Cobertura nacional. Sin necesidad de crear cuenta.

> Documento comercial · versión demo. Última actualización: julio 2026.
> Demo en vivo: `https://estaciona-app-production.up.railway.app` (acceso privado — se entrega usuario/clave a pedido).

---

## El problema

Buscar estacionamiento en la ciudad es a ciegas: das vueltas, no sabes el precio hasta llegar, ni si está lleno, ni si es solo para clientes. Se pierde tiempo, combustible y paciencia.

## La solución

Una app simple, rápida y visual que responde tres preguntas antes de salir del auto:
**¿dónde? ¿cuánto cuesta? ¿está disponible?**

---

## Qué hace hoy (funcionando)

- **Mapa nacional** con estacionamientos reales geolocalizados (privados, malls, calle con parquímetro).
- **Ficha por estacionamiento**: nombre, dirección, horario, abierto/cerrado ahora, tipo (pago / gratis / gratis solo clientes), categoría (salud, colegio, mall, etc.).
- **Cómo llegar**: tiempo de auto **con tráfico real** y tiempo caminando de vuelta; botón directo a Google Maps o Waze.
- **Filtros y búsqueda**: por cercanía, precio, servicios, "solo públicos", por nombre o dirección.
- **Selector por ciudad/región** (todo Chile) y detección automática por GPS.
- **"Mi auto"**: recuerda dónde lo dejaste, estima cuánto llevas y cuánto gastas, y te avisa.
- **Comunidad estilo Waze**: la gente reporta precios reales, deja comentarios y sube fotos — sin cuenta.
- **Moderación automática**: filtro de imágenes en 2 capas (desnudos, drogas, armas, violencia) + panel de administración.
- **Vista satelital**, modo oscuro, favoritos, funciona en PC y celular.

## Bajo el capó (para el equipo técnico)

- Stack liviano: **Node** (sin dependencias externas) + JavaScript + **Leaflet / MapTiler**. Se despliega en minutos.
- Datos de ubicación desde **OpenStreetMap** (fuente abierta), tráfico y rutas vía **TomTom**.
- Moderación con **nsfwjs** (en el navegador) + **Sightengine** (en la nube).
- Desplegada en **Railway**. Código ordenado y documentado.

---

## Qué es REAL y qué falta (transparencia total)

Ponemos esto por delante a propósito: en datos, la honestidad es el producto.

| Dato | Estado hoy |
|---|---|
| Nombre, dirección y ubicación en el mapa | ✅ **Real** (OpenStreetMap, ~1.460 puntos, todo Chile) |
| Precios | ⚠️ **Estimados** por regla, salvo los verificados (ver zona piloto) — se marcan como "estimado, sin verificar" |
| Disponibilidad de cupos en vivo | ⚠️ **Simulada** — requiere integración con el recinto o sensores |
| Horarios | ⚠️ Estimados; se confirman en terreno o con el operador |
| Precios reportados por la comunidad | ✅ Reales cuando la gente los aporta |

**La plataforma ya está lista para recibir datos reales.** Cargar el precio/horario verificado de un estacionamiento es una línea de configuración; la disponibilidad en vivo se conecta a la fuente del operador (API, barrera, sensor).

---

## Zona piloto: Temuco (caso demostrable)

Estamos verificando **el centro de Temuco en terreno** para mostrar cómo se ve la app con datos 100% reales, no estimados.

- **Ya verificado con tarifa oficial (8 puntos):** Portal Temuco ($20/min), calles con parquímetro del centro ($27/min), EC Parking Falabella (gratis con compra), PlusParken SOFO y aeropuerto La Araucanía — cada uno con su fuente oficial citada.
- **En verificación (contacto directo con cada recinto):** subterráneos Plaza Aníbal Pinto (315 cupos, 24 h) y Manuel Recabarren, Manuel Montt, clínicas, supermercados y demás del centro.
- **Método replicable:** el mismo proceso —precio, horario y cupos confirmados uno a uno— se aplica a cualquier ciudad o red que el cliente quiera activar.

> En una demo se puede recorrer Temuco y ver la diferencia entre una ficha *verificada* (precio firme, fuente citada) y una *estimada*. Ese es el estándar al que se lleva toda zona contratada.

---

## Modelos de negocio posibles

1. **White-label / licencia** — Marca blanca para una municipalidad, mall o empresa de estacionamientos. Tú pones tus datos reales; nosotros la plataforma.
2. **Piloto pagado por zona** — Montamos una ciudad o red con datos 100% verificados en terreno. Cobro por implementación + mantención.
3. **Venta del activo** — Traspaso del producto y código completo.

---

## Por qué conviene

- **Ya existe y funciona** — no se parte de cero; el time-to-market es inmediato.
- **Liviana y barata de operar** — sin infraestructura pesada ni licencias caras.
- **Extensible** — la base de comunidad, moderación y datos abiertos permite crecer a reservas, pagos y sensores.
- **Honesta con los datos** — el camino a "todo verificado" está trazado y es de bajo costo.

---

## Contacto

**Pablo Espinoza** · pdanielespinozavega@gmail.com

*Solicita acceso a la demo en vivo o una reunión de 20 minutos.*
