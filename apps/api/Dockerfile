# Build context is the repository root (npm workspaces): docker build -f apps/api/Dockerfile .
FROM node:22-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY apps/api apps/api
RUN npm run build -w apps/api

FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=3000 UPLOAD_DIR=/app/uploads
WORKDIR /repo
# node_modules is kept whole (incl. ts-node) so `npm run seed` works inside the container.
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/apps/api ./apps/api
WORKDIR /repo/apps/api
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads /repo
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD node -e "fetch('http://localhost:3000/api/docs').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply migrations, then start. (Run `npm run seed` once for demo data.)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
