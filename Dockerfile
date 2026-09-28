# --- build : les secrets ne sont jamais copies dans l'image (.env est dans .dockerignore)
FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- execution
FROM node:24-slim
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
CMD ["node", ".output/server/index.mjs"]
