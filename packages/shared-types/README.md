# @vitalguard/shared-types

TypeScript contracts for the core domain entities: User, Device,
Association, VitalReading, Baseline, Threshold, Alert, AuditLog.

This package is **types and constants only**. No ORM models, no runtime
validation, no API clients — those decisions happen in the services that
own persistence and HTTP.

Shapes are intentionally aligned with `apps/api/openapi/openapi.yaml` so
the OpenAPI spec and the TS contracts do not drift.

## Scripts

```bash
pnpm --filter @vitalguard/shared-types typecheck
pnpm --filter @vitalguard/shared-types lint
pnpm --filter @vitalguard/shared-types build
```

Consumers should depend on `workspace:*` and import from
`@vitalguard/shared-types` after this package has been built (the root
`pnpm build` does that first via workspace topology).
