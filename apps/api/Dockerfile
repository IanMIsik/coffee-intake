# Build from the repository root:  docker build -f apps/api/Dockerfile .
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@12.6.0
WORKDIR /app

# Dependencies first, so rebuilding after a code change reuses the cached install layer.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter "@coffee/api..."

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @coffee/api prisma:generate && pnpm --filter @coffee/api build

ENV NODE_ENV=production
RUN mkdir -p apps/api/uploads && chown -R node:node /app
USER node
WORKDIR /app/apps/api
EXPOSE 4000
# Apply any pending database migrations, then start. Safe to run on every start.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
