# syntax=docker/dockerfile:1
# Build from the repository root:
#   docker build -f apps/worker/Dockerfile .
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/config ./packages/config
COPY packages/shared-types ./packages/shared-types
COPY apps/worker/package.json ./apps/worker/package.json
RUN pnpm install --frozen-lockfile --filter @vitalguard/worker...

FROM deps AS build
COPY packages/shared-types ./packages/shared-types
COPY apps/worker ./apps/worker
RUN pnpm --filter @vitalguard/shared-types build \
  && pnpm --filter @vitalguard/worker build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/worker ./apps/worker
COPY --from=build /app/node_modules ./node_modules
WORKDIR /app/apps/worker
CMD ["node", "dist/index.js"]
