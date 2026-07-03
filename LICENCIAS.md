# Licencias y procedencia de datos — Estaciona

> **Orientación, NO asesoría legal.** Este documento resume la procedencia de los
> datos y las licencias de los componentes de Estaciona, con base en las fuentes
> oficiales de cada proveedor (jul-2026). Antes de una venta B2B (adquisición,
> white-label o licencia), un abogado en Chile debe validarlo. Sirve como material
> de *due diligence*: un comprador serio va a pedir exactamente esto.

## Resumen ejecutivo (semáforo)

| Componente | Para qué se usa | Licencia / plan hoy | ¿Uso comercial? | Estado | Acción |
|---|---|---|---|---|---|
| **Datos OpenStreetMap** (dataset `data.js`) | ~1.463 fichas (nombre, dirección, coords, pago/gratis) bajadas de OSM/Overpass | **ODbL 1.0** | Sí, con obligaciones | 🟡 | Atribuir + decidir estrategia de la base (ver §1) |
| **Nominatim** (servidor público de OSM) | Buscar direcciones + geocodificación inversa, en vivo | Usage Policy de OSM | **No para producción comercial** | 🔴 | Migrar a geocoder propio/pago (§2) |
| **MapTiler** (teselas de mapa) | Mapa base + satélite | **Plan gratuito** | **No** (el free es no-comercial) | 🔴 | Pasar a plan pago antes de producción (§3) |
| **TomTom** (Routing API) | ETA / tiempo con tráfico | Plan gratuito (Freemium) | Sí (incluso en free) | 🟡 | Dimensionar plan; no cachear para reservir (§3) |
| **Sightengine** (moderación de fotos) | Bloquear fotos con desnudez/drogas/armas | Plan gratuito (~2.000/mes, 500/día) | Sin prohibición explícita, pero es "para testing" | 🟡 | Pasar a plan pago ($29/mes+) para producción (§3) |
| **Cloudflare R2** (fotos) | Almacenamiento de imágenes | Infra pago-por-uso | Sí | 🟢 | — |
| **Neon / PostgreSQL** (base de datos) | Datos de la app | Infra | Sí | 🟢 | — |
| **Librerías open-source** (Leaflet, tfjs, nsfwjs, fuentes, Tailwind…) | Frontend | MIT / BSD / Apache / OFL | Sí, libre | 🟢 | Incluir aviso de licencias (hecho: `THIRD-PARTY-LICENSES.md`) |

**Regla de oro para B2B:** cada empresa que opere la app (el comprador) debe usar
**sus propias cuentas y API keys** de MapTiler, TomTom y Sightengine. Las tres
licencias son *non-transferable / non-sublicensable*: no se pueden revender ni
compartir las keys del vendedor dentro del producto. La app ya está diseñada para
que las keys sean configurables por variable de entorno, así que el traspaso es
solo de configuración.

---

## §1 — Datos de OpenStreetMap (ODbL): lo más importante

El dataset de estacionamientos se construyó bajando datos de OSM (vía Overpass).
Eso lo pone bajo la **Open Database License (ODbL) 1.0**. El uso comercial **está
permitido**, pero con dos obligaciones que importan para una venta:

- **Atribución.** Hay que mostrar "© OpenStreetMap contributors" con el texto
  "OpenStreetMap" enlazado a `openstreetmap.org/copyright`, visible y legible.
  **Ya está puesto** en el mapa de la app (y mencionado en `/terminos`). ✔️
- **Share-alike (la parte delicada para vender).** La ODbL distingue:
  - **Mostrar** los datos al usuario (mapa, lista, resultado de búsqueda) = *produced
    work* → **solo requiere atribución**. Esto es lo que hace la app hoy. ✔️
  - **Distribuir la base de datos** derivada (entregar el dataset al comprador,
    exportarlo, dar acceso a la base cruda, white-label entregando la BD) → esa base
    derivada **debe ofrecerse bajo ODbL** a quien la reciba. **No se puede vender como
    dataset propietario cerrado.**

**Implicación para la venta B2B:** si tu ventaja es "una base curada de
estacionamientos", el comprador hereda que **esa base sigue siendo ODbL** (abierta,
con atribución). Es vendible igual (muchos negocios se construyen sobre ODbL), pero
hay que decirlo, no esconderlo — una due diligence lo detecta.

**Opción para tener un activo 100% propietario (sin copyleft):** reconstruir las
fichas desde **fuentes propias** — relevamiento en terreno, datos municipales, o
tarifas oficiales de operadores — en vez de derivarlas de OSM. Los hechos puros
(una dirección, una coordenada, un precio publicado) no son de OSM; lo que "ata" a
ODbL es haberlos **extraído sustancialmente de OSM**. Esto conecta con el plan de
verificar Temuco en terreno: esa zona verificada a mano sería un activo limpio.

Fuentes: openstreetmap.org/copyright · opendatacommons.org/licenses/odbl/1-0/ ·
osmfoundation.org/wiki/Licence/Attribution_Guidelines

---

## §2 — Nominatim (geocodificación): riesgo a resolver 🔴

La app usa geocodificación para buscar direcciones y para prellenar la dirección
al reportar un lugar. El **servidor público** `nominatim.openstreetmap.org` (default
hoy) **prohíbe el uso comercial / de alto volumen**: la Usage Policy dice que *"las
aplicaciones cuya función principal sea geocodificar deben correr su propio
servicio"*. Límite duro: 1 request/segundo. Es aceptable para el **piloto**, no para
producción comercial.

**✅ YA PREPARADO — el cambio de proveedor es solo CONFIGURACIÓN.** La geocodificación
se abstrajo en `app/backend/src/geocoder.js` detrás de `/api/geocode` y `/api/reverse`
(el navegador ya NO llama a Nominatim directo; la key vive en el servidor). El
proveedor se elige por la env var **`GEOCODER`**, sin tocar código:

| Para producción comercial | Env vars |
|---|---|
| **Nominatim self-host** (dato OSM, gratis, control total) | `NOMINATIM_URL=https://tu-nominatim.tld` |
| **LocationIQ** (compatible Nominatim, plan pago) | `GEOCODER=locationiq` + `LOCATIONIQ_KEY=…` |
| **MapTiler** (usa la MAPTILER_KEY que ya tenés) | `GEOCODER=maptiler` |

El log de arranque del server muestra qué proveedor está activo (`geocoder → …`).
Fuente: operations.osmfoundation.org/policies/nominatim/

---

## §3 — Servicios con API key (MapTiler, TomTom, Sightengine)

- **MapTiler 🔴** — el **plan gratuito es NO comercial** (solo desarrollo/pruebas).
  Para producción comercial hace falta un **plan pago**. Atribución obligatoria (ya
  puesta). No se puede sublicenciar/revender las teselas: el comprador necesita su
  propia cuenta. Fuente: maptiler.com/terms/cloud · maptiler.com/cloud/pricing
- **TomTom 🟡** — el Freemium **sí permite uso comercial** (2.500 requests de
  Routing/día). Restricción: no cachear los ETA para servírselos a varios usuarios
  ni construir una base de rutas. Non-transferable → el comprador usa su cuenta.
  Fuente: developer.tomtom.com/pricing · /terms-and-conditions
- **Sightengine 🟡** — el free (2.000/mes, 500/día) está posicionado "para testing";
  no prohíbe la finalidad comercial pero el tope diario no aguanta producción. Plan
  pago desde **US$29/mes** (10.000 ops). Revender la API "pelada" está prohibido;
  venderla integrada en tu app está permitido. El comprador necesita su cuenta.
  Fuente: sightengine.com/pricing · /policies/terms

---

## Acciones priorizadas (para dejar la app "limpia" para B2B)

1. **P1 — Geocoder:** ✅ código ya abstraído (`GEOCODER` env var). Falta solo la
   DECISIÓN de proveedor para producción (self-host / LocationIQ / MapTiler) y setear la env var. 🟡
2. **P2 — MapTiler:** pasar a plan pago antes de operar comercialmente. 🔴
3. **P3 — Definir la estrategia de la base de datos** frente a ODbL: ¿se muestra
   (produced work, solo atribución) o se entrega/white-label (la base va bajo ODbL)?
   Y, si se quiere un activo propietario, reconstruir la zona piloto desde fuentes propias. 🟡
4. **P4 — Contrato de venta:** cláusula de que el comprador provisiona sus propias
   cuentas/keys (MapTiler, TomTom, Sightengine); no transferir las tuyas. 🟡
5. **P5 — Sightengine a plan pago** cuando haya volumen real de fotos. 🟡
6. **P6 — Dossier de procedencia de datos** para el comprador: este documento +
   `THIRD-PARTY-LICENSES.md` + de dónde salió cada precio verificado. 🟢 (hecho)

---

## Fuentes oficiales
- OSM / ODbL: openstreetmap.org/copyright · opendatacommons.org/licenses/odbl/1-0/ · osmfoundation.org/wiki/Licence/Attribution_Guidelines · operations.osmfoundation.org/policies/nominatim/
- MapTiler: maptiler.com/terms/cloud · maptiler.com/cloud/pricing
- TomTom: developer.tomtom.com/terms-and-conditions · developer.tomtom.com/pricing
- Sightengine: sightengine.com/policies/terms · sightengine.com/pricing

*Última revisión: julio 2026. Reitero: orientación, no asesoría legal.*
