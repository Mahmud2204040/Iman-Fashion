# Project status

As of: 2026-10-04, Asia/Dhaka.
Basis: source/configuration inspection, service tests, Docker verification and rendered authentication browser checks through 2026-10-04. Older evidence remains below as history.
This is the active status record. It does not inherit the archived report's "all 15 phases complete" claim.

## Overall state

### Backend API implementation (2026-10-04)

The selected sequence—Northflank Pay-as-you-go, Aiven Free PostgreSQL and Cloudinary Free, with Vercel frontend deployment deferred—is documented in [Deployment Plan](DEPLOYMENT_PLAN.md). The [`api/`](../api/README.md) Express/Prisma service now has auth/accounts plus local business endpoints for customers/children, products/stock, sales, custom orders/payments, suppliers/purchases/payments, raw materials, expenses, cash/reconciliation, receipts and all 25 report slugs. Ten migrations include unique correction-chain links and append-only financial events. Sale create/void/replace, cash and stock effects use transactions. Local build and two dedicated business integration tests pass, including replacement chains, full return, zero/negative delta, rollback on stock failure, and representative domain/report flows. This is **local code verification**, not hosted or real-shop acceptance. On 2026-10-04 an Aiven Free PostgreSQL service was observed Running; Cloudinary and Northflank console sign-ins were verified. Northflank CLI authorization succeeded, but its project creation returned HTTP 409 because `asia-south-delhi` does not support free projects; Pay-as-you-go billing setup is pending. Hosted migration, Cloudinary integration and Northflank deployment remain unverified. Frontend business-data integration has not been completed; hosted records must remain test-only until the real-shop gate passes.

### Frontend authentication integration (2026-10-04)

The active React login, session restore, sign-out, profile password forms and Owner-managed Employee account UI use the API with an HttpOnly cookie and CSRF token. The mock `1234` credentials no longer authenticate the active UI. Earlier browser checks covered auth and account workflows. Business screens still use in-memory mocks: their data is neither authenticated nor persisted through the new API. Cloudinary receipt code exists, but no provider credentials or hosted upload/download verification are available. Frontend business integration and real-data acceptance remain open.

### Raw-material inventory refinement (2026-10-03)

The `/raw-materials` list no longer shows per-row Owner-only or Notes tags. Total quantity and recorded spend use separate compact cards. Add/edit forms and the mock raw-material record contract no longer include internal notes; search uses name and description only. Owner-only route/write permissions, cost recordkeeping and stock/cash isolation are unchanged. The active requirements, workflow, database plan, frontend plan and decision register reflect this change. `npm run smoke:raw-materials` passes 12/12, and lint, build, Docker rebuild, and rendered desktop/mobile checks passed for this refinement. Historical verification statements below remain scoped to their original dates.

### Mock frontend completion (2026-10-02)

The approved frontend plan is implemented for the mock-only scope. Owner and Employee routes and workflows now include `/purchases/new`, `/users`, shared customer creation, customer-required sales, live dashboard/customer/profile/report data, purchase-specific CASH supplier payments without automatic Cash Out, guarded purchase status/cancellation, receipt proofs, all 25 reports, bilingual UI, 404 and recoverable error boundary. Employee account metadata and language choice persist in browser storage; business records may reset on reload. This is **not** backend authorization, durable data, secure credential storage or production file storage.

Current verification: `npm run lint` passes with zero warnings/errors; `npm run build` passes with non-blocking Vite chunk/dynamic-import warnings; full `npm run smoke:all` passes (auth 11, sales 20, customers 23, custom orders 23, products 24, suppliers 20, purchases 28, raw materials 11, expenses 13, cash 25, reports 32, plus dashboard). The Docker frontend was rebuilt on port 8080. Browser inspection covered all 25 report routes and both languages on 29 known routes at 360, 414, 768, 1024, 1280 and 1440 px (no document-level horizontal overflow or blank/error page), plus direct/invalid routes, role boundaries, login and representative create/edit/payment/status/receipt/modal flows. Populated reports and empty states were inspected, not inferred from HTTP 200.

Final rendered regressions on Docker: expense date default uses Dhaka date and a changed date persisted in the created record while shop cash stayed unchanged; custom-order due date prefilled, changed and saved without the earlier event-handler crash; a dated purchase was created, marked ORDERED and paid in CASH with its supplier allocation while shop cash remained unchanged. Previous rendered flows covered shared quick customer creation while preserving a sale cart, sale stock/cash history, Employee custom-order status/payment, product opening stock, supplier/raw-material creation, and purchase receipt gallery/modal focus. Browser-only sample records were mock data and reset on reload.

React/Vite frontend and many mock module screens exist. Business data is in-memory; frontend authentication and account management are API-backed. The current root Docker configuration serves the compiled frontend only; PostgreSQL and the API run separately. Production security, business-data persistence and end-to-end acceptance are not complete.

The documentation baseline, requested implementation steps through cash reconciliation (FIX-01 through FIX-09), and M2 mock frontend scope are implemented. Persistent backend implementation remains open.

## Milestone status

| Milestone | Status | Evidence / remaining work |
| --- | --- | --- |
| M0 documentation | Verified | 13 active documents, 85 local links, 49 defined requirement IDs and 19 planned tables checked; all 16 archived originals retained |
| M1 business corrections | Implemented in mock frontend | FIX-01 through FIX-09 implemented; focused browser/service checks cover cash-only payments, Employee status changes and daily cash reconciliation; backend enforcement remains |
| M2 frontend acceptance | Verified for the approved mock scope | Current lint/build/full smoke, 25 rendered reports, 29 routes in both languages at six widths, Owner/Employee boundaries and representative cross-module browser workflows; no backend/persistence claim |
| M3 backend/schema | Local implementation advanced; production hardening open | Ten migrations and representative transaction tests pass; shared rate limits, full security review and hosted operational checks remain |
| M4 domain APIs | First-pass endpoints implemented locally | Business route and 25-report smoke tests pass; frontend services still use mocks, and broader domain/negative tests remain |
| M5 real integration | Auth/accounts integrated; business data not started | Login, session, profile and Employee management call the API; domain services still use mocks |
| M6 Docker full stack | Stage A frontend verified; Stage B in progress | Root compose still serves frontend only; isolated API Docker image built and its ready endpoint returned 200 against a local PostgreSQL test container, but no integrated full stack or provider deployment |
| M7 release | Not ready | Requires remaining milestones and evidence |

## Known implementation gaps

| ID | Finding and source evidence | Required task |
| --- | --- | --- |
| G01 | Resolved in mock frontend: Employee login/root redirect to /sales/new; /dashboard is Owner-only, hidden from Employee navigation, with Employee return to New Sale. Owner and Employee browser flows checked on port 5173. | FIX-01 done; backend role enforcement remains M3/M4 |
| G02 | Resolved in mock frontend: both creation entry points render [CustomerCreateFields](../src/components/customers/CustomerCreateFields.jsx) and use one [customerService](../src/services/customers/customerService.js) store/validation; Employee page access, customer-code search and sale-cart retention checked. | FIX-02 done; persistence remains M3/M5 |
| G03 | Resolved in mock frontend: child class derives only from registered date, child notes removed from fixtures/responses and meaningful mock notes moved to guardian notes; required child fields and audit on new records are enforced. | FIX-03 done; database schema migrated, domain API remains M4 |
| G04 | Resolved in mock frontend: four statuses only; payment does not auto-advance; Owner or Employee can manually use valid transitions, and DELIVERED requires full payment. | FIX-04 done; backend enforcement remains M3/M4 |
| G05 | Resolved in mock frontend: Employee can create orders, record cash payments and change valid order statuses, but cannot edit order terms/notes or access cash ledger. | FIX-04 done; backend enforcement remains M3/M4 |
| G06 | Resolved in mock frontend: all customer/order payments are cash-only; order advance and later CASH_IN rows reference their payment IDs; cancellation leaves payments untouched and exceptional refund is a separate Owner Cash Out with order code in reason. | FIX-05 done; backend transaction remains M3/M4 |
| G07 | Resolved for new sales: zero/blank item prices are rejected, canonical product availability and stock are checked, sale-time purchase cost is snapshotted, and sale completion reduces canonical stock with a stock-history row. | FIX-06/07 done; persistent transaction remains M3/M4 |
| G08 | Resolved in mock product-profit report: sale-time cost snapshots only; expenses are not deducted; missing historical cost displays N/A rather than invented profit. | FIX-07 done; backend report remains M4/M5 |
| G09 | Resolved in mock: one-time opening, matched/different daily counts, preserved recount history and separately confirmed signed adjustments; duplicate and stale adjustment protection. | FIX-08 done; persistence/real transactions remain M3/M4 |
| G10 | Resolved in mock: cumulative opening/closing and dated in/out/adjustment/reconciliation reports use Asia/Dhaka boundaries and the shared ledger. | FIX-08/09 done; backend reports remain M4/M5 |
| G11 | Supplier payments and expenses remain isolated from cash, covered by cash regression tests. | FIX-09 done in mock |
| G12 | Resolved: /custom-orders/new, /products/new, /raw-materials/new and /suppliers render on Docker; product, raw-material and supplier create flows were exercised in the browser. | M2 verified |
| G13 | Resolved for new mock sales: Sales searches the canonical [productService](../src/services/products/productService.js) catalogue and completion updates its stock/history. Historical sales fixtures still have legacy product IDs and unknown cost; their migration remains. | FIX-06 done; seed migration M2/M3 |
| G14 | Resolved in mock: [dashboardService](../src/services/dashboard/dashboardService.js) derives sales/orders/stock/cash KPIs from canonical services; browser and service regressions cover canonical data. | M2 verified |
| G15 | Resolved in mock: customer sales/orders/due derive from canonical records, including cancelled-order active-due exclusion; shared quick-create and customer history flows were exercised. | M2 verified |
| G16 | Resolved for mock scope: `/purchases/new` and `/users` render; purchase creation, dated terms, status and payment were exercised in the browser; account metadata/login/inactivation persistence is covered by auth regression tests and role UI checks. | M2 verified; backend remains M3/M4 |
| G17 | Resolved: [package.json](../package.json) smoke:all now includes scripts/smoke-reports.mjs. | FIX-07 done |

These are current mock-scope observations. The older evidence below is retained as historical context, not substituted for 2026-10-02 acceptance.

## Existing source changes

The working tree contains substantial pre-existing edits to pages, services, scripts and Docker artifacts. Preserve them. The documentation pass does not authorize resetting those changes.
Earlier in this conversation, the assistant changed:
- src/routes/AppRoutes.jsx
- src/routes/RootRedirect.jsx
- src/constants/navigation.js
- src/pages/UnauthorizedPage.jsx

That was a partial access/navigation update before the user requested documentation first. Subsequent M1 implementation now completes FIX-01 through FIX-09 in the mock frontend. No application edits belonged to M0.

## Verification evidence

| Date | Evidence | Scope and limit |
| --- | --- | --- |
| 2026-09-01 | [Archived final frontend report](archive/legacy-2026-10-01/FINAL_FRONTEND_VERIFICATION_REPORT.md) | Historical lint/build/service smoke claims; no full interactive browser or responsive pass |
| 2026-09-30 | [Archived Docker plan](archive/legacy-2026-10-01/DOCKER_PLAN.md) | Historical config/build/start/HTTP/restart checks; no interactive browser validation |
| 2026-10-01, before docs | npm run lint: 0 errors, 7 warnings | Earlier command in this conversation; not rerun for Markdown-only edits; not proof of financial/UI correctness |
| 2026-10-01, docs | Source/config reads and original-document snapshot | Confirms current file-level gaps and migration inventory only |
| 2026-10-01, docs | Documentation verification passed | 13 active files; 85 local links/anchors valid; referenced requirement IDs resolve to 49 definitions; exactly 19 schema tables |
| 2026-10-01, docs | Archive integrity passed | All 16 original document bodies match normalized text hashes after excluding archive banners; mixed-encoding progress report also matched byte-for-byte during its move |
| 2026-10-01, docs | Application-file integrity passed | 156 source/script/package/container files match the hashes captured before this documentation pass; no application code was changed in M0 |
| 2026-10-02, M2 | Fresh lint/build/full smoke and Docker rebuild | Zero lint warnings/errors; full mock service suite passed; Vite emits optimization-only warnings; localhost:8080 serves the current image |
| 2026-10-02, M2 | Rendered browser matrix | 29 known routes × six widths × English/Bangla; no document horizontal overflow or blank/error page; all 25 report detail routes opened and populated categories inspected |
| 2026-10-02, M2 | Interactive regressions | Expense date/cash isolation, custom-order due-date edit, purchase date/status/payment/cash isolation, login/role and cross-module mock workflows |

## Next work

1. Resolve the affected [open design items](DECISIONS.md#open-design-items) before backend contracts/migrations.
2. Continue M3–M7: backend/schema, APIs, real integration, full-stack Docker and release verification. Re-run browser acceptance against real persisted data; mock tests cannot prove backend behavior.

Update this document as work is actually verified; do not copy historical percentages or treat planned schema/API tables as implementation.

## Focused implementation verification (2026-10-01)

### Procurement Figma workbenches (2026-10-03)

- Confirmed the source Figma frames: Purchase History `89:2` (page `87:2`) and Supplier workspace `83:2`. `/purchases` and `/suppliers` now use list–detail workbenches; direct `/:id` URLs select the detail pane and remain refreshable. `/purchases/new` remains a separate creation form; opening it from a supplier preselects that supplier.
- This is a UI/UX change only. The existing mock purchase/supplier services still enforce purchase status/payment guards, CASH-only allocation to a specific purchase, cancelled-due exclusion and no automatic shop Cash Out. Figma sample actions for wire transfer and duplicate purchase were not implemented.
- Verified `npm run lint`, `npm run build`, `npm run smoke:all`, Docker rebuild on port 8080, rendered direct routes, mobile list-to-detail navigation, and no document horizontal overflow at 360, 414, 768, 1024, 1280 and 1440px for both workbenches and direct detail URLs. These are mock-frontend checks, not backend persistence or production authorization evidence.
- Follow-up: removed the unsupported supplier `category` from active UI, mock records and create/update/search contract; revised supplier smoke coverage to assert it stays absent. Purchase list now uses full-width, taller cards with no nested scroll and only a small gap after the last card. Supplier Add/Edit modal uses one column on narrow screens and keeps action buttons accessible while its body scrolls.

### Cash reconciliation follow-up

- Cash Management was redesigned into `/cash`, `/cash/opening`, `/cash/closing` and `/cash/closings`. The five overview figures share one desktop row; the seven-day Cash In/Out graph expands on demand; ledger search precedes manual Cash In/Out. The title-row actions use the user-facing labels Cash closing and Closing history, with Initial opening cash replacing Cash closing before setup.
- This redesign passed `npm run build`, lint with 0 errors/5 existing warnings, cash smoke 25/25, report smoke 31/31 and `git diff --check`. The rebuilt Docker frontend is healthy on port 8080; all four cash routes return HTTP 200.
- Docker port 8080 browser check covered initial opening 0, conditional header action, matched closing, second count with BDT 100 shortage, history, reasoned adjustment, expandable graph and working ledger search/manual Cash In. The mock balance changed from BDT 17,460 to BDT 17,510 after a manual BDT 50 Cash In before the shortage count.
- Implemented Owner-only initial opening, daily physical count (including exact matches), separate signed adjustment with reason/confirmation, and preserved same-day recount history. Saving a count alone never changes cash.
- Guards reject changed-ledger snapshots, superseded/previous-day counts, duplicate adjustments, invalid amounts and Employee access. Mock retries reuse the same saved count/adjustment.
- Cash service suite passed 24/24; reports suite passed 31/31. These cover cash isolation, date boundaries, carried opening, positive/negative adjustments and retries.
- Full `npm run smoke:all` passed; lint has 0 errors and 5 existing warnings; `git diff --check` passed. Updated Docker production build passed, container is healthy and `/cash` returns HTTP 200 on port 8080.
- Browser verified zero initial opening, matched BDT 17,460 count, BDT 100 shortage saved without changing cash, and confirmed adjustment to BDT 17,360 with original count history retained. Expected-cash report renders carried opening and its date filters.
- This is in-memory demo functionality: reloading the browser resets ledger/count changes. Database persistence, server authorization and database-level concurrency guarantees remain backend milestones.

### Earlier verification

- `npm run build` passed; `npm run lint` passed with 0 errors and 6 warnings; `git diff --check` passed.
- `npm run smoke:all` passed, including Sales 19/19, Custom Orders 22/22, Products 24/24, Cash 15/15, and Reports 31/31. Custom-order tests cover cash-only rejection, payment/cash atomicity, Employee status transitions, cancellation retention and delivery due checks.
- Current Vite dev build on port 5173: Employee login landed on /sales/new; direct /dashboard showed restricted access and New Sale return; /customers/new opened for Employee; the shared Sales modal accepted a customer with child while a cart line remained. Owner login landed on /dashboard.
- Current Vite browser check: new sale lists canonical products and displays an error for a zero-price item; custom-order list has only four statuses; Employee sees the cash-only payment form and Mark as ready/cancelled controls while cash ledger details and notes editing remain hidden.
- The generic report-page loader had sent Owner context in the wrong argument, yielding a false permission error; it now matches the report service signatures. The rebuilt port 8080 Product profit page rendered its KPI results in the Owner browser session.
- The port 8080 Docker frontend was rebuilt and recreated from the updated source; `docker compose ps` reported healthy, and the custom-order SPA route returned HTTP 200 and rendered the four status filters in-browser.
- Latest Employee browser check on the Vite build: custom-order detail shows Record cash payment (no bKash/Nagad/Bank selector), and Mark as ready / Mark as cancelled controls are available; notes editor and cash-ledger reference remain hidden.
