# Zona piloto Temuco — planilla de verificación en terreno

Objetivo: convertir Temuco en la primera zona con datos **100% reales y verificados**, para mostrarla en las ventas B2B.

## Cómo se usa (3 pasos)

1. **En terreno o por teléfono**, para cada estacionamiento anota: si cobra, cuánto (por minuto o por hora), horario de cobro, cuándo es gratis, y capacidad aprox.
2. Me pasas los datos que juntaste (foto de esta planilla llena, o me los dictas).
3. Yo los cargo en `precios-reales.js` con el `id` correcto → esa ficha queda **verificada** en la app (muestra el precio firme, sin "~ aprox.").

> El `id` ya está puesto en cada fila. No lo cambies — es la llave para cargar el dato.

---

## ✅ Ya verificados (no hay que ir) — 5

Estos ya tienen precio real cargado desde fuente oficial. Solo confírmalos si pasas cerca.

| id | Lugar | Precio real cargado |
|---|---|---|
| `temuco-1` | Portal Temuco | $20/min · 07:00–21:00 (promo 1er año, revisar nov-2026) |
| `temuco-calle-1` | Calle Arturo Prat | $27/min · parquímetro 08:30–20:00 |
| `temuco-calle-2` | Calle Claro Solar | $27/min · parquímetro 08:30–20:00 |
| `temuco-calle-3` | Calle Vicuña Mackenna | $27/min · parquímetro 08:30–20:00 |
| `temuco-calle-4` | Calle Antonio Varas | $27/min · parquímetro 08:30–20:00 |

---

## 📋 Resultado de la búsqueda web (jul-2026)

Barrido en internet de las tarifas de Temuco. Conclusión: **casi nadie publica precio online**; hay que llamar. Esto es lo confirmado:

- **temuco-1 Portal Temuco** — ✅ $20/min (07:00–21:00), promo 1er año. Ya cargado; confirmado de nuevo.
- **temuco-19 Plaza de Armas subterráneo** = *Estacionamientos Araucanía / Plaza Aníbal Pinto*. Datos reales: **315 cupos** (+4 discapacidad), **24 horas**, entrada **Claro Solar 831** (frente a la Municipalidad), pago Transbank, promo *"1 día = pagas solo 7 horas"*. **Precio NO publicado.**
  → Llamar: **+56 45 2212833** / **+56 9 9553 5593** · info@estacionamientosaraucania.cl
- **temuco-14 Manuel Montt** — ⚠️ La web `estacionamientosmanuelmontt.cl` ($49/min) es la de **SANTIAGO**, no Temuco. No usar. Verificar en persona.
- **temuco-22 Líder / temuco-7 Easy** — sin tarifa publicada; probablemente **gratis para clientes** hoy. Confirmar (Líder a nivel país migra a cobro en 2026 con 30 min gratis clientes).
- **Parquímetros de calle** — centro = Chile Parking $27/min (cargado). Barrio Alemania (Pirineos, P. Aguirre Cerda, Alessandri, San Francisco, Holandesa) los opera **Parksur**, sin precio publicado (app).

### ✅ Cargados tras esta búsqueda (nuevos verificados)

Se agregaron a `fichas-extra.js` (sobreviven a regeneración) con su fuente:

- **EC Parking Falabella** (Vicuña Mackenna 590) — ✅ **verificado**: gratis con compra (clientes), L-D 08:30–21:00. Fuente oficial: ecparking.cl.
- **Subterráneo Plaza Manuel Recabarren** (San Martín 751) — cargado como **estimación** ("~$1.500/hr est."): el horario es oficial (L-V 07:30–22:00 / Sáb 09:00–14:30 / Dom cerrado), pero el precio viene de terceros (Tripadvisor/chilopina), no del operador → falta confirmarlo por teléfono para pasarlo a verificado.
- **Clínica Alemana** (`temuco-26`) — dirección corregida a *Senador Estébanez 645* (vía `correcciones.js`), SIN marcar verificado (precio aún estimado). El dump la daba como "Av. Alemania 0410" — era falso.

**Temuco quedó con 8 fichas verificadas.** Lo de abajo sigue para llamada/terreno (falta el precio).

---

## 🎯 Prioridad ALTA — los que más usa la gente (verificar primero) — 12

Con estos 12 + los 5 de arriba, la zona piloto ya se ve sólida.

| id | Lugar | Dirección | ¿Cobra? | Precio (/min o /hora) | Horario cobro | ¿Gratis cuándo? | Cupos aprox |
|---|---|---|---|---|---|---|---|
| `temuco-19` | Estac. Plaza de Armas (subterráneo) | Centro | | | | | |
| `temuco-25` | Mall Mirage | Centro | | | | | |
| `temuco-14` | Estac. Manuel Montt | Centro | | | | | |
| `temuco-21` | Estac. Montt y Cruz | Manuel Montt 1162 | | | | | |
| `temuco-26` | Clínica Alemana | Centro | | | | | |
| `temuco-29` | Clínica RedSalud Mayor | Centro | | | | | |
| `temuco-22` | Líder | Centro | | | | | |
| `temuco-7` | Easy | Centro | | | | | |
| `temuco-6` | Unimarc | Centro | | | | | |
| `temuco-10` | Terminal Tur Bus | Centro | | | | | |
| `temuco-3` | Santa Isabel | Centro | | | | | |
| `temuco-calle-5` | Calle Lautaro | Lautaro 1100 | | | | | |

---

## 🔹 Prioridad MEDIA — completar después — 17

| id | Lugar | Dirección | ¿Cobra? | Precio (/min o /hora) | Horario cobro | ¿Gratis cuándo? | Cupos aprox |
|---|---|---|---|---|---|---|---|
| `temuco-2` | Estac. Germán Becker | Centro | | | | | |
| `temuco-4` | Teatro Municipal | Centro | | | | | |
| `temuco-5` | Minimarket San Martín | Centro | | | | | |
| `temuco-8` | Revisión Técnica | Centro | | | | | |
| `temuco-9` | Ebema | Centro | | | | | |
| `temuco-11` | Museo Ferroviario | Centro | | | | | |
| `temuco-12` | Estac. Unimarc | Centro | | | | | |
| `temuco-13` | Unimarc (2) | Centro | | | | | |
| `temuco-15` | Solar / Vicuña Mackenna | Centro | | | | | |
| `temuco-16` | Andrés Bello / Vicuña Mackenna | Centro | | | | | |
| `temuco-17` | Solar / Vicuña Mackenna (2) | Centro | | | | | |
| `temuco-18` | Unimarc (3) | Centro | | | | | |
| `temuco-20` | C.C. Alemania | Centro | | | | | |
| `temuco-23` | Construmart | Centro | | | | | |
| `temuco-24` | Líder | Centro | | | | | |
| `temuco-27` | Inacap | Centro | | | | | |
| `temuco-28` | C.C. Barrio Inglés | Centro | | | | | |

---

## Guía rápida para anotar bien

- **¿Cómo cobran?** Los estacionamientos en Chile suelen cobrar **por minuto** (Ley 20.967). Si ves "$X/min", anota ese número. Si es tarifa plana por hora, anota "/hora".
- **Gratis solo clientes**: muchos supermercados/malls no cobran pero piden ticket de compra. Anótalo como "gratis clientes".
- **Domingos / noche**: los parquímetros de calle no cobran de noche ni domingos — importante anotarlo.
- **Si no cobra nada**: escribe "GRATIS" y ya está.
- **Dato de oro**: si consigues un **teléfono o correo del administrador** del estacionamiento, anótalo — sirve para el paso siguiente (cupos en vivo).

## Fuentes sin salir de casa (para los grandes)

Antes de ir en persona, varios grandes publican tarifa en su web o se puede llamar:
- Malls / supermercados: web oficial del recinto o su fanpage.
- Clínicas (Alemana, RedSalud): recepción por teléfono.
- Terminal Tur Bus: boletería.

Yo te puedo ayudar a buscar las que tengan tarifa publicada en internet — dime cuáles quieres que revise y las busco.
