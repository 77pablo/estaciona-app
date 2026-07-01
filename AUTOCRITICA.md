# Autocrítica de Estaciona — 1 de julio de 2026

Revisión adversarial y honesta de TODO el proyecto (código, interfaz, datos, negocio),
hecha con 4 auditores independientes que leyeron el código real. Este documento resume
los hallazgos, lo que **se arregló** ese día y lo que **queda pendiente**.

---

## Veredicto de conjunto

Ingeniería pulida y honesta, muy por encima de lo esperable para un dueño no-dev senior,
pero el proyecto va **por delante de la evidencia**: mucho código y estrategia, cero usuarios
validados y cero ingresos. Lo que está genuinamente bien: la **honestidad de los datos**
(el `~est.`, el flag `verificado`, no inventar cupos en vivo), la accesibilidad de los
diálogos y la robustez del mapa.

---

## Hallazgos por área

### Datos (lo más delicado — es el corazón del producto)
- **94% de los precios son estimados** ($600/$900 por regla). Solo ~6% verificado con fuente.
- ~400 fichas **no son parking público** (supermercados, bencineras, hospitales, colegios…).
- **95% de las direcciones** son solo "Ciudad (centro)", no una calle navegable.
- Snapshot de OpenStreetMap **congelado**, sin refresco automático.
- La disponibilidad (semáforo) es **estimación por hora**, no ocupación real (bien rotulada).

### Backend / seguridad
- Clave admin aceptada por `?clave=` (se filtraba a logs/URL/Referer).
- Moderación de fotos **fail-open** y saltable por POST directo → riesgo de contenido ilegal
  almacenado y servido público.
- Relleno de disco posible con `id` inventados.
- Escrituras perdidas en silencio si la base de datos no cargaba (respondía `ok`).
- XSS latente (texto sin sanear), sin cabeceras de seguridad, DoS por escaneo de tabla.

### Frontend / interfaz
- `app.js` es un **monolito de 2.670 líneas** sin módulos (deuda técnica).
- **Tailwind por CDN** en la portada (no apto para producción).
- **Pro** es burlable desde la consola (gate en `localStorage`).
- Búsqueda de direcciones depende de **Nominatim público** (frágil a escala).
- La barra de disponibilidad **fingía un porcentaje** de cupos.

### Producto / negocio
- Probabilidad de convertirse en negocio rentable: **~5-10%** (honesto).
- "Destacados" le vende publicidad a operadores que **no la necesitan** (~$60/mes en el mejor caso).
- "Pro" es cosmético; nadie paga por eso.
- El foso real es el **precio + detalle específico de parking** que Google no muestra… pero
  **hoy no está entregado** porque el 94% de los precios son estimados.
- **Debate Google (Abel tenía razón):** Google NO muestra precios $/hr ni el detalle de
  parking; su disponibilidad ("popular times") sí es real por GPS, la de la app es estimada.
  Conclusión: el diferenciador es real pero aún no entregado → **el trabajo que importa es
  conseguir precios reales en terreno (Temuco), no más features.**

---

## Lo que se ARREGLÓ el 1-jul-2026 (verificado: node --check + 25/25 tests + smoke en vivo)

### Seguridad backend
- `esAdmin` **solo por header** + comparación `timingSafeEqual`; se eliminó `?clave=`.
- Moderación de fotos ahora **fail-CLOSED**: sin credenciales o si la API falla, NO se guarda
  (503). Opt-out consciente con `FOTOS_SIN_MODERAR=1`.
- `/api/foto` valida que el `id` sea un lugar real (dataset o reportado) → cierra el relleno de disco.
- Votos/aportes/lugares devuelven fallo real si la base no cargó (no más escritura perdida).
- Saneo de `<>` y control en el texto de la gente (anti-XSS en origen).
- Cabeceras `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `X-Frame-Options`.
- Cache de 15s de agregados en `/api/estacionamientos` (anti-DoS).
- `registrarLugar` serializado (anti-carrera en el dedupe).

### Honestidad / datos
- Barra de disponibilidad → **3 segmentos por nivel** (no finge un %).
- Nueva categoría **"Comercio"** (supermercados/bencineras/farmacias/bancos): cobertura de
  categoría de 13% → **32%**; el filtro "Solo públicos" ahora los oculta.
- Portada: "Datos de verdad" → "Ubicaciones reales" + nota honesta ("precios en su mayoría estimados").
- `/admin` re-marcado a teal + Urbanist (estaba en lima + Inter).

### Robustez
- `setInterval` de 1s: alarma + recordatorios bajados a 5s (siguen en 2º plano); "Mi auto" en
  vivo solo si la pestaña es visible.

### NO se hizo a propósito (contradice "congelar y validar")
- Refactor de `app.js` en módulos, compilar Tailwind, Pro con cuentas reales. Son deuda mayor;
  primero validar en terreno.

---

## Pendiente (de Abel)

1. **Billing de Railway** — crédito casi agotado ("$4.91 / 0 days"). Sin resolverlo, la app se apaga.
2. **`SIGHTENGINE_SECRET`** en Railway — solo está `SIGHTENGINE_USER`. Con el fail-closed, sin el
   secret la subida de fotos queda deshabilitada. (Los valores salen de sightengine.com → Dashboard.)
3. **Push** de estos cambios por GitHub Desktop → dispara el deploy con los arreglos.
4. **Terreno Temuco** — verificar precios reales (es el trabajo que de verdad da ventaja).

## Confirmado en producción
- **Neon/Postgres ACTIVO** (log: "PostgreSQL administrado (multi-instancia)"), 1 réplica, US West.
