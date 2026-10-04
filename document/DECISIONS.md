# Decision register

Updated: 2026-10-04. This records the user's decisions from the current conversation and the engineering designs used to implement them. Actual implementation status is tracked separately in [Project Status](PROJECT_STATUS.md).

## Confirmed business decisions

| ID | Decision | Requirement |
| --- | --- | --- |
| D001 | Dashboard is Owner-only. Employee login lands on /sales/new; remove Employee Dashboard navigation and reject direct access. | AUTH-01, DASH-01 |
| D002 | Zero-priced normal sales are prohibited. Each sale item's selling price must be greater than zero. | SALE-02 |
| D003 | Product profit is sales revenue minus product purchase cost. Do not subtract general expenses, raw materials, supplier payments or overhead. | PROFIT-01 |
| D004 | V1 uses a sale-time unit purchase-cost snapshot. A later catalogue price edit must not change historical profit. | PROFIT-02 |
| D005 | Derive a child's class from initial_class and completed years since registered_date. created_at is audit metadata. | CHILD-01 |
| D006 | No child notes field. Notes belong to the customer/guardian record. | CHILD-02 |
| D007 | Employees can create customers. Sales customer creation and Add New Customer must use the same fields, validation and canonical customer service. | CUST-01, CUST-02 |
| D008 | Remove IN_PROGRESS. Only PENDING, READY, DELIVERED, CANCELLED remain. Owner or Employee explicitly marks READY; full payment never changes readiness. Both roles may use valid status transitions, including cancellation. | ORDER-02, ORDER-04, ORDER-05 |
| D009 | Customer payments (normal sales and custom-order advance/later payments) are cash-only in V1. Employees may record custom-order cash payments; non-cash methods are rejected. | SALE-03, ORDER-03 |
| D010 | Cancellation retains advance/payments; there is no automatic refund or cash reversal. An exceptional refund is a separate Owner manual Cash Out with a reason. | ORDER-05 |
| D011 | Supplier payments and expenses create no cash transactions automatically. | SUP-03, EXP-02 |
| D012 | Persist a daily cash reconciliation record even when expected cash equals physical cash. A discrepancy adjustment needs Owner confirmation and a reason. | CASH-03 |
| D013 | Continue the ledger model: one-time initial opening seed; subsequent daily opening is derived from the previous closing balance. | CASH-01 |
| D014 | Every new normal sale requires an active customer. Walk-in creation is removed; legacy fixture records remain historical only. The former exclusion of completed-sale correction is superseded by D022. | SALE-01, SALE-05 |
| D015 | Supplier payments are cash-only and allocated to one specific purchase. They never automatically create a shop Cash Out. | SUP-02, SUP-03 |
| D016 | Purchase workflow is DRAFT → ORDERED → RECEIVED. Payment is allowed in ORDERED and RECEIVED. DRAFT/ORDERED may be cancelled only with no payments; RECEIVED cannot be cancelled. Cancelled purchases are excluded from active supplier due. Receiving has no automatic finished-product stock effect. | PUR-01, SUP-02 |
| D017 | A cancelled custom order retains original total and all payments, but its unpaid remainder is not active customer due. | ORDER-04, ORDER-05 |
| D018 | Mock UI starts in English, supports Bangla switching on login and app header, remembers browser choice, and retains English digits plus ৳ in Bangla UI. | NFR-06 |
| D019 | Mock Employee account metadata persists in browser storage, all demo accounts use one demo password, and no password is stored. Mock business records may reset on reload. | AUTH-01 |
| D020 | Receipt images are JPG, PNG or WebP, at most 5 MB each, multiple per purchase, optionally linked to one payment. Durable authorized storage remains a backend milestone. | RECEIPT-01 |
| D021 | Raw materials have no internal notes field. The inventory list has no per-row Owner-only or Notes tags; total quantity and recorded spend appear in separate compact cards. Owner-only access itself is unchanged. | RAW-01 |
| D022 | `/sales/:id/void` is only for genuine full return/cancellation and refunds the current sale's full total; `/sales/:id/replace` atomically voids the current completed sale and creates its replacement, reverses/reapplies stock, and posts only the cash difference. Already voided or superseded sales return 409. | SALE-05 |
| D023 | A replacement is `REPLACEMENT_NETTED`: it is fully settled by the original cash-in plus correction deltas, not by a second full cash-in. A later genuine full return refunds the current replacement's full total without changing prior correction cash movements. | SALE-03, SALE-05 |
| D024 | All financial reports read one append-only financial-event source. The original sale event stays on its original business date; correction reversal and replacement events belong to the correction date. Reports never infer history from current sale status. | REPORT-01, PROFIT-01 |

These decisions are final for this scope. Do not reopen them merely because existing mock code behaves differently.

## Adopted engineering designs

| ID | Design | Reason |
| --- | --- | --- |
| E001 | Create payment ID before its cash row; CUSTOM_ORDER_PAYMENT cash reference_id points to the payment, not the order. Insert both atomically. | One payment can be traced to exactly one cash inflow. |
| E002 | Add cash_reconciliations as the nineteenth planned core table. Preserve expected amount, counted amount, difference, actor and timestamp even when difference is zero. | Proves that cash was actually counted. |
| E003 | Saving a reconciliation records an observation. Applying its difference is a separate, explicit operation, linked to that record and guarded against retries/stale data. | Counting cash must not silently change the ledger. |
| E004 | sale_items.purchase_cost_at_sale is nullable NUMERIC(12,2). NULL means unknown; never backfill it from today's catalogue price. | Preserves honest historical profit. |
| E005 | Map existing mock IN_PROGRESS orders to PENDING when implementing the enum change. Do not claim they are ready. | Removes the invalid state without inventing completion. |
| E006 | Registration uses a DATE in the shop's timezone. Count calendar anniversaries, not 365-day durations. Test leap-day handling explicitly. | Stable yearly class calculation. |
| E007 | Retain the original root Markdown documents under archive and maintain one active document set. | Prevents outdated reports/copies overriding current rules. |
| E008 | Sequence the first cloud integration as Northflank Pay-as-you-go API, Aiven Free PostgreSQL and Cloudinary Free receipt storage; defer Vercel frontend deployment. Use test records until the real-shop release gate is met. | Records the selected provider order without treating a Free database or a saved plan as production verification. |
| E009 | Use opaque, database-backed, revocable HttpOnly sessions instead of JWT. A normal login expires after 12 hours; Remember me is an absolute 30-day session. Logout revokes it, inactive accounts are denied, and browser writes require a CSRF token. Password/credential/status changes revoke sessions and increment an account version to reject stale concurrent sessions. A 5-attempt/15-minute process-local login throttle is pilot-only and must become shared before live operation. | Resolves O005 for the auth foundation without storing tokens in frontend localStorage. |
| E010 | `sale_corrections.original_sale_id` and non-null `replacement_sale_id` are unique. One DB transaction writes correction, settlement, cash delta, stock effects and financial events; a database trigger rejects financial-event updates/deletes. | Prevents correction forks and partial financial state. |

E001 and E004 are implementation details of already agreed requirements, not new financial policies.

## Open design items

These are outside the just-finalized nine corrections. They do not block documentation or the approved frontend fixes. Resolve the affected item before its backend migration/API is finalized.

| ID | Item | Existing evidence / temporary boundary | Gate |
| --- | --- | --- | --- |
| O004 | Production environment | Backend-first providers are selected in [Deployment Plan](DEPLOYMENT_PLAN.md). Final live URL, frontend routing, Aiven Free real-data risk, restore/retention and operational ownership still require verification or acceptance. | Before real shop deployment |

Do not treat mock purchase statuses, a default selling price, a production/manufacturing flow or a separate ADMIN role as approved requirements.

## Change procedure

Assign a decision ID and date, identify the superseded rule, then update the relevant requirement, workflow, schema/API and test case. Leave old verification reports historical. Date future decisions individually rather than changing the date of this baseline.
