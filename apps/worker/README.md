# @vitalguard/worker

Processing / analytics worker. Phase 0 connects to RabbitMQ using
`RABBITMQ_URL` and logs that the broker is reachable. It does **not**
consume messages yet.

Downstream handlers must be idempotent: the queue is at-least-once, and a
duplicate delivery must not open a duplicate Critical alert.

## Run locally

```bash
cp apps/worker/.env.example apps/worker/.env
docker compose -f infra/docker-compose.yml up -d rabbitmq
pnpm --filter @vitalguard/worker dev
```

You should see a structured log line `RabbitMQ connection healthy`.

## Scripts

| Script                                       | What it does       |
| -------------------------------------------- | ------------------ |
| `pnpm --filter @vitalguard/worker dev`       | Watch mode via tsx |
| `pnpm --filter @vitalguard/worker lint`      | ESLint             |
| `pnpm --filter @vitalguard/worker typecheck` | `tsc --noEmit`     |
| `pnpm --filter @vitalguard/worker build`     | Emit `dist/`       |

## Docker

```bash
docker build -f apps/worker/Dockerfile .
```
