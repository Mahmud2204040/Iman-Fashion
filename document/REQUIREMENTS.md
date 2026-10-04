# Requirements

Updated: 2026-10-01. Status: active V1 specification.
Permissions are defined in [Role Permissions](ROLE_PERMISSIONS.md); user decisions and remaining exceptions are in [Decisions](DECISIONS.md).

## Product boundary

Iman Fashion is an internal shop application for clothing/accessories, customer families, direct sales, special orders, supplier accounting, basic stock and cash management. The frontend must work on mobile, tablet and desktop. Historical notebook records may be entered gradually.

V1 excludes ecommerce/customer login, online checkout, product/purchase returns, manufacturing, material consumption, bill of materials, payroll, a general customer credit ledger, school-wise inventory, dedicated measurement fields and automatic digital receipt printing.

## Access and dashboard

| ID | Requirement and acceptance outcome |
| --- | --- |
| AUTH-01 | Only OWNER and EMPLOYEE exist. Owner lands on /dashboard; Employee lands on /sales/new. Employee direct Dashboard access is denied. |
| AUTH-02 | Login/logout, active-user checks, hashed passwords and server authorization are required for production. Mock credentials/session storage are development-only. |
| DASH-01 | Owner dashboard has four primary metrics: today's sales, today's custom-order count, current expected shop cash and finished-product stock quantity. These derive from authoritative records, not fixed sample numbers. |
| USER-01 | Owner manages Employee accounts and active status. No ADMIN role or Employee access to user management. Never deactivate the last usable Owner account. |

## Customers and children

| ID | Requirement and acceptance outcome |
| --- | --- |
| CUST-01 | Owner and Employee can create customers. Name and phone are required; address and guardian notes are optional. A unique customer code and audit actor/timestamps are generated. Phone need not be globally unique. |
| CUST-02 | Sales customer creation and Add New Customer share form fields, validation and one customer service/store. Saving through either path makes the same customer immediately searchable in the other. Optional children may be saved atomically with the customer. |
| CUST-03 | Search by customer code, name or phone. Preserve customer sales history, custom orders and due information under the guardian/customer account. A normal sale need not identify a child. |
| CUST-04 | Do not delete customers. Owner may mark inactive; historical records remain accessible. |
| CHILD-01 | Child fields: name, initial_class, school_name and registered_date. Date defaults to the current shop date when omitted. Derive current_class from completed calendar years since registered_date. created_at is never the class calculation base. |
| CHILD-02 | No child notes or roll number. Guardian notes belong to customers.notes. School belongs to the child, not the product. |
| CHILD-03 | Support multiple children without an artificial four-child cap. Owner and Employee may add/edit permitted child data; retain created_by/updated_by. Children are optional when creating a customer, but each submitted child must be valid. |

## Finished products and stock

| ID | Requirement and acceptance outcome |
| --- | --- |
| PROD-01 | Owner manages finished products with generated product code, full descriptive name, optional purchase cost/notes and active status. No default selling price, school field or mandatory separate size/colour/type fields. |
| PROD-02 | Purchase cost is optional and Owner-only. Unknown cost remains NULL; never guess it. Product lookup for Employees exposes only permitted identity/availability fields. |
| STOCK-01 | Finished stock is integer pieces. Initial stock is an Owner stock adjustment with reason Opening Stock, preserving history from the first unit. |
| STOCK-02 | Owner can adjust stock by a nonzero signed quantity with a mandatory reason. Do not permit negative resulting stock or silent replacement of stock history. |
| STOCK-03 | Completing a normal sale deducts sold quantities atomically. Custom orders and raw-material entries have no automatic finished-stock effect. Supplier purchase entry has no automatic stock-receipt effect defined in V1. |

## Normal sales

| ID | Requirement and acceptance outcome |
| --- | --- |
| SALE-01 | Search/select an active customer or create one, select products, enter quantity and selling price, review and complete. Every new normal sale requires a customer; no new Walk-in sale. |
| SALE-02 | Every item requires an integer quantity greater than zero and an explicitly entered selling price greater than zero. Reject zero, negative, empty or nonnumeric prices. Merge repeat selections into one product line. |
| SALE-03 | Normal sales are fully paid in cash and have no customer due. Sale, items, cost snapshots, stock deduction and one automatic CASH_IN succeed or fail together. A retry must not create another sale/cash inflow. |
| SALE-04 | Generate a unique searchable sales_code; the existing S-YYYYMMDD-NNNN format is retained. Staff write it on the physical receipt. Preserve actor, date, status and item-level details. |
| SALE-05 | Employees may view/search sales but cannot correct them. Owner `/void` is only for a genuine full return/cancellation with full stock restoration, full refund, reason and actor. Owner `/replace` atomically voids only the current completed sale and creates a new completed sale with corrected customer/items/prices, stock reversal/new deduction, sale-time cost snapshots, correction link and only the net cash difference. A voided/superseded sale returns 409; one original cannot have two replacements. Partial returns remain out of scope. |

## Custom orders

| ID | Requirement and acceptance outcome |
| --- | --- |
| ORDER-01 | One requested product/design plus positive integer quantity per order in V1. Require customer, product description/name, total price and expected delivery date. Notes/description may contain measurements. Advance is optional; zero advance creates no payment row. |
| ORDER-02 | Exactly PENDING, READY, DELIVERED, CANCELLED. New orders start PENDING. Owner or Employee explicitly marks READY. Receiving full payment never changes readiness. No IN_PROGRESS. |
| ORDER-03 | Owner and Employee may record positive cash-only advance/later payments; reject any non-cash method. Preserve payment history, prevent overpayment and reject new payments on cancelled orders. Each payment atomically creates one CASH_IN referencing that payment's ID. |
| ORDER-04 | paid = sum(payments); active due = total_price - paid except cancelled orders, whose active due is zero. Preserve original total and payment history. Delivery records the actual delivery date and requires zero due. Owner and Employee may change order status through valid transitions. |
| ORDER-05 | Owner or Employee may cancel an undelivered order. Cancellation preserves order/payment history and retains all money already paid; it produces no refund or cash reversal. Any exceptional refund is a separate manual Owner Cash Out with a reason identifying the order. |
| ORDER-06 | Creating, paying, readying or delivering a custom order never automatically changes finished-product or raw-material stock. |

Cancelled-order unpaid remainder is not collectible active due in V1; preserve original numbers for history.

## Suppliers, purchases and receipt proofs

| ID | Requirement and acceptance outcome |
| --- | --- |
| SUP-01 | Owner creates/edits/searches suppliers by code/name/phone and may inactivate them. Preserve historical supplier records. |
| PUR-01 | A purchase belongs to a supplier and contains one or more items with quantity, unit purchase cost and optional description/notes. Record purchase date, total and actor. Item totals determine the purchase total. |
| SUP-02 | Allow partial/multiple cash-only supplier payments allocated to a specific ORDERED or RECEIVED purchase. Preserve payment dates/history and derive active supplier due excluding cancelled purchases. No unallocated payment. |
| SUP-03 | Supplier payments create no cash transactions automatically. A separate Owner manual Cash Out is required only when recording physical shop cash leaving. |
| RECEIPT-01 | Owner can attach and later view multiple JPG/PNG/WebP receipt images (up to 5 MB each) for a purchase, optionally linked to a payment. Preserve purchase association, uploader and timestamp. Authorized retrieval and persistent storage are required for production. |

Purchase status is DRAFT → ORDERED → RECEIVED. DRAFT/ORDERED may be cancelled only before payment; RECEIVED cannot be cancelled. RECEIVED purchases may still receive due payments. Receiving does not change finished-product stock. Purchase returns are outside V1.

## Raw materials and expenses

| ID | Requirement and acceptance outcome |
| --- | --- |
| RAW-01 | Owner records item name, quantity, date, optional description and purchase cost. Raw materials have no internal notes field. This is basic record keeping; no units/meters, production, consumption or automatic finished-product creation. |
| EXP-01 | Owner creates expense categories and expenses with category, positive amount, date and optional description. Expenses have no separate notes field. Support monthly/yearly/category reports. Employees cannot access expenses. |
| EXP-02 | Expense creation/editing produces no automatic cash transaction and is excluded from product-profit calculation. Physical cash removal is separately recorded by Owner. |

## Physical shop cash

| ID | Requirement and acceptance outcome |
| --- | --- |
| CASH-01 | Seed initial cash once, including an explicit zero opening if appropriate. Subsequent daily opening equals the ledger balance before that business day. Never insert a new OPENING row daily. |
| CASH-02 | Completed sales and custom-order payments create automatic CASH_IN. Owner may record manual positive Cash In/Out amounts with reason, date/time and actor. Supplier/expense writes never create these rows. |
| CASH-03 | Owner saves a daily reconciliation record containing business date, counting time, expected cash snapshot, physical count, difference and actor. Save it even when difference is zero. |
| CASH-04 | Saving a count does not adjust cash. Owner separately confirms a nonzero discrepancy adjustment with a reason. Link it to the reconciliation; prevent duplicate/stale application and preserve history. |
| CASH-05 | Current cash and opening/closing reports use the same ledger and Asia/Dhaka day boundaries. Cash values/history/reconciliation are Owner-only. |

Cash calculations:

~~~text
balance = initial opening + CASH_IN - CASH_OUT + signed CASH_ADJUSTMENT
daily opening = balance of all entries before that day's start
expected closing = daily opening + that day's net movements
difference at count = physical counted cash - expected cash at count
~~~

A reconciliation's expected/count/difference snapshot never changes when later transactions are added. Recount/correction records preserve the previous observation.

## Reports and product profit

| ID | Requirement and acceptance outcome |
| --- | --- |
| REPORT-01 | Owner-only sales, custom-order, stock, customer, supplier/purchase, raw-material, expense and cash reports. Support date filters where applicable and honest empty states. Cash reports include reconciliation observations and differences. |
| PROFIT-01 | Product profit = sum(quantity × selling_price) - sum(quantity × purchase_cost_at_sale). Exclude expenses, raw materials, supplier payments and overhead. Label it Product profit. |
| PROFIT-02 | Capture nullable purchase_cost_at_sale on each sale item from the canonical product record at sale creation. Later product cost edits do not modify this snapshot or historical profit. No batch accounting in V1. |
| PROFIT-03 | Unknown cost is NULL, not zero. Do not display a complete profit when relevant sale items lack snapshots. A separately labelled known-cost subtotal may be shown with coverage/missing counts. Never fabricate historical snapshots from current prices. |

All financial reports use the immutable financial-event ledger. Original sale revenue/cost remains on its original business date; correction reversal and replacement events are recorded on the correction date. A report must never discard historical revenue merely because the original sale is now VOIDED. Custom-order retained payments are tracked separately; do not mix them into normal-product profit without a new requirement.

## Nonfunctional acceptance

| ID | Outcome |
| --- | --- |
| NFR-01 | Server role checks and field filtering; no Employee leakage through shared endpoints, search, exports or errors. |
| NFR-02 | Database constraints, transactions and retry protection prevent partial/duplicate financial writes and negative stock/dues. |
| NFR-03 | Searchable, preserved audit history with generated codes, actor IDs and timestamps. |
| NFR-04 | Functional keyboard/mobile workflows and loading, empty, error and success states; verify real rendering at all six planned widths. |
| NFR-05 | Database and receipt files survive container recreation; migration and backup restoration are tested before production use. |
| NFR-06 | English/Bangla switch is available on login and app header, starts in English, remembers the browser choice, and translates navigation, forms, validation, statuses, dialogs, empty/error states and all reports. Bangla UI uses English digits and ৳. |

For executable acceptance scenarios, see [Test Plan](TEST_PLAN.md).
