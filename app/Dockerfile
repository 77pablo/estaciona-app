# ============================================================================
# Estaciona — imagen para Railway.
# Railway entrega el puerto por la variable PORT; el server.js ya la respeta.
# Dependencia: `pg` (Postgres administrado) cuando está definida DATABASE_URL;
# si no, usa el SQLite integrado de Node 24.
# ============================================================================
FROM node:24-alpine

WORKDIR /app

# Primero el manifiesto, para instalar dependencias (cachea esta capa).
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev --no-audit --no-fund

# Luego el código del backend y el frontend estático.
WORKDIR /app
COPY backend ./backend
COPY web ./web

# El servidor sirve ../../web relativo a backend/src, o sea /app/web. OK.
WORKDIR /app/backend

# Documentativo (Railway inyecta PORT real). El default local es 4000.
EXPOSE 4000

CMD ["node", "src/server.js"]
