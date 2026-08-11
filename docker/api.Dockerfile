# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS dev
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api
WORKDIR /app/apps/api
RUN pnpm exec prisma generate
CMD ["pnpm", "dev"]

# -- Production -------------------------------------------------------------

FROM base AS build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api
WORKDIR /app/apps/api
RUN pnpm exec prisma generate && pnpm run build

FROM base AS prod
ENV NODE_ENV=production
RUN corepack enable && addgroup -S tubus && adduser -S tubus -G tubus
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=build /app/packages/contracts/package.json packages/contracts/package.json
COPY --from=build /app/apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/packages/contracts packages/contracts
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
WORKDIR /app/apps/api
# `generate` never connects to a database, but it does parse DATABASE_URL from the
# schema's datasource block, so a placeholder is enough at build time.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" pnpm exec prisma generate
USER tubus
EXPOSE 8080
# Migrations are a separate gated step (see docker-compose.prod.yml) — this container
# only ever runs the compiled server, never `migrate dev`.
CMD ["node", "dist/main.js"]
