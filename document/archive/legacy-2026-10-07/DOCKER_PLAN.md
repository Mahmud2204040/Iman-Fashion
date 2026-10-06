# Docker and deployment plan

Updated: 2026-10-04. Current artifacts: [Dockerfile](../Dockerfile), [Compose](../compose.yaml), [Nginx config](../docker/nginx.conf).
Current application status: [Project Status](PROJECT_STATUS.md).

The current cloud-hosting sequence is in [Deployment Plan](DEPLOYMENT_PLAN.md): Northflank Pay-as-you-go API, Aiven Free PostgreSQL and Cloudinary Free receipts first; Vercel frontend later. The local full-stack Compose design below remains useful for development and recovery rehearsal, but it is **not** the selected cloud production topology.

## Stage A — Existing frontend container

The repository contains a working-layout web-only Compose definition:
- Build image: node:22-alpine, npm ci and Vite build.
- Runtime: nginxinc/nginx-unprivileged:stable-alpine, compiled dist only.
- Container port 8080, mapped to 127.0.0.1:8080 on the host.
- HTTP health check, restart unless-stopped, SPA fallback, missing /assets files return 404.
- No API/database service or durable business data in the current stack.

~~~sh
docker compose config --quiet
docker compose up --build -d
docker compose ps
docker compose logs web
docker compose down
~~~

Open [the local frontend](http://127.0.0.1:8080). Rebuild after changing source; an old running image does not automatically reflect local edits.

The archived 2026-09-30 Docker plan records successful build/start/HTTP/restart checks. That is historical evidence, not a test rerun during this documentation pass. It explicitly did not verify browser interaction.

Stage A acceptance includes rendered page checks, direct URL refresh, assets and restart. HTTP 200 alone cannot confirm a React form works. Mock auth/data remain development fixtures.

## Stage B — Planned local complete stack

Services: web, api, db, plus a controlled one-shot migration command/service.

1. Build an API image with locked dependencies and Prisma client generation; run the production Express command as a non-root user.
2. Put api/db on the internal Compose network. API uses db as the database host.
3. Use a PostgreSQL named volume and health check. API readiness verifies schema/dependencies; startup ordering alone is insufficient.
4. Apply versioned migrations with prisma migrate deploy before serving application traffic.
5. Proxy /api/ through the web server to the API; browser requests stay same-origin.
6. Persist receipt images in a dedicated volume or object storage; authenticated API routes control retrieval.
7. Provide DATABASE_URL, exact allowed origins and storage configuration through deployment environment/secrets. Current opaque sessions need no signing secret. Commit only an example configuration, never real credentials.
8. Configure cloud host/domain/TLS/backups according to the separate Deployment Plan (O004).
9. Review/pin production image versions or digests deliberately; current moving image tags are not a production release specification.

No empty api/db placeholders should be labelled implemented. The backend must exist and satisfy its contracts first.

## Development and production boundary

Current local binding is loopback-only. A production hostname/ingress configuration is a separate deployment change.
Do not bind-mount application source into production runtime containers. Do not use mock accounts, Vite dev server or development migrations as the production setup.
Database ports remain private unless a deliberate local-development override needs one.
Do not put receipt files in an ephemeral container layer.

## Persistence and recovery

Back up PostgreSQL and receipt storage as a consistent operational set. Document schedule, retention, destination, restore commands and responsible operator before production launch.
Test restoring into a separate environment and verify customer/sale/payment/cash/reconciliation records and receipt retrieval.
Container restart or recreation must retain all committed business data and files.
Volume deletion is a separate destructive operation; routine stop/start instructions must not include it.
Keep immutable cost snapshots and reconciliation observations intact through migrations/restores.

## Deployment acceptance

- Empty and existing test databases migrate successfully.
- API waits for usable database/schema and exposes meaningful readiness.
- Sale, stock, payment and cash writes remain atomic under retries.
- Owner/Employee server permissions match Role Permissions.
- Records and uploaded proofs survive container recreation.
- Direct/refreshed frontend routes and actual forms work through the web entry point.
- Backup and restoration are demonstrated, not merely scheduled.
- Version, migration level, environment and validation evidence are recorded in Project Status/release report.

This work belongs to M6 after backend integration. No deployment was performed as part of this documentation update.
