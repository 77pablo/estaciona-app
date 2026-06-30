# ============================================================================
# Estaciona — imagen para Railway (en la RAÍZ del repo, para que Railway la
# encuentre sin configurar Root Directory).
# Railway entrega el puerto por la variable PORT; el server.js ya la respeta.
# Node 24: trae SQLite integrado (node:sqlite) usado como base de datos local.
# Dependencia: `pg` (Postgres administrado) cuando está definida DATABASE_URL.
# ============================================================================
FROM node:24-alpine

WORKDIR /app

# Primero el manifiesto, para instalar dependencias (cachea esta capa).
COPY app/backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev --no-audit --no-fund

# Luego el código del backend y el frontend estático.
WORKDIR /app
COPY app/backend ./backend
COPY app/web ./web

# El servidor sirve ../../web relativo a backend/src, o sea /app/web. OK.
WORKDIR /app/backend

# Documentativo (Railway inyecta PORT real). El default local es 4000.
EXPOSE 4000

CMD ["node", "src/server.js"]
