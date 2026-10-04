# Frontend plan

Updated: 2026-10-01. Target: complete, verified mock workflows before real API integration.
Current progress: [Project Status](PROJECT_STATUS.md). Behaviour: [Workflows](WORKFLOWS.md).

## Current completion gate (2026-10-01)

The approved frontend-completion scope supersedes older "unresolved" Walk-in, supplier-allocation and cancelled-order-due notes below; see [Decisions](DECISIONS.md#confirmed-business-decisions). New customer-required sales, purchase-specific cash payment/status guards, receipt gallery, `/purchases/new`, `/users`, canonical dashboard/customer histories, 404/error boundary and 25 discoverable reports are implemented in the mock. The full bilingual page-copy pass, six-width responsive/keyboard audit and complete owner/employee interactive acceptance are still open. A passing service smoke suite or Docker HTTP response must not close this gate.

## Architecture and data ownership

Keep React 18/Vite/JavaScript, CSS Modules, React Router and the existing common components.
Pages call services; services provide one canonical customer catalogue, one product catalogue, a sale log, order/payments and cash ledger/reconciliations. Do not maintain separate mutable customer/product copies in Sales and management modules.
Share a CustomerCreateForm and validation contract between Add New Customer and the Sales creation flow. Optional child rows and guardian notes behave identically; preserve the sale cart when the form opens/closes.
When APIs arrive, replace service internals, not the workflow/component structure.

## Route and page inventory

Exists means a source page/route is present, not that its behaviour passed browser QA.

| Route/surface | Required UI | Role | Current source state |
| --- | --- | --- | --- |
| /login | Credentials, loading/error, mock banner until real auth | Public | Exists |
| / | Role-specific landing redirect | Auth-aware | Partially updated |
| /dashboard | Four derived KPIs, allowed navigation | Owner | Exists; needs fresh role/data verification |
| /sales | Search/filter sale history by code/date/customer | Both | Exists |
| /sales/new | Customer selection/create, product lookup, cart, prices, review, completion | Both | Exists; service/validation corrections pending |
| /sales/:id | Sale details and permitted history; Owner correction controls only after O001 | Both | Exists |
| /customers | Search/list and create entry | Both | Exists |
| /customers/new | Shared customer/optional-children form | Both | Exists; Owner-only page gate still needs correction |
| /customers/:id | Profile, children, sales, orders and due tabs | Both | Exists; verify canonical history and field filtering |
| /custom-orders | Status/search/due list | Both | Exists; remove IN_PROGRESS |
| /custom-orders/new | Customer, product/design, quantity, total, due date and optional cash advance | Both | Exists; recheck role gate and fields |
| /custom-orders/:id | Cash payments/history, due, Owner/Employee status/cancel controls | Both | Exists; verify both roles and valid transitions |
| /products | Finished-product catalogue and stock | Owner | Exists |
| /products/new | Create product and optional opening-stock adjustment | Owner | Exists; earlier missing-page complaint requires fresh browser check |
| /products/:id | Product edit/inactivation, stock adjustment/history | Owner | Exists |
| /suppliers | Supplier list/search and create/edit entry | Owner | Exists; earlier blank-page complaint remains unverified |
| /suppliers/:id | Purchases, paid/due totals, payments and history | Owner | Exists |
| /purchases | Purchase history and create entry | Owner | Exists; audit create-flow completeness |
| Purchase create surface | Multi-item purchase form; recommended /purchases/new if no complete inline form exists | Owner | Requires audit/implementation |
| /purchases/:id | Items, cash-only purchase payments, receipt gallery | Owner | Implemented in mock; interactive acceptance still pending |
| /raw-materials | Searchable raw-material records, edit entry, and separate total-quantity/recorded-spend cards; no per-row Owner-only/Notes tags | Owner | Combined Figma-based inventory workspace |
| /raw-materials/new | Add form opens over the same inventory workspace; no internal notes field. Direct URL remains valid. | Owner | Combined Figma-based inventory workspace |
| /expenses | Categories, add/edit expense, list/filter | Owner | Exists |
| /cash | Premium cash overview: five daily figures, collapsible seven-day Cash In/Out graph, search, manual movement actions and ledger | Owner | Implemented and browser-checked in mock; persistence pending |
| /cash/opening | One-time initial cash setup, available only before setup exists | Owner | Implemented in mock |
| /cash/closing | Physical cash count; save matching or different count without mutating cash | Owner | Implemented in mock; UI label is Cash closing |
| /cash/closings | Closing history, preserved recounts, reasoned/confirmed adjustment | Owner | Implemented in mock; UI label is Closing history |
| /reports and /reports/:reportType | Report groups, date filters, totals/details, honest product profit | Owner | Cost/cash corrections implemented in mock; full acceptance pending |
| /users | Employee account list/create/edit/active status | Owner | Implemented in mock; browser persistence/security limits documented |
| Unauthorized / Not Found | Clear message and valid role-specific return link | Relevant actor | Exists |
| /design-system | Development preview only | Development scope | Exists; exclude or guard for production |

Do not implement separate new/edit routes when a complete accessible modal/inline flow already satisfies the requirement. Record the chosen surface explicitly in this inventory.

## Priority corrections

1. Complete Employee landing on /sales/new across login, session restore, root and error links. Restrict Dashboard route/navigation/service data to Owner.
2. Unify customer creation form/store/validation; allow Employee on both entry points.
3. Remove child notes throughout service responses/seeds/forms and use registered_date exclusively for class derivation.
4. Remove IN_PROGRESS constants, badges, filters, transitions and fixtures. Owner or Employee manually sets READY; paid status never sets readiness.
5. Permit Employee order cash payments and valid status changes without exposing shop cash. Reject non-cash methods, reference payment IDs correctly and retain payments on cancellation.
6. Reject zero/negative/empty selling prices in UI and service; do not insert free lines.
7. Use canonical product data, capture private sale cost snapshots, update stock atomically and make shared views reflect the sale.
8. Build the reconciliation workflow and history, including matched records and explicit confirmed discrepancy adjustment.
9. Correct product-profit and cash reports; preserve unknown historical costs.
10. Audit all create/edit actions and direct/refreshed routes before declaring a module complete.

## Cash page composition

- Cash management title and Cash closing / Closing history actions share one row; initial opening replaces Cash closing until setup is saved.
- Cash In, Cash Out, Current cash, Today’s opening and Adjustment today share one desktop row. Daily opening is calculated from the carried ledger balance.
- The collapsible graph uses the last seven Asia/Dhaka dates and CASH_IN/CASH_OUT entries only.
- Ledger search sits to the left of manual Cash In/Out actions. Manual forms use date/reason and confirmation for outflow.
- Cash closing has a separate route and saves a count even when matched. Closing history has another route, including preserved recounts and linked adjustments.
- Apply difference only for eligible nonzero observations; require reason/confirmation and handle stale-count errors.
- Ledger and reference details remain Owner-only.

## Product profit display

Label Product profit. Use sale-item cost snapshots; do not subtract expenses.
Unknown snapshots produce an incomplete/N/A total with missing-cost coverage. Any known-cost subtotal must be explicitly labelled and exclude unknown-cost revenue/cost from that subtotal.
Show historical unit costs only to Owner. Replacing a product's current cost must not change old result cards.

## States, navigation and mobile

Every data-driven screen needs loading, empty, error, success and permission states. Retain form values on validation/network errors, disable duplicate submissions, and handle retry-safe responses.
Verify direct URL and refresh independently of menu clicks. /products/new must render a form, not a product with id "new".
Use the existing common FormField render contract and Modal focus behaviour.
At 360/414/768/1024/1280/1440 px, verify touch targets, keyboard/focus, horizontal overflow, tables/cards, form actions and navigation.

## Frontend exit criteria

### Procurement presentation decision (2026-10-03)

Use the approved Figma Purchase History and Supplier workspace frames as visual references. Purchase history and supplier directory each combine list and selected detail in one responsive workbench, while retaining `/:id` direct links and the separate purchase-create route. Preserve the existing service rules: supplier payments are CASH-only, allocated to an eligible purchase, and do not create shop Cash Out; received purchases cannot be cancelled or edited, and cancelled purchases have no active supplier due. Figma illustrative wire-transfer and duplicate-purchase actions are not requirements.

Supplier category is not part of the planned database or V1 requirements. Do not show or submit a supplier category field or seed one in the mock supplier model. Supplier search remains code/name/phone based. Purchase-history cards should fill the list pane without an inner scrollbar or large unused area; supplier Add/Edit forms use a responsive two-column desktop layout and one column on narrow screens.

All required create/view/edit actions are reachable, role-correct and data-consistent. Service tests cover financial rules; browser tests demonstrate real page rendering and workflows for both roles. No backend/security/persistence claim follows from mock tests.
After this gate, execute the real API integration milestone in [Implementation Plan](IMPLEMENTATION_PLAN.md).
