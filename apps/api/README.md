# @vitalguard/api

HTTP API for VitalGuard. **Fastify** is the framework: it ships with
pino logging, first-class TypeScript types, and a plugin model that maps
cleanly onto `src/features/*`. Express would work, but we would have to
bolt on the logger and schema typing that Fastify already has.

Phase 0 exposes `GET /health` only. Auth, persistence, and domain routes
are intentionally absent.

## Run locally

```bash
cp apps/api/.env.example apps/api/.env
# from repo root, after `pnpm install` and `docker compose -f infra/docker-compose.yml up -d`
pnpm --filter @vitalguard/api dev
```

Health check: `curl http://localhost:3000/health`

## Scripts

| Script                                    | What it does          |
| ----------------------------------------- | --------------------- |
| `pnpm --filter @vitalguard/api dev`       | Watch mode via tsx    |
| `pnpm --filter @vitalguard/api lint`      | ESLint                |
| `pnpm --filter @vitalguard/api typecheck` | `tsc --noEmit`        |
| `pnpm --filter @vitalguard/api test`      | Vitest (health route) |
| `pnpm --filter @vitalguard/api build`     | Emit `dist/`          |

## Docker

```bash
docker build -f apps/api/Dockerfile .
```

The OpenAPI source of truth is `openapi/openapi.yml`. Update it in the
same PR as any new route.
