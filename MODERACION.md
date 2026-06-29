# 🛡️ Moderación de fotos — pasos pendientes

La moderación **ya está construida y commiteada**. Solo faltan unos pasos de
configuración (cuenta + variables) para activarla en producción. Todo lo de
abajo se hace **sin programar**, desde paneles web.

## Cómo funciona (resumen)

Cuando alguien sube una foto, se revisa en **dos capas automáticas**:

1. **En el celular (gratis, instantáneo):** una IA (nsfwjs) bloquea
   **desnudos / porno** antes de que la foto salga del teléfono.
2. **En el servidor (Sightengine):** se revisa **drogas, armas y violencia**
   (y también desnudos, por si alguien intenta saltarse la capa 1). Si la foto
   no se permite, se rechaza con un aviso y **no se guarda**.

Además existe un **panel manual** en `/admin` como red de seguridad.

> Si Sightengine no está configurado o falla, el sistema **deja subir** la foto
> (para no bloquear a todos). La capa del navegador (desnudos) funciona igual.

---

## ✅ Pasos pendientes (los hace Abel)

### 1. Crear cuenta en Sightengine (para drogas/armas/violencia)
- Entrar a **https://sightengine.com** y registrarse.
  - Capa gratis ≈ **2.000 fotos/mes**, **no pide tarjeta**.
- En el dashboard copiar el **API user** y el **API secret**.
- En **Railway** (proyecto de la app) → pestaña **Variables** → agregar:
  - `SIGHTENGINE_USER` = tu API user
  - `SIGHTENGINE_SECRET` = tu API secret
- *(Opcional, para probar en el PC:* crear el archivo
  `app/backend/sightengine.key` con el texto `tu_user:tu_secret`. No se sube a
  GitHub.)*

### 2. Poner la clave del panel de moderación
- En **Railway → Variables** → agregar:
  - `ADMIN_CLAVE` = una clave secreta tuya (⚠️ **no** uses `modtest123`, esa es
    solo de prueba local).

### 3. Subir los cambios a GitHub
- Abrir **GitHub Desktop** → botón **"Push origin"**.
- Esto sube los 4 commits de moderación:
  - `022e4f6` panel `/admin`
  - `67f03f7` buscador en el panel
  - `26955c1` IA del navegador (desnudos)
  - `8747775` Sightengine en la nube (drogas/armas/violencia)

### 4. Probar en el navegador
- Abrir la app en producción y subir una foto de prueba:
  - una foto subida de tono → la bloquea **el navegador**;
  - una foto de droga/arma → la bloquea **Sightengine**.
- Entrar al panel: **`/admin`** → primero la clave de acceso de la app
  (`ACCESO_CLAVE`, modo privado) → luego la clave de moderación (`ADMIN_CLAVE`).

---

## Variables de entorno (resumen para Railway)

| Variable | Para qué | Si falta… |
|---|---|---|
| `SIGHTENGINE_USER` | Usuario de Sightengine | No se revisan drogas/armas/violencia |
| `SIGHTENGINE_SECRET` | Secreto de Sightengine | (idem) |
| `ADMIN_CLAVE` | Clave del panel `/admin` | El panel no deja entrar |

> Las claves **nunca** van en el repo (es público). En local se pueden usar los
> archivos `app/backend/sightengine.key` y `app/backend/admin.key`, que están en
> `.gitignore`.

## Dónde está el código (por si hace falta)
- `app/backend/src/modera-foto.js` — revisión en la nube (Sightengine).
- `app/backend/src/server.js` — endpoints `/api/foto`, `/api/mod/feed`, `/api/mod/borrar`.
- `app/web/app.js` — IA del navegador (`fotoInapropiada`) + aviso de bloqueo.
- `app/web/admin.html` — panel de moderación.
