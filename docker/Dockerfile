# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY . .
# На этапе сборки приложение импортирует env.ts — подставляем безопасные заглушки.
ENV NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=postgres://build:build@localhost:5432/build \
    AUTH_SECRET=build-time-placeholder-secret-min-32-chars
RUN pnpm build \
 && pnpm exec esbuild scripts/migrate.ts --bundle --platform=node --format=cjs --outfile=dist/migrate.js \
 && pnpm exec esbuild src/worker/index.ts --bundle --platform=node --format=cjs --outfile=dist/worker.js

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
# ffmpeg понадобится worker'у на этапе 2 (видео упражнений)
RUN apk add --no-cache ffmpeg

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "server.js"]
