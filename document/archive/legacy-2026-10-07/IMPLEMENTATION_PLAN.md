# Implementation plan

Updated: 2026-10-01. Follow milestones in dependency order. This document defines work; [Project Status](PROJECT_STATUS.md) records evidence.
Requirement definitions: [Requirements](REQUIREMENTS.md). Verification: [Test Plan](TEST_PLAN.md).

## M0 — Documentation baseline

| Task | Deliverable |
| --- | --- |
| DOC-01 | Create thirteen active documents and root entry link |
| DOC-02 | Reconcile final user decisions across requirements, roles, workflows and technical plans |
| DOC-03 | Archive historical originals without losing their content |
| DOC-04 | Verify relative links, requirement references, schema count and status honesty |

Exit: active docs are consistent and discoverable; historical reports cannot be mistaken for current acceptance. No application change is part of this milestone.

## M1 — Approved frontend business corrections

Depends on M0. Work on current mock architecture; do not start backend yet.

| Task | Required work | Requirement IDs |
| --- | --- | --- |
| FIX-01 | Finish Employee login/root redirects, Owner Dashboard guards/navigation and usable forbidden-page return | AUTH-01, DASH-01, NFR-01 |
| FIX-02 | One shared customer creation form, validation and service/store; Employee access; retain sale cart | CUST-01, CUST-02, CHILD-03 |
| FIX-03 | Registration-based class, no child notes, guardian notes retained; fixture/schema documentation alignment | CHILD-01, CHILD-02 |
| FIX-04 | Four order statuses, remove IN_PROGRESS, manual Owner/Employee READY and valid status transitions, Employee create/payment permissions | ORDER-01, ORDER-02, ORDER-03, ORDER-04 |
| FIX-05 | Cash-only customer payments, payment-referenced cash rows, atomic mock operation, no cancel refund, explicit Owner manual refund path | SALE-03, ORDER-03, ORDER-05 |
| FIX-06 | Reject all zero-price sale items; canonical product lookup and shared stock update | SALE-02, SALE-03, STOCK-03 |
| FIX-07 | Sale-time cost snapshots, missing-cost behaviour and product-profit formula | PROFIT-01, PROFIT-02, PROFIT-03 |
| FIX-08 | Shared cumulative cash model, initial seed, matched/different reconciliation history and confirmed adjustment | CASH-01, CASH-02, CASH-03, CASH-04, CASH-05 |
| FIX-09 | Retain supplier/expense cash isolation and correct dependent cash/profit reports | SUP-03, EXP-02, REPORT-01 |

Recommended order: FIX-01/02/03; then FIX-04/05; canonical product integration and FIX-06/07; then FIX-08/09. Keep each change reviewable; preserve unrelated dirty work.
Exit: affected services pass scenario tests, no regression in other financial modules, and each changed UI flow passes focused Owner/Employee browser checks.

## M2 — Complete frontend workflows and acceptance

Depends on M1.

- Audit every route/create/edit surface in Frontend Plan; complete missing purchase/user-management screens as required.
- Verify /custom-orders/new, /products/new, /raw-materials/new and /suppliers specifically because earlier user complaints are not disproved by an HTTP 200.
- Ensure customer history, product availability and dashboard aggregates reflect the same canonical mock records.
- Exercise cancellation, no-refund messaging, settlement before delivery, zero-price rejection, unknown profit and matched reconciliation.
- Test role boundaries, direct URLs, refreshes, form validation and all six responsive widths.
- Add report smoke execution to the routine suite if it remains omitted; fix relevant warnings without unrelated refactoring.
- Update Project Status with exact commands/browser evidence.

Exit: complete realistic mock workflow accepted; no unresolved frontend blocker for the approved scope. A full backend is still not present.

## M3 — Backend foundation and schema

Depends on M2 and relevant Decisions gates.

- Implement the settled D022-D024 void/replace, net settlement and immutable event-reporting contracts; customer-required sales and purchase-specific supplier payments remain governed by D014-D016.
- Set up Express/Prisma/PostgreSQL, environment example, migrations and development seed data.
- Implement authentication, active users, Owner employee management, field filtering, errors and validation.
- Implement the nineteen-table schema with constraints/indexes, generated codes, retry keys and uploads metadata.
- Define consistent transaction/lock order and shop-local date utilities.
- Add health endpoints and server-level role tests.

Exit: empty-database migration and authentication/authorization tests pass; production credentials are not mock fixtures.

## M4 — Domain APIs

Depends on M3. Implement in this sequence:

1. Customers/children and canonical products/catalogue.
2. Stock adjustment and normal-sale atomic completion with cost snapshot.
3. Custom orders, cash-only payments, manual Owner/Employee readiness/delivery/cancellation.
4. Supplier/purchase/payment allocation and receipt uploads.
5. Raw materials and expenses with cash isolation.
6. Cash setup/movements, reconciliation save and explicit adjustment.
7. Owner reports using snapshots and source records; approved normal-sale corrections.

For each module, verify role filtering, boundary validation, retry behaviour, failure rollback and persistence. Cash primitives needed by sales/orders must exist before their atomic writes, even if the Owner cash UI/API is finalized later.

Exit: contracts from Backend/API Plan pass integration/concurrency tests against PostgreSQL; no mock data supplies production API responses.

## M5 — Real frontend integration

Depends on M4 endpoints as they become ready.

Replace mock service internals with API calls, implement real session handling and field mapping, preserve shared form contracts and user-entered state on failures.
Verify two-client/concurrent usage, session expiry, forbidden requests, refreshed pages and records after backend restarts.
Remove mock banners only from the real production mode. Preserve an explicit development mock mode if still useful.

Exit: Owner and Employee complete their authorized workflows using persistent data end to end.

## M6 — Full Docker and operations

Depends on M3-M5.

Cloud-hosting order is now defined in [Deployment Plan](DEPLOYMENT_PLAN.md): Northflank Pay-as-you-go API with Aiven Free PostgreSQL and Cloudinary Free receipts first, Vercel frontend later. Compose remains the local-development stack, not the selected cloud topology.

Extend the existing web-only stack to web/api/db, migrations, health/readiness checks, persistent database and receipt storage. Configure same-origin API proxying, environment/secrets and production deployment settings O004.
Test container recreation, migration upgrade and database-plus-files backup restoration.
Do not infer database durability from successful frontend container startup.

Exit: staging survives restart/recreation and restores from backup with matching records/files.

## M7 — Release verification

Depends on M0-M6.

- All accepted requirement IDs have implementation and test evidence.
- Roles are enforced on server and UI, including Employee payment permission and Dashboard denial.
- Sale/stock/cash/payment/reconciliation invariants survive retries and concurrent requests.
- Browser workflows and six-width responsive checks pass.
- Missing historical costs remain explicit; reports reconcile with operational records.
- Deployment, rollback/restore, credentials and operational ownership are documented.
- Open items are resolved or explicitly excluded with user-approved scope changes.

Exit: record a dated release verification report with commit/worktree identity, environment, commands, outcomes and limitations. Do not reuse the 2026-09-01 report as current evidence.

## Task close-out format

For each task record: requirement IDs; source/files or migration; status; exact checks; date/environment; result; remaining limitation.
No percentage based solely on file counts. Do not mark a task Verified when only its source has been inspected.
