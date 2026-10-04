# Backend and API plan

Updated: 2026-10-04. Status: authentication, accounts and first-pass business-domain endpoints are implemented locally. Frontend domain integration, complete production hardening, and hosted pilot verification remain open.
Required behaviour: [Requirements](REQUIREMENTS.md). Schema: [Database Plan](DATABASE_PLAN.md). Access: [Role Permissions](ROLE_PERMISSIONS.md).

## Architecture

Node.js/Express in TypeScript, Prisma/PostgreSQL. Organize routes/controllers, request validation, authorization, domain services, persistence and response mapping. Domain services own totals, stock/cash effects and transactions; controllers do not implement separate business logic.

Use /api/v1 as the proposed API prefix and same-origin /api proxying through the web server.
Response contracts should be fixed before replacing mock services. Preserve the frontend service function names where practical and map API DTOs deliberately.

## Session and authorization

Use password hashes and server-validated opaque sessions stored by token hash in PostgreSQL. Transport is HttpOnly, Secure-in-production, SameSite cookies with a CSRF token for writes. Normal sessions expire after 12 hours; Remember me sessions after 30 days, without rolling renewal. The first auth foundation is implemented in [`api/`](../api/README.md); the current login throttle is process-local only and must become shared before live operation.
Mock login fixtures must never become production accounts/passwords.
Identify the actor from the authenticated session; reject body-supplied ownership/audit fields.
Return 401 for missing/expired authentication, 403 for disallowed action, and filtered Employee DTOs.

## Contract conventions

- JSON envelope: data plus optional meta; errors contain code, message and fieldErrors when appropriate.
- Represent money as decimal strings and dates as ISO timestamps or YYYY-MM-DD business dates. Use server decimal arithmetic.
- Lists support bounded page/pageSize, search and documented date/status filters. Apply server-side role filtering before pagination.
- Accept Idempotency-Key on financial/create operations. A repeated key/payload returns the original result; changed payload with the same key returns conflict.
- Do not trust frontend totals, due, stock, cash references or purchase-cost snapshots.
- Use positive quantities/prices as specified; reject empty strings masquerading as zero.
- Do not expose stack traces, password hashes, cost fields or cash balance in Employee responses.

## Endpoint map

These are the intended contracts. Most routes now have local implementations; verify each workflow before enabling real shop data.

| Module | Proposed endpoints | Access / behaviour |
| --- | --- | --- |
| Authentication | POST /auth/login, POST /auth/logout, GET /auth/me, POST /auth/password | Database-backed session; self password change revokes all sessions |
| Users | GET/POST /users, PATCH /users/:id, POST /users/:id/password | Owner; Employee accounts only, reauthentication for password reset, active-account validation |
| Dashboard | GET /dashboard | Owner only; derived KPIs |
| Customers | GET/POST /customers, GET/PATCH /customers/:id | Both roles; permitted fields only |
| Customer history | GET /customers/:id/sales, /orders, /due | Both; no cost/profit/supplier leakage |
| Customer status | PATCH /customers/:id/status | Owner |
| Children | POST /customers/:id/children, PATCH /children/:id | Both; registration fields and audit |
| Sales catalogue | GET /catalog/products | Both; safe identity/stock DTO; no purchase cost |
| Products | GET/POST /products, GET/PATCH /products/:id | Owner; optional purchase cost |
| Stock | GET/POST /products/:id/adjustments | Owner; atomic validated adjustment |
| Sales | GET/POST /sales, GET /sales/:id | Both; role-filtered result |
| Sale correction | POST /sales/:id/void, POST /sales/:id/replace | Owner; current completed sale only; full refund for void, atomic net settlement for replace |
| Custom orders | GET/POST /custom-orders, GET /custom-orders/:id | Both |
| Order metadata | PATCH /custom-orders/:id | Owner |
| Order status | POST /custom-orders/:id/ready, /deliver, /cancel | Owner or Employee; explicit valid status operations, delivery only with zero due |
| Order payments | POST /custom-orders/:id/payments | Both; cash-only, atomic payment + cash inflow |
| Suppliers | GET/POST /suppliers, GET/PATCH /suppliers/:id | Owner |
| Purchases | GET/POST /purchases, GET /purchases/:id | Owner; purchase and item writes atomic |
| Supplier payments | GET/POST /purchases/:id/payments | Owner; cash-only, purchase-specific, ORDERED/RECEIVED only, no cash side effect |
| Receipt proofs | POST/GET /purchases/:id/receipts, GET /receipts/:id/content | Owner; file validation and authorized content |
| Raw materials | GET/POST /raw-materials, PATCH /raw-materials/:id | Owner; record keeping only |
| Expense categories | GET/POST /expense-categories, PATCH /expense-categories/:id | Owner |
| Expenses | GET/POST /expenses, PATCH /expenses/:id | Owner; no cash/profit side effect |
| Cash | GET /cash/summary, GET /cash/transactions, POST /cash/opening, /cash/in, /cash/out | Owner; one-time opening, manual movements |
| Reconciliation | GET/POST /cash/reconciliations, POST /cash/reconciliations/:id/adjustment | Owner; record even matched, explicit adjustment |
| Reports | GET /reports/:type | Owner; allowlisted report type and filters |
| Health | GET /health/live, GET /health/ready | Minimal operational status; readiness verifies dependencies |

No delete endpoint for historical business records. Update behaviours must preserve auditability.

## Key write contracts

### Create customer

Input: name, phone, optional address/notes and children[].
Each child: name, initialClass, schoolName, registeredDate. No child notes.
Return the canonical customer and children after all validate and commit. Both Sales and Add New Customer use this endpoint.

### Complete sale

Input: required active customerId, items[] with productId, integer quantity and positive sellingPrice, optional notes.
Ignore/reject submitted purchaseCostAtSale, line totals, total, actor or cash values.
Service reads canonical products, snapshots unit costs and commits stock/sale/cash atomically.
Response: sale code, public item prices/quantities, total and customer. Employee response omits snapshots/profit; Owner can retrieve authorized cost details.

### Void versus replace

`POST /sales/:id/void` requires an Idempotency-Key, nonblank reason, `goodsReturnedConfirmed: true`, and `fullRefundConfirmed: true`. It restores all old stock, marks only the current completed sale VOIDED, posts one full-total CASH_OUT and appends revenue/cost reversal events. A current `REPLACEMENT_NETTED` sale can be fully returned; earlier correction cash rows remain unchanged.

`POST /sales/:id/replace` requires an Idempotency-Key, reason, corrected `customerId`, nonempty `items[]` with positive quantity/sellingPrice, and `cashDifferenceSettledConfirmed: true` when the total changes. A single database transaction locks the current completed sale, reverses old stock, creates a new completed sale with fresh code/cost snapshots, applies new stock, marks the old sale VOIDED, stores `SaleCorrection`, posts only `replacementTotal - originalTotal` to cash (no row for zero), and appends reversal/replacement financial events. Existing voided/superseded sales return 409. Unique original/replacement links prevent forks while allowing a chain.

Replacement sales have `settlementSource=REPLACEMENT_NETTED`, rather than another full cash-in. Every financial report consumes `financial_events`; original sale events remain on the original business date, while reversal/replacement events use the correction date. Do not rebuild this logic independently in report handlers or filter financial history solely by current sale status.

### Create order / record payment

Order input: customerId, productName, quantity, totalPrice, expectedDeliveryDate, optional description/notes/advanceAmount.
Zero advance means no payment row. Later payment input: amount and optional note. Employee is allowed.
Service determines payment ID, inserts it and the referenced cash inflow atomically. Full payment never updates readiness.
Return permitted order/payment details and updated due; do not return the shop cash ledger/balance to Employee.

### Cancel order

Owner or Employee submits cancellation confirmation/reason. Preserve prior payments; no refund, negative payment or automatic cash entry. If a refund occurs exceptionally, Owner uses manual Cash Out separately.
Do not offer automatic refund options that contradict ORDER-05.

### Create or update expense

Input: active categoryId, positive amount, expenseDate and optional description. There is no separate expense notes field in the API or database. Recording an expense must not move shop cash or product profit.

### Reconcile cash

Input: physicalCash and optional notes; server determines countedAt/businessDate and captures expected balance/version consistently.
Return saved observation including zero difference. Saving has no ledger side effect.
Adjustment endpoint requires Owner, nonblank reason and the observation identifier/version. Lock/check freshness and existing linkage. Insert one signed difference and link it atomically; stale observations return 409 with a recount instruction.

## Errors and transactions

Recommended error codes: VALIDATION_ERROR, FORBIDDEN_ROLE, NOT_FOUND, INSUFFICIENT_STOCK, INVALID_PRICE, OVERPAYMENT, CANCELLED_ORDER, INVALID_STATUS_TRANSITION, STALE_RECONCILIATION, ADJUSTMENT_ALREADY_APPLIED and IDEMPOTENCY_CONFLICT.
Use a stable error-code-to-form mapping in frontend services.

Follow the transaction groups and concurrency strategy in Database Plan. Test concurrent payments/stock sales and failures between related inserts. Preserve unknown historical costs; a report cannot repair them using current product cost.

## Uploads and operations

Validate image content/type and size, generate storage keys server-side, and prevent user-controlled filesystem paths. Persist proofs outside ephemeral container layers. Coordinate storage cleanup with failed database writes.
Configure database URL, permitted browser origins and upload location through environment/secrets. Opaque sessions need no signing secret. Implement readiness, structured logs without sensitive payloads and graceful shutdown.

Backend delivery is milestone M3/M4. Local endpoint presence is not evidence of cloud acceptance or frontend integration; keep hosted data test-only until the deployment gate passes.
