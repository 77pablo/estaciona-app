# Checklist de escalamiento — Estaciona

> Cuándo usar esto: cuando el tráfico empiece a apretar de verdad (lo ves en
> `/admin` → "Uso de la app": usuarios/semana subiendo, picos, varias ciudades activas).
> **No hacer nada de esto antes** — el piloto NO lo necesita (sería gasto/tiempo prematuro).

## Estado actual (jun-2026) y veredicto
- **Piloto / 1-2 ciudades / miles de visitas:** la app aguanta sin problema.
- **Nacional masivo y simultáneo:** todavía NO. No por el tamaño de los datos
  (782 KB / 1.463 fichas en memoria, livianísimo) sino por la **arquitectura de
  almacenamiento e infraestructura**.

## El bloqueador #1 — almacenamiento en archivos JSON
Hoy votos, aportes, lugares, fotos, analítica y destacados se guardan en archivos
JSON en un disco (volumen Railway), y **cada cambio reescribe el archivo completo**.
Consecuencias:
- **Clavados a UNA sola instancia.** Para carga nacional se necesitan varias
  instancias en paralelo, pero todas escribirían el mismo archivo → corrupción /
  datos pisados. El volumen se monta en un solo servidor.
- A alto volumen de escritura, reescribir todo el array por cada cambio es lento.

➡️ **Arreglo #1 (desbloquea todo lo demás): mover la comunidad/analítica a una base
de datos real (ej. Postgres administrado).** Recién ahí se puede escalar horizontal.

## Otros límites a escala nacional
| Pieza | Hoy | Qué se necesita a escala |
|---|---|---|
| Hosting | 1 instancia chica (Railway) | plan pagado + varias instancias / autoescalado |
| Mapas (MapTiler) | plan free/bajo | plan pagado (el tile gratis no aguanta tráfico masivo) |
| Geocoding (Nominatim OSM) | API pública, máx ~1/seg, uso pesado prohibido | servidor Nominatim propio o proveedor pagado |
| ETA tráfico (TomTom) | free 2.500/día | plan pagado o desactivar a gran escala |
| Fotos | archivos en el disco del servidor | ✅ EN CÓDIGO: object storage externo (Cloudflare R2) + CDN — falta crear el bucket y poner las variables R2_* (ver abajo) |
| Estáticos (html/js/css) | los sirve el server, sin caché (no-cache) | CDN delante (Cloudflare) que cachea y absorbe picos |
| Observabilidad | sin monitoreo/alertas/backups | uptime + error tracking + respaldos del volumen/DB |

## Orden de arreglos (cuando los números lo pidan)
1. ✅ **Base de datos** (Postgres/Neon) para comunidad + analítica → habilita multi-instancia. *(el grande, HECHO)*
2. ✅ **Fotos** → almacenamiento externo + CDN (Cloudflare R2). *(EN CÓDIGO; falta el bucket + variables — ver "Activar R2")*
3. **CDN (Cloudflare)** delante de toda la app (estáticos + picos; casi gratis).
4. **Mapas plan pagado** + **geocoder** propio/pagado.
5. **Hosting con autoescalado** + **monitoreo** + **backups**.

## Señales de que ya es hora (gatillos)
- Errores/timeouts en horas punta, o la instancia al límite de CPU/RAM.
- Tráfico sostenido en varias ciudades a la vez (no solo Temuco).
- Quota de MapTiler/TomTom agotándose seguido.
- Volumen de aportes/votos/fotos creciendo rápido (los JSON se vuelven grandes).

## Activar R2 (fotos en object storage) — pasos para Abel
El código ya está (`app/backend/src/r2.js` + `fotos.js`): si NO hay variables R2,
las fotos siguen en archivos locales (como hasta hoy); si están, van a Cloudflare R2.

1. Crear cuenta en **Cloudflare** (gratis) → panel **R2** → activar (pide tarjeta pero
   la capa gratis no cobra: 10 GB, sin cargo por descarga).
2. **Create bucket** → nombre ej. `estaciona-fotos`. Región automática.
3. Bucket → **Settings** → **Public access** → habilitar el **r2.dev subdomain**
   (o conectar un dominio propio con CDN). Copiar esa URL pública
   (ej. `https://pub-xxxxxxxx.r2.dev`).
4. R2 → **Manage R2 API Tokens** → **Create API Token** → permiso
   **Object Read & Write** para ese bucket. Copiar **Access Key ID** y
   **Secret Access Key** (el secreto se muestra UNA vez).
5. En el panel también aparece el **Account ID** (subdominio de la S3 API).
6. Pasarme esos 5 valores → corro el round-trip contra el bucket real (patrón Neon)
   para confirmar que firma/sube/sirve/borra bien ANTES de activarlo en producción.
7. Si queda verde, en **Railway** → servicio `estaciona-app` → **Variables**, agregar:
   - `R2_ACCOUNT_ID` = (account id)
   - `R2_ACCESS_KEY_ID` = (access key id)
   - `R2_SECRET_ACCESS_KEY` = (secret)
   - `R2_BUCKET` = `estaciona-fotos`
   - `R2_PUBLIC_URL` = `https://pub-xxxxxxxx.r2.dev`
   Push del código por GitHub Desktop. En los logs del deploy debe decir
   `· fotos → Cloudflare R2 (object storage externo) (persiste, multi-instancia)`.

Nota: las fotos ya subidas al volumen NO se migran solas (son pocas, pre-lanzamiento).
Si hubiera muchas, se sube el contenido de `/data/fotos/<id>/` al bucket con las mismas
rutas `<id>/<archivo>` (script aparte). El listado global del panel `/admin` lista
objetos del bucket; a muchísimas fotos convendría un índice en la DB (hoy no hace falta).

## Notas
- El dataset base (data.js) en memoria escala bien por instancia; no es el problema.
- Los stores ya usan escritura atómica + cola serializada (seguro para 1 instancia);
  el límite es justamente que **no** sirve para varias instancias.
- Relacionado: pagos a escala (ver memoria del proyecto) — Pro por IAP de las tiendas,
  Destacados por pasarela web propia.
