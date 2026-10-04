# Iman Fashion API — local business backend

This Express/Prisma service implements database-backed auth/accounts, business-domain routes, Owner-only sale void/replacement, append-only financial events, 25 report routes and Cloudinary receipt handling. The React frontend currently uses the account endpoints; business screens still use mock services and are **not yet integrated** with these APIs. Hosted pilot deployment and real-data acceptance are outstanding.

## Local start

1. Use Node 22.12+ and a local PostgreSQL database. A disposable Docker example:

   ```powershell
   docker run --name ni-fashion-dev-postgres -e POSTGRES_USER=ni_fashion -e POSTGRES_PASSWORD=choose_a_local_password -e POSTGRES_DB=ni_fashion -p 127.0.0.1:5433:5432 -v ni-fashion-dev-pgdata:/var/lib/postgresql/data -d postgres:17
   ```

2. Copy `.env.example` to `.env`, set `DATABASE_URL` to your own local password, and list the exact frontend origins in `APP_ORIGINS`. Do not commit `.env`.
3. Run `npm ci`, `npm run db:deploy`, and `npm run build` in `api/`.
4. Set `BOOTSTRAP_OWNER_PASSWORD` (8–128 characters) securely in your shell, then run `npm run owner:bootstrap` once. Optional: `BOOTSTRAP_OWNER_USERNAME` and `BOOTSTRAP_OWNER_NAME`. No default Owner password is created.
5. Run `npm run dev`. The local `.env.example` uses port 4440 because this Windows host reserves port 4000. Verify `/health/live` and `/health/ready` on port 4440. The Docker image and Northflank service still use container port 4000.

Run the frontend with `npm run dev` from the repository root, or build its Docker frontend. Its default API URL is the browser's current hostname on port `4440`; set `VITE_API_BASE_URL` for another address **before** building. `APP_ORIGINS` must include the exact frontend origin. The app no longer accepts the old mock `1234` password; use the Owner credentials you bootstrapped. Frontend business screens are still mock-backed until their services are migrated to this API.

For auth/schema tests, set `NI_API_TEST_DATABASE_URL` to a **local** URL whose database path is `/ni_fashion`. For business tests, set `NI_API_BUSINESS_TEST_DATABASE_URL` to a separate **local** migrated database named `/ni_fashion_backend_test`; these tests leave synthetic immutable events in that dedicated database. `npm test` runs files sequentially to avoid cash reconciliation races. Without the variables, the corresponding DB tests are skipped.

The migrations contain PostgreSQL CHECK constraints, composite purchase/payment/receipt references, retry-key indexes, unique sale-correction links, an immutable financial-event trigger and cash-source uniqueness. Multi-row stock, settlement and cash changes are implemented in server transactions; local tests cover representative correction chains and domain workflows. This does **not** establish production readiness.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health/live` | Process liveness |
| GET | `/health/ready` | Database/table readiness |
| POST | `/api/v1/auth/login` | Username/password; optional `rememberMe: true`; sets HttpOnly session cookie and returns user plus CSRF token |
| GET | `/api/v1/auth/me` | Current active user plus CSRF token |
| POST | `/api/v1/auth/logout` | Revokes session; requires `X-CSRF-Token` |
| POST | `/api/v1/auth/password` | Change own password; requires current password and CSRF token; signs out all sessions |
| GET | `/api/v1/users` | Owner-only Employee list; `page` and `pageSize` (max 100) |
| POST | `/api/v1/users` | Owner-only Employee creation with `username`, optional `name`, and `password` |
| PATCH | `/api/v1/users/:id` | Owner-only Employee username/name/active-status update |
| POST | `/api/v1/users/:id/password` | Owner-only Employee password reset; requires `ownerPassword` and `newPassword` |
| GET/POST/PATCH | `/api/v1/customers`, `/api/v1/customers/:id`, `/api/v1/children/:id` | Customer and child records/history |
| GET/POST/PATCH | `/api/v1/products`, `/api/v1/products/:id`, `/api/v1/products/:id/adjustments` | Owner catalogue and stock; Employee uses `/catalog/products` |
| GET/POST | `/api/v1/sales`, `/api/v1/sales/:id` | Sale listing/detail/create; Owner responses may include cost snapshots |
| POST | `/api/v1/sales/:id/void`, `/api/v1/sales/:id/replace` | Owner-only full return versus one-transaction correction; Idempotency-Key required |
| GET/POST/PATCH | `/api/v1/custom-orders`, `/api/v1/custom-orders/:id`, `/api/v1/custom-orders/:id/payments` | Orders, terms and payments |
| GET/POST/PATCH | `/api/v1/suppliers`, `/api/v1/purchases`, `/api/v1/raw-materials`, `/api/v1/expenses` | Owner procurement and expense records |
| GET/POST | `/api/v1/cash/*`, `/api/v1/reports/:type`, `/api/v1/financial-events` | Owner cash ledger/reconciliation and canonical-event reports |
| POST/GET | `/api/v1/purchases/:id/receipts`, `/api/v1/receipts/:id/content` | Owner Cloudinary authenticated receipt upload and expiring download |

All account writes require the session's `X-CSRF-Token`. Password, username and active-status changes revoke affected sessions; an account version also invalidates any session created during a concurrent change. Only Employee accounts can be modified through `/users/:id`. Credentials and password hashes are never returned in account responses.

In production, cookie is Secure and `__Host-` prefixed. Keep frontend and API under the **same site** (for example `app.example.com` and `api.example.com`) for the default `SameSite=Lax` cookie; separate `*.vercel.app` and `*.northflank.app` origins will not support credentialed cross-site XHR reliably. Set `APP_ORIGINS` to the exact allowed browser origins, never `*`. `TRUST_PROXY_HOPS` may be set to the known number of Northflank reverse proxies after verification.

If the pilot Owner loses the bootstrap password, set a new 12–128 character `OWNER_RESET_PASSWORD` as a **temporary runtime secret on the API service**, restart it, and run `npm run owner:reset` once in that service's shell. The command resets only the existing `owner` account (or `OWNER_RESET_USERNAME` if explicitly set), refuses non-Owner accounts, hashes the new password, increments the account auth version, and deletes all sessions in one database transaction. It does not print the password. Remove the temporary secret and restart the service immediately afterward; never pass the password as a shell argument or paste it into chat. No public password-reset endpoint is exposed.

The login throttle is currently process-local and only a pilot safeguard. Before handling live customer or financial data, complete frontend business integration, shared rate limiting, broader authorization/security review, hosted backup/restore test, operational monitoring and the real-shop release gate. Never migrate browser mock fixtures as real business records without reconciliation.

## Hosted pilot still pending

The Docker build context is `api/`. Configure `DATABASE_URL`, `APP_ORIGINS`, `NODE_ENV=production`, `PORT=4000`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, and `CLOUDINARY_PREFIX=pilot` as Northflank secrets/variables. Run `npm run db:deploy` as a **separate one-off migration job** before starting or updating the service; do not run migrations concurrently from every replica. Keep Aiven and Cloudinary credentials out of Git. An Aiven Free PostgreSQL service was observed Running, and Cloudinary/Northflank sign-in was verified; no hosted migration or API deployment has been verified.
