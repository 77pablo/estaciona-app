# ============================================================================
# Estaciona — imagen para Railway.
# App de Node puro (node:http), SIN dependencias externas → build muy simple.
# Railway entrega el puerto por la variable PORT; el server.js ya la respeta.
# ============================================================================
FROM node:20-alpine

WORKDIR /app

# Copiamos el backend (código + package.json) y el frontend estático.
COPY backend ./backend
COPY web ./web

# El servidor sirve ../../web relativo a backend/src, o sea /app/web. OK.
WORKDIR /app/backend

# Documentativo (Railway inyecta PORT real). El default local es 4000.
EXPOSE 4000

CMD ["node", "src/server.js"]
