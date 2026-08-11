# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS dev
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/web apps/web
WORKDIR /app/apps/web
CMD ["pnpm", "dev"]

# -- Production -------------------------------------------------------------

FROM base AS build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/web apps/web
WORKDIR /app/apps/web
# Public runtime endpoints are baked in at build time (Next.js inlines NEXT_PUBLIC_*),
# so they must be supplied as build args in CI, not just as container env vars.
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_MAP_STYLE_URL
RUN pnpm run build

FROM base AS prod
ENV NODE_ENV=production
RUN addgroup -S tubus && adduser -S tubus -G tubus
WORKDIR /app
# Next's standalone output already mirrors the monorepo layout it was traced from
# (apps/web/server.js, node_modules, etc.), so it's copied to the same root here.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
USER tubus
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
