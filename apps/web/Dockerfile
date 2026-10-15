# Build from the repository root:
#   docker build -f apps/web/Dockerfile .
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/config ./packages/config
COPY packages/shared-types ./packages/shared-types
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @vitalguard/web... --filter @vitalguard/shared-types...

FROM deps AS build
COPY apps/web ./apps/web
RUN pnpm --filter @vitalguard/shared-types build \
  && pnpm --filter @vitalguard/web build

FROM nginx:alpine AS runner
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
