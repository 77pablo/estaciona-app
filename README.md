# Estaciona 🅿️ (prototipo)

App para **encontrar estacionamiento** de forma simple: dónde hay, cuánto cobran,
si es gratis, y te lleva hasta allá. Prototipo navegable con mapa real y datos
simulados de una zona (**Centro de Temuco**).

> Stack: **Node.js nativo, sin dependencias** (backend) + **vanilla JS** +
> **Leaflet/OpenStreetMap** (mapa, gratis, sin API key). Favoritos y "mi auto"
> se guardan **en el teléfono** (localStorage), sin cuenta.

## ▶️ Cómo correrlo

1. Terminal en: `C:\Users\pdani\Documents\EstacionaApp\app\backend`
2. Comando: `node src/server.js`
3. Navegador: **http://localhost:4000**

Para detener: `Ctrl + C`. (Tip en Claude Code: `! cd C:\Users\pdani\Documents\EstacionaApp\app\backend && node src/server.js`)

## 🧪 Qué probar (las 12 funciones de la v1)

- **Buscar / ver opciones**: el mapa con pines de colores (🟢🟡🔴) y la lista abajo.
- **Filtros rápidos**: chips Gratis / Barato / Techado / Abierto.
- **Detalle**: toca un pin o una tarjeta.
- **Calculadora**: dentro del detalle, "¿Cuánto pagaré?".
- **Llévame**: abre Google Maps con la ruta.
- **Estacioné aquí + alarma anti-multa**: en el detalle → guarda y pon alarma.
- **Mi auto**: pestaña con cronómetro y costo en vivo.
- **Favoritos**: ⭐ en el detalle; Casa/Trabajo en la pestaña Favoritos.
- **Confirmar con un toque**: 👍/👎 en el detalle.
- **Compartir**: ↗ en el detalle.
- **Sin cuenta**: todo funciona sin registrarse; los datos quedan en el teléfono.

> Los **cupos de los privados cambian solos** cada pocos segundos (simula el dato
> en vivo). La **calle** muestra estimación honesta según la hora/día.

## 🗂️ Estructura

```
EstacionaApp/
├─ app/
│  ├─ backend/src/
│  │  ├─ data.js     ← estacionamientos de la zona (precio, horario, atributos)
│  │  ├─ engine.js   ← disponibilidad en vivo (privados) + estimación (calle)
│  │  └─ server.js   ← servidor HTTP + API
│  └─ web/           ← index.html, app.js, styles.css (la app)
└─ README.md
```

## 🔌 De prototipo a real
Lo único simulado es `data.js` + la disponibilidad de `engine.js`. En producción
se reemplaza por: carga manual de precios/horarios, integración con operadores
(cupos reales de privados) y datos municipales (tarifas de calle). El resto
(mapa, filtros, detalle, calculadora, mi auto, favoritos) queda igual.
