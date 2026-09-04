# Contributing to VitalGuard

## Branches and commits

Create branches from `main` using one of these prefixes:

- `feature/<area>-<short-description>`
- `fix/<area>-<short-description>`
- `chore/<short-description>`
- `docs/<short-description>`

Use Conventional Commit-style messages, for example
`feat(worker): add idempotent vital consumer` or
`fix(api): return correlation ID in error responses`.

## Pull requests

Keep PRs focused on one concern, rebase or merge the current `main` before
requesting review, and complete the PR template. Before opening a PR, run
`pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test`. Do not add
credentials, generated build output, or an undocumented environment variable.

For any route change, update `apps/api/openapi/openapi.yml` in the same PR.
For a message consumer, explain the idempotency strategy in the PR description:
RabbitMQ delivery is at-least-once and a duplicate must not produce a duplicate
record or alert.

## Module ownership

| Owner | Primary responsibility                                    |
| ----- | --------------------------------------------------------- |
| Vikas | Edge simulator, ingestion, infrastructure, DevOps / CI    |
| Karan | Processing worker, analytics, anomaly detection, alerting |
| Rohan | Authentication, HTTP API, frontend, dashboards            |

Ownership guides review; shared contracts and OpenAPI require review from any
team member familiar with the affected boundary. `CODEOWNERS` applies the same
map automatically.
