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
# La base SQLite vit dans /app/.data (volume Docker)
RUN mkdir -p /app/.data && chown -R node:node /app/.data
VOLUME /app/.data
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
