# Software de terceros — Estaciona

Estaciona usa los siguientes componentes de código abierto (vía CDN). Todos
permiten uso comercial sin regalías; su única obligación es **conservar el aviso
de licencia y copyright**, que este archivo cumple. Ver también `LICENCIAS.md`
para los datos y servicios con API key.

| Componente | Versión | Licencia (SPDX) | Fuente |
|---|---|---|---|
| Leaflet | 1.9.4 | BSD-2-Clause | github.com/Leaflet/Leaflet |
| Leaflet.markercluster | 1.5.3 | MIT | github.com/Leaflet/Leaflet.markercluster |
| TensorFlow.js | 4.22.0 | Apache-2.0 | github.com/tensorflow/tfjs |
| NSFWJS | 4.3.0 | MIT | github.com/infinitered/nsfwjs |
| Fuente Urbanist | — | OFL-1.1 | fonts.google.com/specimen/Urbanist |
| Fuente Geist Mono | — | OFL-1.1 | github.com/vercel/geist-font |
| Tailwind CSS (solo landing) | CDN | MIT | github.com/tailwindlabs/tailwindcss |

## Notas
- **Apache-2.0 (TensorFlow.js):** además del aviso de licencia, conservar el archivo
  `NOTICE` y declarar cambios si se modifica el código (no se modifica).
- **OFL-1.1 (Urbanist, Geist Mono):** se pueden incrustar y servir en la app; la
  restricción es no vender las fuentes como producto aislado y conservar el aviso OFL.
- **NSFWJS:** el código es MIT. El modelo/pesos se distribuyen bajo el mismo paraguas
  MIT del repositorio; la procedencia del dataset de entrenamiento no está formalmente
  documentada — si un comprador B2B es muy estricto, conviene confirmarlo con Infinite Red.

## Textos de licencia
Los textos completos de cada licencia (MIT, BSD-2-Clause, Apache-2.0, OFL-1.1) están
disponibles en el repositorio oficial de cada componente (enlaces arriba) y en
spdx.org/licenses. Se incorporan aquí por referencia.

*Última revisión: julio 2026.*
