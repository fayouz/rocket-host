# --- build : les secrets ne sont jamais copies dans l'image (.env est dans .dockerignore)
FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- execution (cible "prod", publiee par la CI : ghcr.io/fayouz/rocket-host)
FROM node:24-slim AS prod
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 TZ=Europe/Paris
COPY --from=build /app/.output ./.output
# Scripts de secrets (import depuis l'environnement, rotation de cle) : docs/secrets.md
COPY --from=build /app/scripts/secrets-import-env.mjs /app/scripts/secrets-rotate.mjs /app/scripts/secrets-lib.mjs ./scripts/
COPY --from=build /app/server/utils/secretCrypto.ts ./server/utils/secretCrypto.ts
# La base SQLite vit dans /app/.data (volume Docker)
RUN mkdir -p /app/.data && chown -R node:node /app/.data
VOLUME /app/.data
USER node
EXPOSE 3000
# Version affichee ("git describe --tags", passee par la CI)
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
# Pas de curl/wget dans node:slim : verification avec le fetch de Node (page de connexion publique)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/connexion').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
