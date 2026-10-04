# Role permissions

Updated: 2026-10-01. This is the active action-level access matrix.
Roles: OWNER and EMPLOYEE only. See [Requirements](REQUIREMENTS.md).

## Page and data access

| Surface/data | Owner | Employee |
| --- | --- | --- |
| Login landing | /dashboard | /sales/new |
| Dashboard, including all KPIs | Allowed | Denied; no navigation item |
| New sale, sale list/detail/search | Allowed | Allowed, with cost/profit fields removed |
| Customer list/new/detail/history | Allowed | Allowed, with confidential fields removed |
| Children and customer/guardian notes | Allowed | Allowed within customer operations |
| Custom-order list/new/detail and customer due | Allowed | Allowed |
| Product management and stock history | Allowed | Denied |
| Product lookup inside sale entry | Allowed | Product identity, active status and available stock only; no cost |
| Suppliers, purchases, supplier dues/receipts | Allowed | Denied |
| Raw materials, expense categories/expenses | Allowed | Denied |
| Cash ledger, opening, adjustments, reconciliation | Allowed | Denied |
| Reports, profit, current/historical purchase costs | Allowed | Denied |
| Employee/user management | Allowed | Denied |

Customer sales history is visible to Employees. Owner-only analytics and costs do not become visible merely because they appear on a customer page.

## Write actions

| Action | Owner | Employee | Condition |
| --- | --- | --- | --- |
| Create a normal sale | Yes | Yes | Positive prices, valid quantities, fully paid in cash |
| Void or replace the current completed sale | Yes | No | Full-return confirmation for void; one atomic correction transaction for replace; preserve immutable financial/stock history |
| Create customer from either entry point | Yes | Yes | Same form and service contract |
| Edit customer name/phone/address/guardian notes | Yes | Yes | Record actor; IDs/audit fields are server-controlled |
| Set customer active/inactive | Yes | No | Historical records remain |
| Add/edit child information | Yes | Yes | Required registration fields; no child notes |
| Create a custom order | Yes | Yes | Customer and required order fields present |
| Record custom-order advance/later payment | Yes | Yes | Cash only, positive amount; cannot overpay or pay a cancelled order |
| Edit custom-order terms | Yes | No | Do not lower total below payments; preserve audit |
| Mark READY or DELIVERED | Yes | Yes | READY is manual; delivery requires settled due |
| Cancel custom order | Yes | Yes | Undelivered orders only; no automatic refund |
| Exceptional refund by manual Cash Out | Yes | No | Reason must identify the order/refund |
| Product/stock, supplier/purchase, expense and cash writes | Yes | No | Relevant workflow validation |
| Save reconciliation/apply discrepancy | Yes | No | Separate confirmation for adjustment |

Custom-order terms/notes remain Owner-only. Status changes are a separate permission granted to both roles; cash-ledger access and exceptional manual refunds remain Owner-only.

## Enforcement and response filtering

- Apply the matrix to navigation, route guards, handlers and server endpoints.
- Block direct Employee access to /dashboard. After login and root navigation, route Employees to /sales/new.
- An authorization error must provide a usable role-specific return path.
- The authenticated server actor, not a submitted role/username, controls authorization.
- Employee sale responses exclude purchase_cost_at_sale and profit.
- Employee order payment responses include the permitted order/payment result, not shop cash balance or the Owner cash ledger.
- Cost filtering must also cover exports, report links, error payloads and shared customer history responses.
- Test both UI navigation and direct API access: 401 for unauthenticated requests and 403 for authenticated forbidden actions.

The separate API enforces Owner-only Employee account management, self password changes, and server-side role checks on business endpoints. Frontend mock data and route guards are not a security boundary; business screens still require API integration.
