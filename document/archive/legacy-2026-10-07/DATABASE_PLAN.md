# Database plan

Updated: 2026-10-04. Status: all 19 planned core models plus the additional auth `sessions` model have versioned Prisma/PostgreSQL migrations in `api/`. The migrations applied to both the local development database and a fresh empty verification database. No domain APIs or hosted database exist yet; database structure alone is not a working business backend.
Authority: [Requirements](REQUIREMENTS.md), [Role Permissions](ROLE_PERMISSIONS.md). Design gates: [Decisions](DECISIONS.md#open-design-items).

## Conventions and table count

PostgreSQL with Prisma, UUID primary keys, snake_case columns, NUMERIC(12,2) money, TIMESTAMPTZ event timestamps and DATE business dates. All FKs default to RESTRICT/NO ACTION for historical entities. Avoid cascade deletion of financial data.

There are **19 planned core tables**. The previous 18-table design gains cash_reconciliations. Do not add separate due/history tables for values that can be queried from source records.

Every table has id and created_at. Mutable master records also have updated_at. Unless stated otherwise, user-entered records have created_by (required FK users) and updated_by (nullable FK users); financial actor fields are server controlled. Use appropriate indexes on all FKs and date-filtered paths.

Schema descriptions below are the logical contract implemented by the Prisma schema and reviewed SQL migrations. Cross-row rules listed under Transactions and concurrency remain for the domain API implementation.

## Tables

### 1. users

username VARCHAR(100) UNIQUE NOT NULL; name VARCHAR(150) NOT NULL; phone VARCHAR(30) NULL; email VARCHAR(255) NULL; password_hash TEXT NOT NULL; auth_version INTEGER NOT NULL DEFAULT 0; role OWNER/EMPLOYEE NOT NULL; is_active BOOLEAN NOT NULL; created_at/updated_at.
Username is required because login uses username/password. No plaintext passwords or ADMIN role. Owner account lifecycle must preserve a usable Owner.

### 2. customers

customer_code VARCHAR(30) UNIQUE NOT NULL; name VARCHAR(150) NOT NULL; phone VARCHAR(30) NOT NULL; address TEXT NULL; notes TEXT NULL; status ACTIVE/INACTIVE NOT NULL; audit fields.
Phone is searchable but not globally unique. notes is the customer/guardian notes field. No hard delete.

### 3. children

customer_id UUID NOT NULL FK customers; name VARCHAR(150) NOT NULL; initial_class SMALLINT NOT NULL; school_name VARCHAR(255) NOT NULL; registered_date DATE NOT NULL; audit fields.
No notes, roll_number, current_class or annual class-update column/job. Current class is derived from initial_class plus completed anniversaries since registered_date. Do not use created_at as a substitute in new records.
Validate actual calendar dates. Use Asia/Dhaka for today's date; explicitly test leap-day anniversary handling.

### 4. products

product_code VARCHAR(50) UNIQUE NOT NULL; name VARCHAR(255) NOT NULL; purchase_price NUMERIC(12,2) NULL; stock_quantity INTEGER NOT NULL DEFAULT 0; notes TEXT NULL; status ACTIVE/INACTIVE NOT NULL; audit fields.
CHECK stock_quantity >= 0; purchase_price is NULL or >= 0. No selling-price default, school relation or mandatory separate size/colour/type fields. Historical product references remain valid when inactive.

### 5. sales

sales_code VARCHAR(50) UNIQUE NOT NULL; customer_id UUID NOT NULL FK customers; total_amount NUMERIC(12,2) NOT NULL; status COMPLETED NOT NULL; sale_date TIMESTAMPTZ NOT NULL; notes TEXT NULL; audit fields.
New sales require an active customer; no Walk-in creation. CHECK total_amount > 0. Legacy customer-less fixtures need an explicit migration review, not an invented customer.
Store a unique request key/fingerprint for retry protection as described below. Owner correction/revision storage is a gate under O001; do not silently overwrite completed records.

### 6. sale_items

sale_id UUID NOT NULL FK sales; product_id UUID NOT NULL FK products; product_name_at_sale VARCHAR(255) NOT NULL; quantity INTEGER NOT NULL; selling_price NUMERIC(12,2) NOT NULL; purchase_cost_at_sale NUMERIC(12,2) NULL; line_total NUMERIC(12,2) NOT NULL; created_at.
UNIQUE(sale_id, product_id); CHECK quantity > 0 and selling_price > 0; cost is NULL or >= 0; line_total = quantity * selling_price.
Snapshot the unit cost from the product inside the sale transaction. Reject/ignore client-submitted cost snapshots. Unknown stays NULL forever unless a separately approved historical correction supplies verified evidence. Do not update snapshots when products.purchase_price changes.
product_name_at_sale preserves the receipt label after product renaming. Employee DTOs exclude purchase_cost_at_sale.

### 7. custom_orders

order_code VARCHAR(50) UNIQUE NOT NULL; customer_id UUID NOT NULL FK customers; product_name VARCHAR(255) NOT NULL; description TEXT NULL; quantity INTEGER NOT NULL; total_price NUMERIC(12,2) NOT NULL; expected_delivery_date DATE NOT NULL; order_date TIMESTAMPTZ NOT NULL; delivery_date TIMESTAMPTZ NULL; status PENDING/READY/DELIVERED/CANCELLED NOT NULL; notes TEXT NULL; audit fields.
One requested design/product per order; no custom_order_items table in V1. Positive quantity/total. Store readiness/status changes with actor/time; Owner and Employee may perform valid transitions.
The implemented model retains ready/delivered/cancelled actor-and-time milestones in the same row; a SQL constraint checks that the current status and latest milestone agree. PENDING creation is represented by the order's actor/time.
Advance and paid are derived from payments, not independently editable totals. Active due is zero for cancelled orders while original total and payments remain. Cancellation creates no ledger reversal.

### 8. custom_order_payments

custom_order_id UUID NOT NULL FK custom_orders; amount NUMERIC(12,2) NOT NULL; payment_date TIMESTAMPTZ NOT NULL; notes TEXT NULL; created_by UUID NOT NULL FK users; created_at; retry key/fingerprint.
CHECK amount > 0. Cash is the only accepted method in V1; no payment-method table is needed. Under an order lock, reject cancelled orders, non-cash payment requests and payments exceeding the remaining due.
Exactly one CASH_IN with reference_type CUSTOM_ORDER_PAYMENT and reference_id equal to this payment's id is inserted in the same transaction. Do not reference custom_orders.id.

### 9. suppliers

supplier_code VARCHAR(50) UNIQUE NOT NULL; name VARCHAR(150) NOT NULL; phone VARCHAR(30) NULL; address TEXT NULL; notes TEXT NULL; status ACTIVE/INACTIVE NOT NULL; audit fields.
Preserve history when inactive.

### 10. purchases

purchase_code VARCHAR(50) UNIQUE NOT NULL; supplier_id UUID NOT NULL FK suppliers; total_amount NUMERIC(12,2) NOT NULL; purchase_date TIMESTAMPTZ NOT NULL; status DRAFT/ORDERED/RECEIVED/CANCELLED NOT NULL; notes TEXT NULL; audit fields.
Compute total from item lines. Enforce DRAFT → ORDERED → RECEIVED; cancel DRAFT/ORDERED only with zero payments; RECEIVED is not cancellable. Receiving does not update finished-product stock.

### 11. purchase_items

purchase_id UUID NOT NULL FK purchases; item_name VARCHAR(255) NOT NULL; quantity NUMERIC(12,2) NOT NULL; purchase_cost NUMERIC(12,2) NOT NULL; description TEXT NULL; notes TEXT NULL; created_at.
purchase_cost means unit purchase cost in this plan; line amount is quantity * purchase_cost. Validate positive quantity and nonnegative cost. These generic purchase records do not automatically update finished-product or raw-material stock.

### 12. supplier_payments

supplier_id UUID NOT NULL FK suppliers; purchase_id UUID NOT NULL FK purchases; amount NUMERIC(12,2) NOT NULL; payment_date TIMESTAMPTZ NOT NULL; notes TEXT NULL; created_by UUID NOT NULL FK users; created_at; retry key/fingerprint.
CHECK amount > 0. Cash-only payment is permitted only on ORDERED/RECEIVED purchases; verify supplier IDs match and cumulative payment does not exceed purchase total. Exclude cancelled purchases from active supplier due.
Never create a cash transaction as a side effect.

### 13. raw_materials

item_name VARCHAR(255) NOT NULL; quantity NUMERIC(12,2) NOT NULL; description TEXT NULL; date DATE NOT NULL; purchase_cost NUMERIC(12,2) NULL; audit fields. No raw-material notes column.
No unit, production, consumption or finished-product relation. The exact interpretation of optional cost must be labelled consistently in UI/API; retain the current basic record model.

### 14. expense_categories

name VARCHAR(100) NOT NULL; description TEXT NULL; is_active BOOLEAN NOT NULL; audit fields.
Use a normalized unique category name to prevent duplicate active labels. Referenced categories can be inactivated, not deleted.

### 15. expenses

expense_category_id UUID NOT NULL FK expense_categories; amount NUMERIC(12,2) NOT NULL; expense_date DATE NOT NULL; description TEXT NULL; audit fields. No separate expense notes column.
CHECK amount > 0. No automatic cash write; exclude from product-profit queries.

### 16. stock_adjustments

product_id UUID NOT NULL FK products; quantity_change INTEGER NOT NULL; reason TEXT NOT NULL; created_by UUID NOT NULL FK users; created_at.
CHECK quantity_change <> 0 and nonblank reason. Initial stock uses positive quantity_change and reason Opening Stock. Normal sales are queried from sale_items, not duplicated as manual adjustments.
Lock the product and update its quantity together with the adjustment.

### 17. cash_transactions

ledger_sequence BIGINT generated identity UNIQUE; transaction_type OPENING/CASH_IN/CASH_OUT/CASH_ADJUSTMENT NOT NULL; amount NUMERIC(12,2) NOT NULL; reference_type VARCHAR(50) NOT NULL; reference_id UUID NULL; reason TEXT NOT NULL; occurred_at TIMESTAMPTZ NOT NULL; created_by UUID NOT NULL FK users; created_at; retry key/fingerprint.

| Type | Stored amount | Reference |
| --- | --- | --- |
| OPENING | >= 0; one initial seed | INITIAL_SETUP |
| CASH_IN | > 0 | SALE with sale ID; CUSTOM_ORDER_PAYMENT with payment ID; MANUAL |
| CASH_OUT | > 0; subtract in balance | MANUAL |
| CASH_ADJUSTMENT | signed and nonzero | RECONCILIATION with reconciliation ID |

Use a partial unique constraint to permit at most one OPENING row. Use partial unique indexes for automatic (reference_type, reference_id) pairs so one sale/payment cannot create duplicate inflows; manual rows with null references remain allowed.
reference_id is polymorphic, not a PostgreSQL FK to multiple tables. Validate the source within the same service transaction; reconciliation adjustment also has a concrete FK link from cash_reconciliations.
SUPPLIER_PAYMENT and EXPENSE are not automatic ledger sources. An exceptional custom-order refund is a manual Cash Out with an explanatory reason, not a negative payment.

### 18. purchase_receipts

purchase_id UUID NOT NULL FK purchases; supplier_payment_id UUID NULL FK supplier_payments; storage_key TEXT NOT NULL; file_name VARCHAR(255) NOT NULL; mime_type VARCHAR(100) NOT NULL; size_bytes BIGINT NOT NULL; uploaded_by UUID NOT NULL FK users; created_at.
Store metadata/key, not image bytes/base64 in the database. Resolve authorized download URLs server-side. Store files in persistent volume/object storage; accept JPG/PNG/WebP only and at most 5 MB each, verify optional payment belongs to the purchase, and back up files with database metadata.

### 19. cash_reconciliations

business_date DATE NOT NULL; counted_at TIMESTAMPTZ NOT NULL; expected_cash NUMERIC(12,2) NOT NULL; physical_cash NUMERIC(12,2) NOT NULL; difference NUMERIC(12,2) NOT NULL; ledger_sequence_at_count BIGINT NOT NULL; notes TEXT NULL; reconciled_by UUID NOT NULL FK users; created_at; adjustment_transaction_id UUID NULL UNIQUE FK cash_transactions; supersedes_id UUID NULL FK cash_reconciliations; retry key/fingerprint.

CHECK physical_cash >= 0; difference = physical_cash - expected_cash.
Record zero-difference counts. Do not create a zero adjustment row.
Expected/physical/difference are immutable observations; only the one-time adjustment linkage is set by its controlled operation.
Allow multiple observations on one business date to preserve recount history; supersedes_id identifies a corrected count. Do not use a unique business_date constraint that overwrites an earlier count.
A nonzero discrepancy may remain unapplied. Derived display states are Matched, Difference not applied, Adjustment applied or Superseded; no forced cash mutation on save.

## Relationships

- users is the audit/actor parent for customer, child and financial operations.
- customers has many children, sales and custom_orders.
- sales has many sale_items; each item references products.
- custom_orders has many custom_order_payments; each payment has one referenced automatic cash inflow.
- suppliers has many purchases and supplier_payments; purchases has purchase_items and purchase_receipts.
- expense_categories has many expenses.
- products has many sale_items and stock_adjustments.
- cash_reconciliations may link one confirmed adjustment transaction; raw_materials remains separate.

## Derived values

custom-order paid = sum of its payments; active due = CASE WHEN status = CANCELLED THEN 0 ELSE total_price - paid END.
Supplier due = sum of non-cancelled purchase totals minus payments allocated to those purchases.
Cash balance = OPENING + CASH_IN - CASH_OUT + signed CASH_ADJUSTMENT.
Daily opening = cumulative balance before the shop-local day starts, including older days with no recent activity.
Product profit uses sale_items snapshots; expense tables are not part of that query.
Current child class uses registration anniversaries; do not persist a rolling current_class.

## Transactions and concurrency

| Operation | Atomic work |
| --- | --- |
| Customer + children | Validate all records, insert parent and every child or none |
| Sale | Lock products, check stock/prices, capture costs, insert sale/items, decrement stock, append unique cash inflow |
| Order + advance | Insert order, payment and matching payment-referenced cash inflow |
| Additional order payment | Lock order, validate role/status/due, insert payment and matching cash inflow |
| Stock adjustment | Lock product, prevent negative stock, insert adjustment and update stock |
| Reconciliation save | Obtain consistent ledger version/balance, insert immutable observation, no ledger mutation |
| Apply reconciliation | Confirm Owner/reason/current version, insert signed adjustment and set unique linkage or none |
| Supplier payment / expense | Write only the corresponding accounting records; no cash mutation |

Cash operations need one consistent concurrency strategy. A PostgreSQL transaction-level advisory lock for this single shop is the proposed approach: all ledger writes and reconciliation balance/version checks acquire it in a documented lock order. Identity sequence alone does not guarantee commit ordering.

For retryable writes, store request_key, request_fingerprint and actor on the target business record; UNIQUE(actor, request_key) returns the original result or rejects a key reused with another payload. Atomic cash-source uniqueness remains an independent safeguard. No extra idempotency table is required for the initial 19-table plan.

## Indexes and migrations

Index customer code/name/phone, children.customer_id, product code/name/status, sales date/customer/code, order customer/status/delivery date, payment parent/date, purchase supplier/date, expense date/category, cash occurred_at/reference pair and reconciliation business_date/counted_at.

Use versioned Prisma migrations. The auth foundation, auth-version, business-schema and order-milestone migrations now exist; the business migration includes PostgreSQL checks and partial/composite indexes not expressible in the Prisma model alone. A fresh-database migration and local constraint tests passed. O001 affects only future completed-sale correction endpoints; customer-required sales and purchase allocation/status contracts are now settled. Seed development data separately. Use prisma migrate deploy for deployed environments, not schema push or development migrations.
When migrating existing records: preserve unknown historical costs as NULL; remove child notes only after reviewing/moving any needed text to guardian notes; require registration dates from known data rather than silently substituting creation dates. No production data migration has been performed in this documentation pass.
