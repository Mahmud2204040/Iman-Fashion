# Test and acceptance plan

Updated: 2026-10-01. These scenarios define required evidence; they have not all been run.
Reference: [Requirements](REQUIREMENTS.md), [Implementation Plan](IMPLEMENTATION_PLAN.md).

## Existing checks

~~~sh
npm run lint
npm run build
npm run smoke:all
node scripts/smoke-reports.mjs
~~~

At this baseline, smoke:all omits the reports script. Run it separately until test wiring changes. Existing assertions must be reviewed against the new rules: passing an obsolete test does not validate the accepted behaviour.
For documentation-only edits, check links, references, archive integrity and absence of source changes; application test reruns are not necessary.

## Behaviour scenarios

| Test ID | Requirement IDs | Scenario and expected result |
| --- | --- | --- |
| T-AUTH-01 | AUTH-01, DASH-01 | Employee login/root goes to /sales/new; navigation omits Dashboard; direct /dashboard is forbidden. Owner lands on Dashboard. |
| T-AUTH-02 | AUTH-02, NFR-01 | Logged-out, expired, inactive and forbidden requests are rejected; Employee cannot bypass access via API calls. |
| T-CUST-01 | CUST-01, CUST-02 | Both roles create from Sales and Add New Customer; same fields/validation, shared search result, generated code/audit and retained sale cart. |
| T-CUST-02 | CUST-02, CHILD-03 | Invalid child row rejects the entire customer+children save; no orphan/partial records. |
| T-CHILD-01 | CHILD-01, CHILD-02 | Registration 2024-09-10, initial class 5, later created_at: before 2026 anniversary class 6, on anniversary class 7. No child notes in input/output/schema. |
| T-CHILD-02 | CHILD-01 | Test year boundary, leap-day convention, shop-local date and invalid dates; no 365-day arithmetic. |
| T-STOCK-01 | STOCK-01, STOCK-02 | Opening Stock is recorded; +/- adjustments require reason and cannot produce negative stock. |
| T-SALE-01 | SALE-02 | Reject zero, negative, blank and nonnumeric unit price even if other items make the total positive; reject invalid quantities. |
| T-SALE-02 | SALE-02, SALE-03 | Duplicate product selection merges quantity. Cash-only sale completion deducts canonical stock and creates exactly one sale CASH_IN. |
| T-SALE-03 | SALE-03, NFR-02 | Failure between related writes rolls back; duplicate request key does not repeat stock/cash effects; concurrent sale of last units cannot oversell. |
| T-ORDER-01 | ORDER-02, ORDER-04 | Only four accepted statuses; no IN_PROGRESS in active constants/filters/UI. Fully paid PENDING order stays PENDING until Owner or Employee manually marks READY. Both roles can make valid READY, DELIVERED and CANCELLED transitions; invalid roles/transitions are rejected. |
| T-ORDER-02 | ORDER-03 | Employee records cash payment successfully but cannot read cash balance. Non-cash advance/later payment is rejected without writes. Cash row references the payment ID, including advance; no orphan payment/cash record. |
| T-ORDER-03 | ORDER-03, ORDER-04 | Reject overpayment, cancelled-order payment and delivery with outstanding due. Zero advance creates no payment/cash row. |
| T-ORDER-04 | ORDER-05 | Owner or Employee cancellation preserves paid amount and existing cash total. Exceptional Owner manual Cash Out reduces cash once, with reason, without deleting old payments. |
| T-ORDER-05 | ORDER-06 | Order creation/payment/readiness/delivery does not mutate finished/raw stock. |
| T-ISOLATION-01 | SUP-03, EXP-02 | Create supplier payment and expense; cash ledger count/balance unchanged. Separate manual cash out changes cash only once. |
| T-CASH-01 | CASH-01, CASH-05 | Initial seed occurs once; opening includes cumulative history across quiet days; no daily OPENING inserts; use Asia/Dhaka cutoffs. |
| T-CASH-02 | CASH-03 | Expected 4,800 and physical 4,800 saves a matched reconciliation record with actor/time; no adjustment. |
| T-CASH-03 | CASH-03, CASH-04 | Expected 4,800 and physical 4,700 saves difference -100 without changing cash. Confirmed reason applies exactly one -100 adjustment. |
| T-CASH-04 | CASH-04 | Another cash write after count causes stale-count rejection/recount. Repeated adjustment request does not double-apply. Positive differences work too. |
| T-CASH-05 | CASH-03 | Recount preserves the earlier observation; historic expected/physical values do not change when later ledger entries arrive. |
| T-PROFIT-01 | PROFIT-01, PROFIT-02 | Sell 2 units at 650 with unit snapshot 400: profit 500. Later catalogue cost 500 or expense 100 does not alter that sale's profit. |
| T-PROFIT-02 | PROFIT-03 | Missing snapshot remains NULL and total profit is incomplete/N/A. Known-cost subtotal excludes unknown-cost lines and reports coverage. |
| T-PROFIT-03 | NFR-01, PROFIT-02 | Employee sale/search/history/completion payloads contain no cost snapshots or profit. Submitted cost values cannot override server snapshots. |
| T-PUR-01 | PUR-01, SUP-02 | Purchase line totals/payment history agree with supplier due. Cash-only payments are allocated to exactly one eligible purchase, never cross-supplier or double-counted; cancelled purchases contribute no active due. |
| T-RECEIPT-01 | RECEIPT-01, NFR-05 | Multiple valid images upload/view; invalid content/size and Employee retrieval are rejected; proofs survive container recreation. |
| T-RAW-01 | RAW-01 | Basic record works without unit/production fields or automatic stock/cash changes. |
| T-REPORT-01 | REPORT-01, CASH-05 | Report totals agree with canonical operations across date boundaries and empty ranges; Employee requests are denied. |
| T-USER-01 | USER-01 | Owner manages active Employee accounts; Employee cannot; last usable Owner cannot be disabled. |
| T-DEPLOY-01 | NFR-05 | Migrate empty/existing DB, restart/recreate containers, restore database and receipt backup; verify matching records/proofs. |

O001 requires a separate approved completed-sale correction contract before production behaviour ships. Customer-required sales, purchase allocation/status and cancelled-order active due are settled decisions D014-D017.

## Browser verification

For each role, use the real rendered application, not just source inspection or HTTP status:

1. Login and verify role landing/navigation/direct-URL restrictions.
2. Open list, create and detail routes; use forms and navigation.
3. Prioritize /custom-orders/new, /products/new, /raw-materials/new and /suppliers because the user reported missing/blank pages.
4. Create customer in Sales, verify it in Customers, and resume the cart.
5. Complete a cash sale; record cash-only order payment; verify Owner and Employee can manually mark READY/deliver/cancel within valid transitions.
6. Run matched and mismatched cash reconciliation and verify history/retry behaviour.
7. Verify errors, loading, empty states, refreshes and preserved form data.
8. Inspect visible console/runtime errors during each scenario.

Record browser, route, role, viewport, scenario and result. An Nginx SPA fallback returning 200 is not a rendering pass.

## Responsive and accessibility checks

Test 360, 414, 768, 1024, 1280 and 1440 px. Verify no inaccessible horizontal overflow, usable tables/cards, visible action buttons, sidebar/bottom navigation, labels/focus, keyboard dialogs and touch targets >= 40 px.
Use screenshots where they provide evidence of a layout claim. Do not claim device validation from CSS media queries alone.

## Evidence and release gate

Capture command, date, code revision/worktree, environment and meaningful result. Distinguish service tests, browser checks, PostgreSQL integration and deployment restoration.
Update Project Status only for checks actually performed. Historical reports remain archived. A failed invariant blocks its milestone; unrelated existing warnings are documented separately.
