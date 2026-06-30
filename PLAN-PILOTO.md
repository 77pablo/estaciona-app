# Plan piloto — Estaciona (zona piloto: Temuco)

> Objetivo: convertir el prototipo nacional en un **negocio**, probándolo primero en
> **una sola ciudad (Temuco)**. Regla de oro: **primero usuarios, después plata** —
> sin gente usando la app, ningún operador paga por aparecer.

## 🎯 Qué queremos probar en el piloto
1. Que **la gente la usa** (y reporta precios/lugares).
2. Que **operadores pagan** por aparecer destacados.

Si ambas funcionan en Temuco → se replica el mismo libreto a otra ciudad.

---

## Fase 0 — Cimientos mínimos (1-2 semanas)
Sin esto no se puede operar como negocio.

| Tarea | Quién | Detalle |
|---|---|---|
| Términos de uso + Política de privacidad | Claude redacta, Abel revisa | Páginas `/terminos` y `/privacidad`. Se manejan fotos y datos → Ley 19.628. Obligatorio antes de monetizar. |
| Plan pagado Railway + tarjeta | Abel | El crédito de prueba estaba en ~$4.93; si se acaba, la app se cae. |
| Analítica de uso simple | Claude | Medir cuánta gente entra, de dónde y qué ciudad miran. Liviana y respetuosa de privacidad. |
| Verificar precios reales de Temuco en terreno | Abel | Llamar/visitar los principales: Estacionamientos Araucanía (+56 45 221 2833), Portal/Cenco, Mall Mirage, Clínica Alemana, etc. Sube el % verificado **en Temuco** de ~6% a casi 100%. |

**Meta:** Temuco con datos confiables + app legal + medición funcionando.

---

## Fase 1 — Producto para monetizar: "Destacados" (2-3 semanas, código)
| Tarea | Detalle |
|---|---|
| Lugar destacado/patrocinado | Flag en la ficha → aparece arriba de la lista + pin distinto + badge claro **"Destacado"** (marcado como publicidad, honesto). |
| Panel para Abel | Extender `/admin` para activar/desactivar destacados y ponerles fecha de término. |
| Página "Para operadores" | Landing simple: "¿Tienes un estacionamiento? Aparece destacado en Estaciona" + contacto (WhatsApp/formulario). |

**Meta:** poder vender un "destacado" y activarlo en minutos.

---

## Fase 2 — Conseguir usuarios en Temuco (en paralelo, Abel, bajo costo)
Sin audiencia, los destacados no valen.
- Difusión local: grupos de Facebook de Temuco, Instagram, un QR en volante.
- Incentivar que la gente **reporte precios** (función ya construida) → mejora los datos solo.
- Medir con la analítica: usuarios/semana, qué buscan, cuántos reportan.

**Meta:** base inicial de usuarios reales en Temuco (cientos), no cero.

---

## Fase 3 — Vender (Abel, comercial/terreno; cuando ya haya tráfico)
- Lista de operadores objetivo en Temuco (los privados pagados).
- Oferta de entrada: **1 mes gratis de destacado** → luego $X/mes (precio bajo de prueba, ej. $15.000-30.000/mes).
- Conseguir **2-3 que paguen** = piloto validado.

---

## Fase 4 — Decisión
- ¿Uso real + ≥2 operadores pagando en Temuco? → **replicar a una 2ª ciudad** con el mismo libreto.
- ¿No? → ajustar (otro modelo / otra zona / otra propuesta de valor) antes de gastar en escalar.

---

## 📊 Métricas de éxito del piloto
- Usuarios activos/semana en Temuco (de la analítica).
- % de fichas de Temuco verificadas (meta: >80%).
- Nº de reportes de la comunidad.
- Nº de operadores que pagan (meta: ≥2).

## 💵 Costos aproximados
- Railway pagado: ~US$5-20/mes.
- Mapas: gratis mientras el tráfico sea bajo (solo Temuco); plan pagado solo si se escala.
- Marketing local: casi $0 (orgánico) a unos pocos miles de pesos (volantes/QR).
- Lo caro no es la plata, es el **tiempo de terreno/ventas**.

## ⚠️ Riesgos
- Sin usuarios, los destacados no se venden → por eso usuarios van **primero**.
- Datos estimados restan credibilidad → por eso verificar Temuco en terreno.
- Competencia (Google/Waze muestran algo de parking) → la ventaja es **dominar una zona** con datos + comunidad.

---

## 🔢 Modelos de ingreso (de más fácil a más difícil)
1. **Destacados / avisos pagados** de operadores. *Lo más rápido*, pero necesita tráfico + salir a vender.
2. **Publicidad** (AdSense u operadores). Requiere mucho tráfico para rentar.
3. **Premium** (funciones extra de pago). Necesita masa de usuarios primero.
4. **Reservar + pagar cupo** (comisión). *El ingreso grande*, pero el más lejano: requiere convenios con operadores + inventario real + pasarela de pago.
5. **Datos B2B** (vender info agregada). Hoy no: la data es mayormente estimada.

---

## ✅ Estado actual (base desde la que partimos)
- App nacional desplegada: ~1.500 fichas en ~308 ciudades. Producción en Railway.
- Crowdsourcing completo: reportar lugares/precios/fotos + moderación (incl. IA).
- ~89 precios verificados (≈6% del total) — el resto son estimaciones honestas.
- Sin sistema de pagos/reservas (v1 informativa). Sin Términos/Privacidad aún.
- Datos: file-based JSON en volumen (sirve para volumen bajo; a gran escala necesitaría base de datos).

## ▶️ Siguiente paso recomendado (lo que se puede hacer en código ya)
Arrancar por la **Fase 0 técnica**: Términos + Privacidad + analítica de uso. Desbloquea todo lo demás y no depende de terreno.
