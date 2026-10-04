# Shop workflows

Updated: 2026-10-01. These describe target behaviour, not a claim that the current mock app already implements it.
Rules and IDs: [Requirements](REQUIREMENTS.md). Actors: [Role Permissions](ROLE_PERMISSIONS.md).

## W01 — Login and navigation

Requirements: AUTH-01, AUTH-02, DASH-01.

1. User supplies credentials; production authentication verifies password and active account.
2. Owner enters Dashboard; Employee enters New Sale.
3. Navigation contains only allowed surfaces. Direct forbidden URLs show access denied with a valid role-specific return action.
4. Logout clears the session. Expired authentication returns to login without discarding more entered data than necessary.
5. Dashboard reads live aggregates; Employees never receive the dashboard payload.

## W02 — Customer and children

Requirements: CUST-01 through CUST-04, CHILD-01 through CHILD-03.

1. Search by customer code, phone or name.
2. Open an existing customer, or create one from Sales or Add New Customer.
3. Both entry points use the same fields: name, phone, optional address/guardian notes, optional child rows. They share validation and the customer service.
4. Each child row requires name, initial class, school and registration date. Omitted date defaults to today's shop date. No child notes field.
5. Validate every submitted child before creating the parent/children. On error, retain the form and save nothing partially.
6. Save generated customer code and actor/timestamps; make the record immediately available to all customer selectors.
7. In Sales, select the saved customer and preserve the cart. In Customer creation, open the profile.
8. Add further children from the profile; preserve history if the customer is later inactive.

Example: initial class 5, registered 2024-09-10, entered into the app 2026-10-01. On 2026-10-01 the derived class is 7, based on registration anniversaries. No annual mutation/job changes initial_class.

## W03 — Finished product and stock setup

Requirements: PROD-01, PROD-02, STOCK-01, STOCK-02.

1. Owner creates a descriptive product name/code, optional purchase cost and notes.
2. Product has no default selling price. Optional cost stays private to Owner.
3. Opening quantity creates an audited Opening Stock adjustment.
4. Later corrections use a signed quantity plus reason; validate nonnegative resulting stock.
5. Stock history distinguishes opening, manual corrections and completed-sale deductions.
6. Inactive products remain in historical sales; selection for new business must respect active status.

## W04 — Normal sale

Requirements: SALE-01 through SALE-05, STOCK-03, PROFIT-02.

1. Select/create an active customer; a new customer-less Walk-in sale is prohibited.
2. Search permitted product identity/stock. Enter positive integer quantity and an explicit positive unit selling price.
3. Selecting a product again merges its line quantity. Validate sufficient stock.
4. Show line totals and final total; customer pays the whole amount. There is no normal-sale due.
5. On completion, the authoritative service validates again, captures each product's current purchase cost privately, creates sale/items, deducts stock and creates one cash inflow.
6. Commit all related writes together; failures save none. Retried submissions return the original result.
7. Show sales_code for the handwritten receipt; update sale history and relevant aggregates.
8. Employees can view/search but not edit/cancel completed sales. Owner correction endpoints wait for O001.

Employees must not receive the captured cost when the completion response returns. Positive selling price applies to every item; a free line cannot be hidden inside an otherwise positive sale.

## W05 — Custom order and payment

Requirements: ORDER-01 through ORDER-06.

1. Owner/Employee selects or creates a customer and enters one requested product/design, quantity, total, expected delivery date and optional description/notes.
2. Save as PENDING. Optional cash advance greater than zero becomes a separate payment.
3. Accept cash only. For each advance/later payment, generate a payment ID and atomically insert the payment and one CASH_IN referencing that payment ID; reject non-cash methods.
4. Recalculate paid/due; reject overpayment and payments on cancelled orders.
5. Full payment changes paid/due only. Owner or Employee marks READY after the product is actually ready.
6. Owner or Employee delivers only after due is zero and records delivery date.
7. None of these operations automatically changes finished/raw stock.

Transitions for Owner and Employee: PENDING to READY; READY to DELIVERED; either role may cancel an undelivered order. DELIVERED/CANCELLED are terminal under the current plan. There is no IN_PROGRESS transition.

Example: total 2,500; first cash payment 500 gives due 2,000; later cash payment 2,000 gives due zero but status remains PENDING until Owner or Employee marks READY.

## W06 — Custom-order cancellation and exceptional refund

Requirement: ORDER-05.

1. Owner or Employee reviews the order and confirms cancellation.
2. Preserve original total, status history and all payment records.
3. Mark CANCELLED; do not delete payment records or reverse cash.
4. If Owner exceptionally returns money, separately record a manual Cash Out with a clear order/refund reason.
5. The manual cash movement does not erase or rewrite the original payment.
6. Display cancelled orders separately from active fulfilment; preserve original total/payments but show zero active due for their unpaid remainder.

This rule concerns custom orders only; it does not define normal-sale cancellation refunds.

## W07 — Supplier purchase and payments

Requirements: SUP-01, PUR-01, SUP-02, SUP-03, RECEIPT-01.

1. Owner searches/creates a supplier.
2. Enter purchase date and multiple items with quantities/unit costs; calculate the total.
3. Save the purchase and its items together; upload one or more receipt proofs.
4. Record partial/full supplier payments separately, preserving dates and actor.
5. Every cash-only supplier payment is allocated to a specific ORDERED/RECEIVED purchase. Cancelled purchases contribute no active supplier due; no payment creates automatic shop Cash Out.
6. No cash entry is generated. If physical shop cash was used, Owner separately records manual Cash Out with a reason.
7. Supplier purchase entry does not automatically receive finished stock under current V1 rules.

Example: purchase 20,000; payment 5,000 leaves supplier due 15,000. Shop cash is unchanged until an independent manual Cash Out is entered.

## W08 — Raw-material records

Requirement: RAW-01.

Owner adds item name, quantity, date and optional description/cost. There is no internal notes field. Search/view the record by item name or description/date. Creating or editing it neither consumes material nor manufactures products. No unit conversion or production chain is inferred.

## W09 — Expenses

Requirements: EXP-01, EXP-02.

Owner selects/creates a category, enters amount/date and an optional description, then saves the expense. Expense reports update. Shop cash and product profit do not change because of that record. If cash physically leaves the shop, record a separate manual Cash Out.

## W10 — Cash setup and day-to-day movement

Requirements: CASH-01, CASH-02, CASH-05.

1. Owner records one initial opening balance, including zero if starting empty.
2. For each later day, derive opening from the cumulative balance before the day starts in Asia/Dhaka.
3. Add automatic sale/payment inflows and Owner manual inflows/outflows.
4. Maintain references and actor/timestamp on every entry.
5. Current cash is the running signed ledger balance, not today's net movement alone.

## W11 — Daily cash reconciliation

Requirements: CASH-03, CASH-04, CASH-05.

1. Owner opens the day's reconciliation form and counts physical cash.
2. The service captures expected ledger balance at the counting time and a ledger version/cutoff.
3. Save business date, expected, physical, difference, actor and counting time even when difference is zero.
4. Saving alone has no cash effect.
5. If difference is nonzero, Owner can explicitly confirm an adjustment with a reason.
6. Before applying, verify that the observation is still current and no adjustment was already applied; otherwise request a fresh count.
7. Atomically insert the signed adjustment and link it to the reconciliation. Never apply it twice.
8. Later corrections/recounts preserve earlier observations. The next day's opening derives from the resulting ledger balance.

Example: opening 2,000 + sale 3,000 + order payment 500 - manual out 700 = expected 4,800.
Physical 4,800: save a matched record with difference 0; no adjustment.
Physical 4,700: save a record with difference -100. If Owner confirms correction, append -100; balance becomes 4,700.
If another payment arrives before correction, refresh/recount rather than applying a stale -100.

The implementation must retain a successful zero-difference count as evidence. A missing record and a matched count are different states.

## W12 — Reports and product profit

Requirements: REPORT-01, PROFIT-01 through PROFIT-03.

Owner chooses report/date filters; service reads the same canonical records used by operational pages. Restrict periods to shop-local day boundaries.

Example: two shirts sold at 650 each with a sale-time unit cost of 400. Revenue 1,300, cost 800, product profit 500.
Changing today's catalogue cost to 500 leaves that sale's profit at 500. An expense of 100 also leaves product profit at 500.
If one required cost snapshot is unknown, the whole-period profit is incomplete; display missing coverage rather than a fabricated total.

Supplier dues, custom-order payments and cash are separate reports. Avoid labelling cash inflow as profit.

## W13 — Development and delivery

Requirements: NFR-01 through NFR-05.

Read active docs, choose a traced milestone task, inspect current work, implement, verify affected workflows with both roles, and update evidence in Project Status. After mock UI acceptance, implement backend/schema, integrate real APIs, then validate full Docker persistence and backup restoration. Follow [Implementation Plan](IMPLEMENTATION_PLAN.md).
