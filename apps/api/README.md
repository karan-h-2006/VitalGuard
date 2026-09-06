# @vitalguard/api

HTTP API for VitalGuard. **Fastify** is the framework: it ships with
pino logging, first-class TypeScript types, and a plugin model that maps
cleanly onto `src/features/*`. Express would work, but we would have to
bolt on the logger and schema typing that Fastify already has.

## Authentication and authorization

`POST /auth/register` accepts `{ role, email, password }` for **patient**
and **caregiver** accounts only. Passwords require at least 10 characters
and are stored with Argon2id. `POST /auth/login` returns a one-hour JWT by
default (configure `JWT_EXPIRES_IN`); invalid credentials deliberately have
the same response whether the email or password was wrong. Login is limited
in-memory per IP (`LOGIN_RATE_LIMIT_MAX`, default 5, in a 60-second window).

An existing administrator creates doctor and additional administrator accounts
through authenticated `POST /admin/users`. Bootstrap the first administrator
once, after migrations, with environment variables rather than exposing an
unauthenticated admin endpoint:

```bash
INITIAL_ADMIN_EMAIL=admin@example.com INITIAL_ADMIN_PASSWORD='long unique password' \
  pnpm --filter @vitalguard/api db:bootstrap-admin
```

Remove `INITIAL_ADMIN_PASSWORD` immediately afterward. The command refuses to
overwrite an existing email.

Protected route handlers compose `app.authenticate` with `requireRoles(...)`
and, for a patient-scoped route, `requireAssociation()`. The latter permits a
patient only for themself, an associated doctor/caregiver through the existing
join tables, and an administrator universally; it returns 403 for a genuine
but unauthorized patient reference. Example:

```ts
app.get('/patients/:patientId/example', {
  preHandler: [app.authenticate, requireAssociation()],
}, handler);
```

Association routes are `POST /associations`,
`DELETE /associations/:patientId/:relationship/:userId`, and
`GET /patients/:patientId/associations`. Doctors can manage only their own
doctor links; administrators can manage both doctor and caregiver links.
An associated doctor may set a validated override with
`PUT /patients/:patientId/thresholds/:vitalType`.

## Module 6 hand-off

WebSocket upgrade code must extract the bearer token during its handshake and
call `verifyToken` from `src/auth/tokens.ts`; it returns the same `{ userId,
role, patientId? }` principal used by HTTP guards. Before subscribing a socket
to patient data, Module 6 should run the same association check semantics as
`requireAssociation`, rather than trusting a client-supplied patient id.

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
| `pnpm --filter @vitalguard/api test`      | Vitest API tests       |
| `pnpm --filter @vitalguard/api db:bootstrap-admin` | One-time first administrator setup |
| `pnpm --filter @vitalguard/api build`     | Emit `dist/`          |

## Docker

```bash
docker build -f apps/api/Dockerfile .
```

The OpenAPI source of truth is `openapi/openapi.yml`. Update it in the
same PR as any new route.
