# @vitalguard/web

Static, role-specific dashboard shell built with React, Vite, TypeScript, and
Tailwind CSS. Phase 0 deliberately has no authentication or API calls.

## Run locally

```bash
pnpm --filter @vitalguard/web dev
```

Open `http://localhost:5173`. Placeholder routes are `/patient`,
`/caregiver`, `/doctor`, and `/administrator`.

## Scripts

```bash
pnpm --filter @vitalguard/web lint
pnpm --filter @vitalguard/web typecheck
pnpm --filter @vitalguard/web build
pnpm --filter @vitalguard/web test
```

Feature folders own their individual dashboard views. Shared UI belongs in
`src/shared/`; avoid a global folder of feature-specific components.

## Module 6 Implementation Details

- **Authentication**: JWTs are managed via React Context and persisted in `localStorage`. **Note:** This is a pragmatic choice for the course project; `httpOnly` cookies or refresh tokens should be used for production.
- **WebSocket connection**: The client connects to `/ws` and polls for live updates via the backend Redis polling interval. 
- **Dashboards**: The patient UI includes real-time vital charts (Recharts) and live severity badges. Doctor/Caregiver triage dashboards reuse the patient view.
