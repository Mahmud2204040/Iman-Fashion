# Implementation plan

Updated: 2026-10-07. This document tracks the remaining work for the project. Most milestones are now complete and their detailed legacy plans are in `archive/legacy-2026-10-07/`.

## Milestones Status

| Milestone | Status | Details |
| --- | --- | --- |
| M0 — Documentation baseline | Complete | Active docs are consistent, old docs archived. |
| M1 — Approved frontend business corrections | Complete | Employee/Owner workflows and form adjustments completed. |
| M2 — Complete frontend workflows and acceptance | Complete | 25 reports, modals, tables, robust handling implemented. |
| M3 — Backend foundation and schema | Complete | Express/Prisma/PostgreSQL setup, schema, auth. |
| M4 — Domain APIs | Complete | Custom orders, sales, users, suppliers, purchases, cache layers L1-L5. |
| M5 — Real frontend integration | Complete | Fetch mapping, Auth context, L2 IndexedDB integration. |
| M6 — Full Docker and operations | Complete | Nginx reverse proxy, Vercel SPA routing, Cache control. |
| **M7 — Release verification** | **Pending** | Complete end-to-end testing, QA checks, Role validation on live. |

## M7 — Release verification (Next Steps)

Depends on M0-M6.

- All accepted requirement IDs have implementation and test evidence.
- Roles are enforced on server and UI, including Employee payment permission and Dashboard denial.
- Sale/stock/cash/payment/reconciliation invariants survive retries and concurrent requests.
- Browser workflows and six-width responsive checks pass.
- Missing historical costs remain explicit; reports reconcile with operational records.
- Deployment, rollback/restore, credentials and operational ownership are documented.
- Open items are resolved or explicitly excluded with user-approved scope changes.

Exit: Record a dated release verification report with commit/worktree identity, environment, commands, outcomes and limitations.
