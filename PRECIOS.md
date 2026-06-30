# Cómo cargar precios REALES en Estaciona

Los precios que ves en la app son **estimaciones** (dicen "~ est.") salvo los que
confirmamos con fuente. Esta guía explica cómo dejar un precio como **verificado**
(sin el "~", con su fuente). Hay 2 formas.

---

## Forma 1 — Tú confirmaste el precio (cartel, web, en terreno)

Edita **un solo archivo**: `app/backend/src/precios-reales.js`.
Agrega una línea con el `id` de la ficha y el precio. Ejemplos:

```js
// por hora:
{ id: 'temuco-1', precioHora: 1200, fuente: 'cartel en terreno' },

// por minuto (el por-hora se calcula solo = min × 60):
{ id: 'temuco-calle-1', precioMin: 30, fuente: 'parksur.cl' },
```

Campos opcionales: `horario` (ej. `'08:00–21:00'`), `gratis` (texto, ej. `'domingos'`).

**¿De dónde saco el `id`?** Pídeselo a Claude ("dame el id de la ficha X"), o búscalo
en `app/backend/src/data.js` por el nombre del lugar.

Guarda → Push (GitHub Desktop) → Railway redeploya solo. Esa ficha queda con
precio real, **para siempre** (no se borra al regenerar los datos).

> Cuando cambie un precio (ej. Portal Temuco sube de $20 a $25/min ~nov-2026),
> solo edita el número en esa línea.

---

## Forma 2 — Cosechar lo que reporta la gente (panel /admin)

1. Entra a `/admin` (clave de moderación).
2. Arriba ves los **contadores** (comentarios, fotos, precios reportados, votos) —
   sirven para vigilar que la gente aporta y que **persiste** entre redeploys.
3. En **"Precios reportados por la gente"** ves cada lugar con la mediana de lo que
   reporta la gente y cuántos reportes tiene.
4. Si un precio se repite y te cuadra, toca **"Copiar línea"** → te copia la línea
   lista para pegar en `precios-reales.js` (Forma 1). Cambia la `fuente` si quieres.

> Ojo: lo que reporta la gente NO es verificado automáticamente; tú decides cuáles
> promover a precio real. Así la app nunca muestra un precio falso como confirmado.

---

## Estado actual (jun-2026)

Verificados con fuente oficial:
- **Portal Temuco** (`temuco-1`): $20/min — Cenco Malls (promo 1er año; base $25/min).
- **Calles centro** (`temuco-calle-1..4`): $30/min — app Parksur.
- **Santiago/Valparaíso** (varios): $57/min — Saba (autopase.cl).

Todo lo demás es estimación honesta hasta confirmarlo en terreno.
