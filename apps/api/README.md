# @vitalguard/api

HTTP API and real-time WebSocket server for VitalGuard built with **Fastify**. Fastify provides high-throughput request handling, native pino structured logging, robust TypeScript types, and a clean plugin encapsulation model that maps directly onto `src/features/*`.

---

## Authentication and Authorization

### Registration & Login

- **Self-Registration (`POST /auth/register`)**: Supports **patient**, **caregiver**, and **doctor** roles.
  - Doctors submit their medical license number, medical specialization, and institution ID; accounts default to `pending` status until approved by an administrator.
  - Patients optionally designate a preferred institution ID during signup. When `AUTO_PROVISION_SIMULATED_DEVICE=true`, a virtual wearable is provisioned immediately.
  - Administrator accounts cannot be self-registered.
- **Passwords**: Enforces a 10-character minimum, hashed with **Argon2id** and per-user cryptographic salts.
- **Authentication (`POST /auth/login`)**: Issues a signed JWT token valid for 1 hour by default (configurable via `JWT_EXPIRES_IN`). Rate-limited in-memory per IP (`LOGIN_RATE_LIMIT_MAX`, default 5 per 60-second window; admin login allows 3 attempts per 300-second window).
- **First-Time Admin Password Change**: Bootstrapped administrator accounts flag `must_change_password: true`, requiring a password reset before standard operations proceed.

### Administrator Bootstrap

The first administrator is initialized securely via a CLI script rather than an open endpoint:

**PowerShell (Windows):**

```powershell
$env:INITIAL_ADMIN_EMAIL="admin-demo@vitalguard.local"
$env:INITIAL_ADMIN_PASSWORD="DemoAdmin!2026"
pnpm --filter @vitalguard/api db:bootstrap-admin
```

**Bash (Linux / macOS):**

```bash
INITIAL_ADMIN_EMAIL=admin-demo@vitalguard.local INITIAL_ADMIN_PASSWORD='DemoAdmin!2026' \
  pnpm --filter @vitalguard/api db:bootstrap-admin
```

> **Security Note:** Clear the `INITIAL_ADMIN_PASSWORD` variable immediately after initialization. The script rejects duplicate emails and requires at least 12 characters.

### Guards and Access Control

- `app.authenticate`: Validates bearer token signature and expiration.
- `requireRoles(...roles)`: Verifies role membership (`administrator`, `doctor`, `patient`, `caregiver`). Doctors must have `approved` license status.
- `requireAssociation()`: Enforces clinical boundary. Patients can only access their own vitals; doctors and caregivers can only access patients with verified associations; administrators hold global oversight.

---

## Live Streaming & Clinical Reports

- **WebSocket Protocol (`GET /ws?token=<JWT>`)**: Authenticates via query parameter token. Clients subscribe to patient updates by sending `{"type":"subscribe","patientId":"<UUID>"}`.
- **Status Updates**: Polls Redis cache (`patient:<id>:status`) at a configurable interval (`WEBSOCKET_POLL_INTERVAL_MS`, default 500ms) and pushes updates to connected clients on change.
- **Weekly Clinical Reports**: PDF summaries generated via PDFKit in `apps/worker` or on-demand (`POST /patients/:patientId/reports`), downloaded via `GET /patients/:patientId/reports/:reportId/download`.

---

## Local Development

1. **Environment Configuration**:

   ```powershell
   Copy-Item apps/api/.env.example apps/api/.env
   ```

2. **Run in Watch Mode**:

   ```powershell
   pnpm --filter @vitalguard/api dev
   ```

3. **Verify Health**:
   ```powershell
   curl http://localhost:3000/health
   ```

---

## Scripts

| Script               | Command                                            | Purpose                                                 |
| -------------------- | -------------------------------------------------- | ------------------------------------------------------- |
| `dev`                | `pnpm --filter @vitalguard/api dev`                | Starts server in watch mode via `tsx` (port 3000)       |
| `build`              | `pnpm --filter @vitalguard/api build`              | Compiles TypeScript to `dist/`                          |
| `lint`               | `pnpm --filter @vitalguard/api lint`               | Runs ESLint validation                                  |
| `typecheck`          | `pnpm --filter @vitalguard/api typecheck`          | Validates types with `tsc --noEmit`                     |
| `test`               | `pnpm --filter @vitalguard/api test`               | Executes API unit and route tests via Vitest            |
| `db:migrate`         | `pnpm --filter @vitalguard/api db:migrate`         | Applies pending Drizzle SQL migrations                  |
| `db:seed`            | `pnpm --filter @vitalguard/api db:seed`            | Seeds demo clinical institutions, patients, and doctors |
| `db:bootstrap-admin` | `pnpm --filter @vitalguard/api db:bootstrap-admin` | Seeds initial administrator account                     |

---

## OpenAPI Documentation

The OpenAPI 3.1 specification is maintained at [`openapi/openapi.yml`](./openapi/openapi.yml). Validate with:

```bash
npx @redocly/cli lint apps/api/openapi/openapi.yml
```
