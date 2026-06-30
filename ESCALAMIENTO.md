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
| Fotos | archivos en el disco del servidor | object storage externo (S3 / Cloudflare R2) + CDN |
| Estáticos (html/js/css) | los sirve el server, sin caché (no-cache) | CDN delante (Cloudflare) que cachea y absorbe picos |
| Observabilidad | sin monitoreo/alertas/backups | uptime + error tracking + respaldos del volumen/DB |

## Orden de arreglos (cuando los números lo pidan)
1. **Base de datos** (Postgres) para comunidad + analítica → habilita multi-instancia. *(el grande)*
2. **Fotos** → almacenamiento externo + CDN.
3. **CDN (Cloudflare)** delante de toda la app (estáticos + picos; casi gratis).
4. **Mapas plan pagado** + **geocoder** propio/pagado.
5. **Hosting con autoescalado** + **monitoreo** + **backups**.

## Señales de que ya es hora (gatillos)
- Errores/timeouts en horas punta, o la instancia al límite de CPU/RAM.
- Tráfico sostenido en varias ciudades a la vez (no solo Temuco).
- Quota de MapTiler/TomTom agotándose seguido.
- Volumen de aportes/votos/fotos creciendo rápido (los JSON se vuelven grandes).

## Notas
- El dataset base (data.js) en memoria escala bien por instancia; no es el problema.
- Los stores ya usan escritura atómica + cola serializada (seguro para 1 instancia);
  el límite es justamente que **no** sirve para varias instancias.
- Relacionado: pagos a escala (ver memoria del proyecto) — Pro por IAP de las tiendas,
  Destacados por pasarela web propia.
