# Build from the repository root:  docker build -f deploy/web.Dockerfile .
# Builds the web app, then serves it (and proxies the API) over automatic HTTPS with Caddy.
FROM node:22-slim AS build
RUN npm install -g pnpm@12.6.0
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter "@coffee/web..."
COPY packages/shared packages/shared
COPY apps/web apps/web
ARG VITE_API_URL
ARG VITE_ORGANIZATION_SLUG
ENV VITE_API_URL=$VITE_API_URL VITE_ORGANIZATION_SLUG=$VITE_ORGANIZATION_SLUG
RUN pnpm --filter @coffee/web build

FROM caddy:2-alpine
COPY --from=build /app/apps/web/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
