# syntax=docker/dockerfile:1

# Сборка на том же дистрибутиве (Debian/glibc), что и runner: иначе в образ попадает
# нативный sharp для alpine/musl и падает при запуске ("Could not load the sharp module").
FROM node:22-bookworm-slim AS base
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
# Адреса нужны настоящими: лендинг prerender-ится с каноническим URL, OG и ссылками на приложение.
ARG SITE_URL=https://maxosipov.ru
ARG APP_URL=https://app.maxosipov.ru
ENV NEXT_TELEMETRY_DISABLED=1 \
    SITE_URL=$SITE_URL \
    APP_URL=$APP_URL \
    DATABASE_URL=postgres://build:build@localhost:5432/build \
    AUTH_SECRET=build-time-placeholder-secret-min-32-chars \
    MEDIA_URL_SIGNING_SECRET=build-time-placeholder-signing-secret
RUN pnpm build \
 && pnpm exec esbuild scripts/migrate.ts --bundle --platform=node --format=cjs --outfile=dist/migrate.js \
 && pnpm exec esbuild scripts/seed.ts --bundle --platform=node --format=cjs --external:sharp --outfile=dist/seed.js \
 && pnpm exec esbuild scripts/import-catalog.ts --bundle --platform=node --format=cjs --external:sharp --outfile=dist/import-catalog.js \
 && pnpm exec esbuild src/worker/index.ts --bundle --platform=node --format=cjs --external:sharp --outfile=dist/worker.js

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHON_PATH=/opt/mt/bin/python \
    MEDIA_TOOLS_DIR=/app/media-tools

# ffmpeg из Debian собран с libvidstab (в alpine его нет), python — для MediaPipe.
# libgl1/libegl1/libgles2/libglib2.0-0 нужны MediaPipe и OpenCV: без них `import mediapipe`
# падает с «libEGL.so.1: cannot open shared object file».
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    ffmpeg python3 python3-venv ca-certificates curl \
    libgl1 libegl1 libgles2 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

COPY media-tools /app/media-tools

# Окружение для подсветки мышц: opencv, numpy, scipy, mediapipe + модель позы.
# Версии закреплены в requirements.txt; модель проверяется по sha256.
RUN python3 -m venv /opt/mt \
 && /opt/mt/bin/pip install --no-cache-dir -r /app/media-tools/requirements.txt \
 && mkdir -p /opt/mt/models \
 && curl -fsSL -o /opt/mt/models/pose_landmarker_heavy.task \
    https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task \
 && echo "64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b  /opt/mt/models/pose_landmarker_heavy.task" | sha256sum -c -

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/dist ./dist
# Подготовленные фото тренажёров для `node dist/import-catalog.js` (docs/ops/ci-cd.md).
COPY --from=build /app/content/catalog/photos ./content/catalog/photos

EXPOSE 3000
CMD ["node", "server.js"]
