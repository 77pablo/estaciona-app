# Estaciona — instrucciones del proyecto

App web para encontrar estacionamientos en Chile. Sin cuentas de usuario (los
datos del auto/historial/favoritos viven en `localStorage`).

## Stack (importante para elegir soluciones)

- **Backend:** Node.js con el módulo `http` nativo — **NO hay Express ni ningún
  framework**. Por eso NO se usan `express-rate-limit`, `helmet`, etc.: las
  protecciones ya están implementadas a mano en `app/backend/src/server.js`.
- **Frontend:** JS vanilla (`app/web/app.js`, script clásico con funciones
  globales) + Leaflet vendorizado en `/vendor`. **NO hay React.**
- **Datos:** SQLite en local, PostgreSQL/Neon en producción, vía el adaptador
  `db.js` (traduce el dialecto con `toPg()`). Fotos en Cloudflare R2.
- **Deploy:** push a GitHub `77pablo/estaciona-app` → Railway auto-deploya.

## Cómo correr

- Local: `PORT=4124 node app/backend/src/server.js` (usa SQLite).
- Tests: desde `app/backend` → `npm test` (deben pasar **25/25**).

## Reglas de producto

- **Honestidad de datos:** nunca mostrar un dato estimado como si fuera
  verificado. Los precios estimados se marcan (`~est.`) distinto de los
  verificados/`pagado`.
- **No scrapear Google Maps** ni usar sus reseñas (contenido licenciado). Las
  reseñas de la app son propias.

---

# Seguridad (aplicar en cada archivo y endpoint)

Este proyecto sigue buenas prácticas de seguridad web. La mayoría ya está
implementada; al crear código nuevo, respetá estas reglas y reutilizá los
mecanismos existentes en vez de introducir librerías nuevas.

## 1. Rate limiting
- **Todo endpoint** de la API debe pasar por el helper existente
  `rateLimit(req, max, ventanaMs)` de `server.js` (ventana deslizante en
  memoria por IP). No agregar `express-rate-limit`: no hay Express.
- Al exceder el límite, responder **429** con un body claro (ej.
  `{ ok: false, error: 'rate' }`).
- Límites de referencia: API general ~100/15 min; acciones sensibles/aportes
  (POST de reseñas, correcciones, reportes) ~20/10 min; endpoints admin ~10/15
  min. Ajustar según el costo real del endpoint.

## 2. Variables de entorno y secretos
- **NUNCA** hardcodear API keys, tokens, contraseñas ni secretos. Siempre
  `process.env`.
- `.env` y `.env.*` ya están en `.gitignore` — mantenerlo así.
- Toda variable nueva se documenta en `.env.example` **solo con el nombre**
  (sin el valor real).
- Validar al arrancar que existen las env vars requeridas para el modo actual;
  si falta alguna crítica, la app no debe iniciar (o debe degradar de forma
  explícita y logueada, ej. R2/moderación opcionales).

## 3. Validación de inputs (anti-inyección)
- Validar y sanitizar **todos** los inputs (query params, headers, body) antes
  de procesarlos: tipar, acotar longitud, y rechazar lo que no calce.
- **Nunca** construir SQL concatenando input. Usar **siempre** queries
  parametrizadas (`run/get/all('... WHERE id = ?', [valor])`) — ya es el patrón
  en todo el backend. Mantenerlo.
- Escapar todo output que se renderice como HTML para prevenir XSS. En el
  frontend se usa el helper `esc()`; usarlo en cualquier texto de usuario que
  entre al DOM. Evitar `innerHTML` con datos sin escapar.
- Rechazar y **loguear** los inputs que no pasen la validación.

## 4. Headers de seguridad
- Ya se envían en `server.js` y deben mantenerse: `Content-Security-Policy`
  (whitelist real de orígenes), `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Strict-Transport-Security`.
- La CSP es una whitelist: si se agrega un origen nuevo (API, CDN, tile
  server), actualizar la CSP en vez de aflojarla.

## 5. Autenticación y sesiones
- Hoy la app **no tiene cuentas**; el estado del usuario vive en `localStorage`.
  El acceso admin/privado usa una clave por env var (`ACCESO_CLAVE`).
- **Si en el futuro se agregan cuentas o cookies de sesión:** cookies
  `httpOnly`, `secure`, `sameSite`; protección CSRF en formularios; y hashear
  contraseñas con **bcrypt o argon2** (nunca texto plano).

## 6. Logging de seguridad
- Loguear: intentos fallidos de acceso admin, peticiones que exceden el rate
  limit, e inputs rechazados por validación (posible inyección).
- **NUNCA** loguear datos sensibles: contraseñas, tokens, claves, ni datos
  personales.
