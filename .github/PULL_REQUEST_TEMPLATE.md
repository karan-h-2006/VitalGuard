## Summary

<!-- One or two sentences: what does this PR do, and why? -->

## Related requirement(s)

<!-- e.g. F.3 (fall detection), F.9 (baseline computation), or "Module 1: edge ingestion contract" -->
<!-- If this PR doesn't map to a specific F.#/NF.#, say what module/area it touches instead -->

## Type of change

- [ ] New feature
- [ ] Bug fix
- [ ] Refactor (no behavior change)
- [ ] Infra / tooling / CI
- [ ] Documentation
- [ ] Breaking change (data contract, API shape, or env vars changed)

## What changed

<!-- Bullet points are fine. Focus on WHY a reviewer should care, not a line-by-line diff restatement. -->

-
-

## How was this tested?

<!-- Be specific: which commands did you run, what did you check manually, what's covered by automated tests? -->
<!-- "It works on my machine" is not enough for anything touching the data contract, auth, or alerting logic. -->

## Checklist

- [ ] `pnpm build` passes locally
- [ ] `pnpm lint` and `pnpm typecheck` pass locally
- [ ] Tests added or updated for the change, and passing
- [ ] No secrets, credentials, or `.env` values committed
- [ ] `.env.example` updated if this PR introduces new environment variables
- [ ] `schemas/vital-sample.schema.json` (or other shared contract) updated if this PR changes a data shape — and `packages/shared-types` kept in sync
- [ ] `openapi.yaml` updated if this PR adds, removes, or changes an API endpoint
- [ ] README (root or package-level) updated if setup/usage steps changed

## Screenshots / recordings

<!-- Required for any dashboard or UI change. Delete this section if not applicable. -->

## Reviewer notes

<!-- Anything specific you want the reviewer to look closely at, or a design decision you're unsure about. -->
<!-- Per CODEOWNERS, the module owner for the area you touched should review before merge. -->
