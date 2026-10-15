# Contributing to VitalGuard

## Branches and Commits

Create branches from `main` using standard prefixes:

- `feature/<area>-<short-description>`
- `fix/<area>-<short-description>`
- `chore/<short-description>`
- `docs/<short-description>`

Use Conventional Commits formatting:

- `feat(worker): add automatic amqp reconnect loop`
- `fix(web): add error boundary to administrator outlet`
- `docs(readme): update team division and verified run steps`

---

## Pull Requests & Quality Gates

Keep PRs focused on a single concern. Before opening or requesting review on a PR, ensure all quality checks pass:

```powershell
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pytest simulator/
ruff check simulator/
```

- **OpenAPI Synchronization**: Any HTTP route addition or modification in `apps/api` must update `apps/api/openapi/openapi.yml` within the same PR.
- **Message Consumer Idempotency**: RabbitMQ uses at-least-once delivery. Any message consumer in `apps/worker` must explain its deduplication and idempotency strategy in the PR description.
- **Zero Secrets**: Never commit `.env` files, production credentials, or real private keys.

---

## Module Ownership & Review Routing

| Teammate                  | Focus Area                        | Scope & Directories                                                                             |
| ------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Rohan (@rniszn)**       | Frontend Web & UX                 | `apps/web/`, landing page, dashboards, clinical triage UI, admin console, error boundaries      |
| **Karan (@karan-h-2006)** | Backend API & Processing Pipeline | `apps/api/`, `apps/worker/`, clinical governance, schema/migrations, alerting engine, analytics |
| **Vikas (@feyman137035)** | Edge, Infrastructure & DevOps     | `simulator/`, `infra/`, `.github/`, `docs/DEPLOY.md`, Dockerfiles, production compose, CI       |

### Review Rules

- **Cross-Area Pull Requests**: Require explicit review and sign-off from the owner of the affected component.
- **Shared Contracts**: Changes to shared packages (`packages/`), MQTT contracts (`schemas/`), or REST schemas (`apps/api/openapi/`) require review from at least one teammate familiar with the affected boundary.
- **Automatic Routing**: GitHub uses `CODEOWNERS` and `.github/CODEOWNERS` to assign reviewers automatically.
