# Plan de validación en terreno — Temuco

> El objetivo de este plan NO es agregar funciones. Es **responder una sola pregunta
> con evidencia real, gastando lo mínimo**: *¿alguien usa Estaciona y le sirve, cuando
> los datos de su ciudad son de verdad?* Si la respuesta es sí, invertimos en serio
> (PWA, más ciudades, ingresos). Si es no, lo supimos con 2 semanas de esfuerzo, no
> con meses de código.

## La pregunta y el criterio honesto (defínelo ANTES de empezar)

**Hipótesis:** con datos reales en el centro de Temuco, gente local va a usar la app
para decidir dónde estacionar (y no solo dar vueltas).

**Señal de ÉXITO (seguir):** en ~3-4 semanas, con ~30-50 personas invitadas…
- al menos **10-15 la abren más de una vez** (vuelven), y
- se usa **"Cómo llegar"** (intención real de ir), y
- **3-5 personas** te dicen sin adular que les ahorró una vuelta o les sirvió.

**Señal de FRACASO (parar/pivotar):** aunque los datos del centro estén correctos y
sea local, **nadie vuelve** ni la usa para decidir. Eso es un resultado valioso: te
ahorra meses. No lo maquilles.

> Regla de oro del período: **CERO funciones nuevas, CERO otras ciudades, CERO PWA.**
> Solo datos reales + gente real + mirar qué pasa.

---

## Fase 0 — Requisito que bloquea todo (1 día)

- [ ] **Mantener la app viva.** El crédito de Railway está casi agotado; si se acaba,
      la app se apaga en medio de la prueba. Decide: poner un poco de saldo, o mover a
      un plan/uso que aguante estas semanas. **Sin esto, la prueba no corre.**
- [ ] Confirmar que la URL responde y la app está pública (sin `ACCESO_CLAVE`).

---

## Fase 1 — Datos reales del centro (2-3 salidas a terreno)

**Meta:** pasar el centro de Temuco de **7 verificados → ~30 verificados** (casi todo
el casco que la gente realmente usa). Con eso, en la zona piloto la app deja de adivinar.

### Qué capturar en cada estacionamiento (30 segundos por sitio)
1. **Precio real** del cartel/tótem: $/minuto o $/hora (anótalo tal cual).
2. **Horario** de cobro (y si hay gratis: domingos, noche, etc.).
3. **¿Existe y opera hoy?** (varias fichas de OSM pueden estar cerradas o mal).
4. Una **foto** del cartel de tarifas (respaldo + sube la mejor a la app).
5. Si es "gratis para clientes" (mall/súper), anótalo así.

### Cómo capturarlo (elige lo que te acomode)
- **En la app (dogfooding):** abre la ficha → **"Reportar precio"** y **"Reportar un
  problema"** si está mal o no existe. Yo después coseho esos reportes desde `/admin`
  y los dejo como **verificados** en el código. *(De paso pruebas tú mismo el flujo.)*
- **O una lista simple** (papel/notas del teléfono / un Google Sheet) con:
  `nombre · precio · horario · ¿existe? · nota`. Me la pasas y yo la cargo.

### Ruta sugerida (2 clusters caminables)

**Cluster A — Casco histórico (alrededor de Plaza de Armas):**
- [ ] Estacionamientos Araucanía — subterráneo Plaza Aníbal Pinto (Claro Solar 850)  ← *falta su tarifa $/hr real*
- [ ] Estacionamientos Araucanía — Plaza Manuel Recabarren (Arturo Prat 751)
- [ ] Estacionamiento Plaza de Armas Temuco
- [ ] Estacionamiento Manuel Montt / Montt y Cruz (Manuel Montt 1162)
- [ ] Mall Mirage
- [ ] Centro Comercial Alemania
- [ ] Santa Isabel / Unimarc / Líder (centro) — confirmar cuáles existen y si cobran o son "solo clientes"
- [ ] Teatro Municipal, Museo Ferroviario (¿son públicos o restringidos?)
- [ ] Calles con parquímetro: confirmar Chile Parking **$27/min** en Prat, Claro Solar, V. Mackenna, Antonio Varas *(ya verificado por web; confírmalo de paso)*

**Cluster B — Sector Av. Alemania:**
- [ ] Casino Dreams / Republic Parking (Av. Alemania 0945)  ← *hoy está como estimación; confirma el cartel*
- [ ] Clínica Alemana (Senador Estébanez / Holandesa)  ← categoría Salud
- [ ] Easy / Construmart / Mall / súper del sector
- [ ] Calles Parksur del sector (Pirineos, Phillippi, Thiers…): confirmar **$30/min**

### Limpieza de basura de OSM (me la marcas y yo la borro del código)
- [ ] Duplicados a fusionar/eliminar: **Unimarc ×3**, **"Solar / Vicuña Mackenna (2)"**,
      y cualquier ficha que en terreno **no exista**. Marca cuáles y las saco.

**Al terminar:** yo cargo todo lo verificado a `precios-reales.js` / `fichas-extra.js`
(quedan como "confirmado con fuente: en terreno") y limpio los duplicados.

---

## Fase 2 — Primeros usuarios reales (en paralelo, ~2 semanas)

**Meta:** 30-50 personas de Temuco que la usen de verdad al menos una vez. **Sin gastar
en publicidad.** Canales realistas:

- [ ] **Tu círculo directo:** familia/amigos/conocidos que manejan al centro. Mándales
      el link con un mensaje personal: *"hice esto para no dar vueltas buscando
      estacionamiento en el centro de Temuco, ¿lo probái la próxima que vayái y me
      decí si te sirvió o si te mintió?"*
- [ ] **Grupos locales de Temuco** (Facebook "Temuco", "Datos Temuco", grupos de
      barrio/vecinos, WhatsApp de trabajo). Un posteo honesto: qué es, que es gratis,
      que los precios del centro están verificados en terreno. Pide feedback, no likes.
- [ ] **Boca a boca en el centro:** compañeros de trabajo, tu almacén, la gente que
      sabes que pelea estacionamiento a diario.
- [ ] Sé honesto en el pitch: *"el centro de Temuco está con precios reales; el resto
      del país todavía es estimación."* No lo vendas como más de lo que es.

---

## Fase 3 — Medir y decidir (usa lo que YA está construido)

No hay que construir nada para medir: la **analítica anónima** ya cuenta todo, y los
**reportes/precios de la comunidad** te dicen si la gente participa.

- [ ] Entra a **`/admin`** cada pocos días. Mira:
  - **Uso de la app:** pageviews, búsquedas, "detalle", **"cómo llegar"** — hoy vs 7 días.
  - **Top ciudades:** ¿Temuco crece? ¿la gente vuelve (los números suben día a día)?
  - **Reportes / precios / comentarios de la gente:** ¿aportan solos? (señal de que les importa)
- [ ] **5-10 conversaciones reales** (más valioso que los números): pregunta directo
      *"¿la volverías a abrir? ¿te sirvió para decidir, o igual diste la vuelta?"*
- [ ] **Decisión a las ~3-4 semanas** contra el criterio de arriba: seguir (PWA +
      ingresos + más zonas) o parar/pivotar. Anota la decisión y por qué.

---

## Reparto del trabajo

| Tú (Abel) | Yo (Claude) |
|---|---|
| Fase 0: mantener Railway vivo | — |
| Terreno: caminar, anotar precios/horarios, fotos | Cargar lo verificado al código + limpiar duplicados OSM |
| Difusión: mensajes, grupos, boca a boca | Redactar el mensaje/posteo honesto si quieres |
| Hablar con 5-10 usuarios | Analizar la analítica contigo y sacar conclusiones |
| Decidir seguir/parar | Darte la lectura honesta de los datos |

## Costo y tiempo (realista)
- **Plata:** ~$0 + lo mínimo para mantener Railway vivo unas semanas.
- **Tu tiempo:** 2-3 medias jornadas de terreno + ~1-2 h/semana de difusión y mirar `/admin`.
- **Duración:** ~3-4 semanas hasta la decisión.

---

*Este plan es la mejor inversión de tiempo ahora — más que la PWA. La PWA tiene sentido
DESPUÉS de saber que la gente la usa. Ver también `PLAN-PILOTO.md` (modelo de negocio
para si la validación sale bien).*
