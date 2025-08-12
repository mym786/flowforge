# FlowForge

> An MIT-licensed, original workflow automation platform with a visual editor, triggers/actions, and a resilient jobs runner. Inspired by the spirit of n8n, but implemented from scratch.

## Highlights
- Visual flow builder (React + React Flow) with inspector and run controls.
- Triggers: **webhook**, **cron**, **redis queue**, manual.
- Actions: **HTTP request**, **JavaScript code (isolated-vm sandbox)**, **data transform**, **email SMTP**, **Postgres query**, **S3/MinIO upload**, **delay**.
- Orchestration: per-node retries with exponential backoff, timeouts, structured logs, persistence, WebSocket run events.
- Extensible: plugin SDK (`@flowforge/sdk`) + runtime discovery of custom nodes.
- Security: secrets encrypted at rest with libsodium; redaction in logs.
- Shipping: Docker Compose (api, worker, web, db, redis, minio), seed demo.
- Testing scaffolding ready; CI workflow example included.

## Built-in Nodes (10+)
1. `trigger.cron`
2. `trigger.webhook`
3. `queue.redis`
4. `http.request`
5. `code.execute` (isolated-vm)
6. `email.smtpSend`
7. `db.postgresQuery`
8. `file.s3Upload`
9. `data.transform`
10. `util.delay`

## Architecture (ASCII)
```
+------------+     WS/SSE      +----------------+         +-----------------+
|   Web UI   |<---------------->|   API (Fastify)|<------->|   PostgreSQL    |
| (React)    |   REST / Docs    |  + BullMQ      |         +-----------------+
+-----+------+                  +---+--------+---+
      |                              |        ^
      | Start Run / Webhook          |        | Job events
      v                              v        |
+-----+------+                +------+--------+---+       +-------------+
|  Browser   |                |  Redis (BullMQ) |<------->|  Worker     |
|  Canvas    |                +------------------+        |  Executor   |
+------------+                                              +-------------+
                 +-------------------+
                 |  MinIO / S3       |
                 +-------------------+
```

## Quickstart (Docker)
```bash
# 1) Start everything
pnpm install
pnpm prisma:generate
docker compose -f docker/compose.yml up --build -d

# 2) Init DB and seed demo
docker compose -f docker/compose.yml exec api pnpm --filter @flowforge/api prisma:generate
docker compose -f docker/compose.yml exec api pnpm --filter @flowforge/api seed

# 3) Open:
#    API:        http://localhost:3000/docs
#    Web (UI):   http://localhost:5173
#    MinIO:      http://localhost:9001 (minio/minio123)

# 4) Run the demo workflow
# In the Web UI click "Run" on the demo card.
```

## Development (Local)
```bash
pnpm i
pnpm dev   # runs web, api, worker (via turbo)
```

## Security Notes
- Credentials are encrypted at rest (libsodium secretbox). Set `KMS_KEY` to a 32-byte base64 key in production.
- Webhooks use an HMAC-like token derived from workflow ID and `WEBHOOK_SALT` (dev demo). Replace with a proper signer in prod.
- User RBAC and audit log hooks are scaffolded; expand per your org needs.

## License
MIT © 2025 FlowForge Authors
