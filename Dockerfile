# Stage 1: Build Vite + React SPA client
FROM node:20-bookworm-slim AS client-builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json

RUN npm ci --include=optional --workspace=client --include-workspace-root

COPY client/ ./client/

# Client-safe public build arguments scoped exclusively to client-builder
ARG VITE_API_URL=/api/v1
ARG VITE_SOCKET_URL=
ARG VITE_MAP_PROVIDER=geoapify
ARG VITE_GEOAPIFY_TILE_API_KEY=
ARG VITE_GOOGLE_CLIENT_ID=

ENV VITE_API_URL=$VITE_API_URL \
    VITE_SOCKET_URL=$VITE_SOCKET_URL \
    VITE_MAP_PROVIDER=$VITE_MAP_PROVIDER \
    VITE_GEOAPIFY_TILE_API_KEY=$VITE_GEOAPIFY_TILE_API_KEY \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN npm --prefix client run build

# Stage 2: Lean non-root production runtime
FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=5004 \
    SERVE_CLIENT=true

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json

RUN npm ci --omit=dev --workspace=server --include-workspace-root && npm cache clean --force

COPY --chown=node:node server/ ./server/
COPY --from=client-builder --chown=node:node /app/client/dist ./client/dist

USER node

EXPOSE 5004

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 5004) + '/readyz').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server/src/index.js"]
