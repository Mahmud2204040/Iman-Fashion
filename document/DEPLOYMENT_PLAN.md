# Deployment plan — backend first

Updated: 2026-10-04 (Asia/Dhaka). Status: provider access in progress; not deployed.

This plan records the current sequence: build and deploy the Express API on **Northflank Pay-as-you-go**, connect it to **Aiven Free PostgreSQL**, and store supplier receipt proofs in **Cloudinary Free**. Deploying the React/Vite frontend to Vercel is a later step. No provider resource, database, API, or production account has been created by this document.

The existing [requirements](REQUIREMENTS.md), [database plan](DATABASE_PLAN.md), [backend/API plan](BACKEND_API_PLAN.md), and [role permissions](ROLE_PERMISSIONS.md) remain the functional contracts. This document owns hosting order and operational gates, not new business rules.

## 1. Boundaries and environment

| Component | First deployment | Later frontend/live phase |
| --- | --- | --- |
| React/Vite | Keep local; no Vercel deployment yet | Deploy to Vercel Pro for commercial shop use; use same-origin `/api/v1` routing |
| Express API | One Northflank Pay-as-you-go service, HTTPS provider hostname | Separate production configuration/release after full acceptance |
| PostgreSQL | One Aiven Free service for initial integration and test records | Reassess capacity, availability, retention and real-data risk before shop use |
| Receipt images | Cloudinary Free, private/authenticated assets under a `pilot/` prefix | Use a separate `production/` prefix; account credentials and 25-credit allowance remain shared unless upgraded |

The first deployment is a **backend integration environment, not a live shop system**. Use invented customers, sales, cash entries and receipts only. Do not move browser mock data into Aiven as if it were real records. Aiven Free permits only one free PostgreSQL service per organization, so this plan does not promise simultaneous independent free staging and production databases.

Northflank Pay-as-you-go has usage charges; configure a billing alert before creating resources. Its Developer Sandbox is not the chosen production route. Aiven Free provides 1 GB disk, a 20-connection limit, no built-in connection pooling or SLA, and may be powered off after inactivity. Cloudinary Free provides 25 credits per rolling 30-day period shared across storage, delivery and transformations. Check current provider quotas/prices immediately before provisioning. [Northflank billing](https://northflank.com/docs/v1/application/billing/pricing-on-northflank), [Aiven Free limits](https://aiven.io/docs/products/postgresql/concepts/pg-free-tier), [Cloudinary credits](https://cloudinary.com/documentation/billing_and_plans).

## 2. Prepare the repository and local backend

1. Add an `api/` Express application, locked dependencies, a pinned Node runtime, a production Dockerfile, and Prisma schema/migrations implementing the approved data model. Keep the current frontend-only container working; local API/PostgreSQL development may extend Compose, but Compose is not the cloud deployment topology.
2. Complete the `/api/v1` contract, server-side Owner/Employee authorization, validation, idempotency, database transactions, and authorized receipt access. Hashed passwords and non-demo revocable sessions are started in the local API foundation. Resolve the open sale-correction gate in [Decisions](DECISIONS.md) before implementing its affected endpoints.
3. Expose `/health/live` and `/health/ready`; readiness must verify database usability and required schema, not merely that Express listens. Bind to `0.0.0.0:$PORT`, log structured request/error events without secrets or personal-data payloads, and shut down gracefully. [Northflank port guidance](https://northflank.com/docs/v1/application/network/expose-your-application).
4. Add automated API/integration tests, including role denial, transaction rollback, concurrent stock/payment requests, retries, and migrations on empty and already-populated test databases. Keep mock frontend tests as separate evidence; they do not prove backend persistence.

## 3. Provision and connect the three services

Provision **Aiven first**, then **Cloudinary**, then **Northflank**; do not expose the API as ready until migrations and dependency checks pass.

### Aiven Free PostgreSQL

- Create a dedicated Aiven project/service for the initial backend test, record the provider-selected region, and obtain the service URI plus project CA certificate. Use TLS with certificate and hostname verification (`verify-full`) where supported by the selected Prisma/PostgreSQL driver. [Aiven TLS guidance](https://aiven.io/docs/platform/concepts/tls-ssl-certificates).
- Create a least-privilege application database user and separate migration credential if the selected Aiven plan permits the required grants. Set a low Prisma pool size so the API, migration job and Aiven's own connections remain within the Free connection limit. Never expose the database password or CA material through a Vite `VITE_*` variable, Git, or a browser response.
- Use checked-in versioned migrations and run `prisma migrate deploy` through a one-shot Northflank job before starting a release; never use `db push` against hosted data. [Prisma production migrations](https://www.prisma.io/docs/cli/v7/migrate/deploy).

### Cloudinary Free

- Create one product environment, enable automatic asset backup before the first important upload, and keep the API secret in Northflank secrets only. Backups also consume the Free storage/credit allowance. [Cloudinary backups](https://cloudinary.com/documentation/backups_and_version_management).
- Upload through the authenticated Express API after checking actual image content/type and size (JPG/PNG/WebP, maximum 5 MB). Store Cloudinary asset ID/public ID, type, size, purchase/payment association and uploader metadata in PostgreSQL; do not persist image bytes or public delivery URLs in the database.
- Use Cloudinary `authenticated` delivery type and an Owner-authorized API retrieval route. Issue a one-off `private_download_url` with `type: authenticated` and a short Unix-seconds `expires_at`; never persist or embed that temporary URL. Do not use unsigned browser upload presets or assume an unguessable URL is private. Limit all test writes to the `pilot/` prefix. [Cloudinary access control](https://cloudinary.com/documentation/control_access_to_media).
- The single Free product environment means pilot and future production share quota and credential scope. A prefix protects application organization, **not** against a compromised Cloudinary credential. Never upload real receipts into the pilot namespace. Set usage alerts and an upgrade/stop-upload procedure before reaching the 25-credit allowance.

### Northflank Pay-as-you-go

- Connect the repository to a Northflank project, select a region after checking Aiven's assigned Free region and Bangladesh latency, and build the API from its Dockerfile. Create one continuously running service plus a one-shot migration job using the same image. The initial service may use one small replica; size it from measured memory/CPU, not an invented fixed capacity.
- Store `DATABASE_URL`, any required Aiven CA material, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_PREFIX=pilot`, and permitted origin configuration in environment-specific secret groups. The current opaque-session design has no signing secret; session and CSRF tokens are generated per login. Commit only example variable names. The API is public over HTTPS but every business route still requires server authorization. [Northflank secret groups](https://northflank.com/docs/v1/application/secure/inject-secrets).
- Configure readiness/liveness probes, a release workflow ordered **build → migrate → deploy**, and alerts for failed deployment, unavailable API and unusual cost. Never run migration independently in every API replica. [Northflank migration workflow](https://northflank.com/docs/v1/application/release/run-migrations).
- Restrict Aiven access to Northflank's static egress IP if that feature and its cost are acceptable for this initial deployment; otherwise document the temporary public-TLS exposure and block use of real business data. Aiven defaults can permit connections from any IP until an allowlist is configured. [Northflank egress IPs](https://northflank.com/docs/v1/application/network/configure-egress-ips), [Aiven IP filters](https://aiven.io/docs/products/postgresql/reference/advanced-params).

## 4. Verify, recover, and decide when real data is allowed

Initial acceptance requires: clean migration; API live/ready checks; test login/logout; Owner/Employee permission checks; customer → sale → stock/cash, order payment, purchase/receipt and report workflows; retry/concurrency tests; receipt denial to unauthorized users; container restart with the same PostgreSQL records and Cloudinary images. Record exact image digest, migration version, environment, commands and results in [Project Status](PROJECT_STATUS.md).

Aiven Free has backups but no production SLA and cannot be treated as a disaster-recovery guarantee. Demonstrate a restore into an isolated database before any real-data proposal, and verify that its receipt metadata still matches Cloudinary assets. Do not delete the source service, data or Cloudinary assets as part of routine testing. [Aiven restore guidance](https://aiven.io/docs/products/postgresql/howto/restore-backup).

**Real-shop gate:** no customer, finance or receipt data goes live merely because these three services are reachable. First finish and integrate the frontend; settle the production URL/cookie and CSRF configuration; decide whether Aiven Free's capacity, possible inactivity shutdown, backup window and no-SLA risk are acceptable or whether to upgrade; verify restore and billing ownership; then conduct a dated end-to-end release review. Vercel Hobby is not a commercial deployment option; defer Vercel and budget for Pro when the real shop frontend is launched. [Vercel commercial-use policy](https://vercel.com/docs/limits/fair-use-guidelines).

## 5. Later frontend deployment

After backend acceptance, deploy the React/Vite build to Vercel Pro. Use a Vercel-generated URL unless the Owner supplies a domain. Route `/api/v1/*` to the Northflank API before the SPA fallback so browser requests stay same-origin; keep database and Cloudinary secrets solely in Northflank. Test direct route refresh, authentication cookies, CSRF, both roles and all high-value flows on the deployed frontend. The current local web container is not proof of that release. [Vercel external rewrites](https://vercel.com/docs/routing/rewrites), [Vite SPA deep links](https://vercel.com/docs/frameworks/frontend/vite).

## Current status

The local Express/Prisma API now includes first-pass business routes, sale correction, immutable financial events and Cloudinary receipt code; see [`api/`](../api/README.md) for verification and remaining limitations. On 2026-10-04, the signed-in Aiven console showed Free PostgreSQL service `pg-f67b92b` in project `mahmud47bd-6758`, DigitalOcean `blr`, **Running** after its initial build; its credentials were not opened. A signed-in Cloudinary console and signed-in Northflank account were also observed, but Cloudinary's plan/authenticated upload-download and Northflank service configuration remain unverified. The Northflank in-app browser control repeatedly timed out; official CLI browser authorization succeeded without passing a token through chat. The first attempt to create `NI Fashion Pilot` in `asia-south-delhi` using [`api/deploy/northflank-project.json`](../api/deploy/northflank-project.json) was rejected with HTTP 409, “Region does not support free projects.” No project or paid runtime was created. The Owner must set up Northflank Pay-as-you-go billing/payment method and a billing alert before retrying this region. No hosted migration or API deployment has been verified. Vercel remains deferred. Use no real business data in these pilot resources.
