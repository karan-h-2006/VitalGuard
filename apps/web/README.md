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
