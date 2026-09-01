# NI Fashion — DATABASE_PLAN.md

**Project:** NI Fashion Shop Management System
**Document:** Database Architecture & Implementation Plan
**Version:** 1.0
**Status:** Proposed / V1
**Database:** PostgreSQL
**Backend:** Node.js + Express.js
**ORM:** TBD
**Architecture:** Relational Database

---

# 1. Database Design Goals

The database must:

1. Preserve business history.
2. Maintain inventory consistency.
3. Maintain customer history.
4. Maintain supplier history.
5. Separate finished products from raw materials.
6. Separate supplier payments from shop cash.
7. Separate expenses from shop cash.
8. Support optional product purchase costs.
9. Support multiple children per customer.
10. Support multiple custom-order payments.
11. Support multiple supplier payments.
12. Support stock adjustment history.
13. Support cash transaction history.
14. Support Owner/Employee authorization.
15. Avoid unnecessary tables and over-engineering.
16. Allow future modules to be added without redesigning the entire system.

---

# 2. Core Design Principles

## 2.1 Financial History Must Be Immutable

Business transactions should not be physically deleted.

Examples:

* Sales
* Sale items
* Custom orders
* Custom-order payments
* Purchases
* Purchase items
* Supplier payments
* Expenses
* Cash transactions
* Stock adjustments

If a transaction needs to be invalidated, use a status such as:

```text
CANCELLED
```

rather than deleting the record.

---

# 3. Entity Overview

The V1 database contains the following core tables:

```text
1. users
2. customers
3. children
4. products
5. sales
6. sale_items
7. custom_orders
8. custom_order_payments
9. suppliers
10. purchases
11. purchase_items
12. supplier_payments
13. raw_materials
14. expenses
15. expense_categories
16. stock_adjustments
17. cash_transactions
```

### Total: 17 tables

The system intentionally does not create unnecessary tables for:

* Product types
* Product sizes
* Product colours
* Schools
* Payment methods
* Discounts
* Measurements
* Production
* Product returns
* Purchase returns
* Customer credit ledger

---

# 4. Relationship Overview

```text
users
 │
 ├───────────────┐
 │               │
 ▼               ▼
sales          expenses
 │
 ▼
sale_items
 │
 ▼
products


customers
 │
 ├──────────────► children
 │
 ├──────────────► sales
 │
 └──────────────► custom_orders
                       │
                       └──────► custom_order_payments


suppliers
 │
 ├──────────────► purchases
 │                    │
 │                    └──────► purchase_items
 │
 └──────────────► supplier_payments


products
 │
 └──────────────► stock_adjustments


users
 │
 └──────────────► cash_transactions
```

---

# 5. Naming Conventions

Use:

* `snake_case` for table names
* `snake_case` for column names
* Singular semantic meaning but plural table names
* UUID or BIGINT IDs depending on implementation decision
* Foreign keys named `<table>_id`

Examples:

```text
customer_id
product_id
supplier_id
sale_id
order_id
```

---

# 6. Common Column Conventions

Most major tables should use:

```text
id
created_at
updated_at
```

Where relevant:

```text
created_by
updated_by
```

All timestamps should be stored consistently.

Recommended:

```text
TIMESTAMPTZ
```

PostgreSQL timezone-aware timestamps are preferred.

---

# 7. Table: users

Stores application users.

Only two roles exist.

## Columns

| Column        | Type         | Required | Notes            |
| ------------- | ------------ | -------: | ---------------- |
| id            | UUID         |      Yes | PK               |
| name          | VARCHAR(150) |      Yes | User name        |
| phone         | VARCHAR(30)  |       No | Optional         |
| email         | VARCHAR(255) |       No | Optional         |
| password_hash | TEXT         |      Yes | Hashed password  |
| role          | ENUM         |      Yes | OWNER / EMPLOYEE |
| is_active     | BOOLEAN      |      Yes | Default true     |
| created_at    | TIMESTAMPTZ  |      Yes |                  |
| updated_at    | TIMESTAMPTZ  |      Yes |                  |

## Role

```text
OWNER
EMPLOYEE
```

No ADMIN role.

---

# 8. Table: customers

Stores the main customer account.

A customer represents the parent/customer account rather than an individual child.

## Columns

| Column        | Type         | Required |
| ------------- | ------------ | -------: |
| id            | UUID         |      Yes |
| customer_code | VARCHAR(30)  |      Yes |
| name          | VARCHAR(150) |      Yes |
| phone         | VARCHAR(30)  |      Yes |
| address       | TEXT         |       No |
| notes         | TEXT         |       No |
| status        | ENUM         |      Yes |
| created_by    | UUID         |      Yes |
| updated_by    | UUID         |       No |
| created_at    | TIMESTAMPTZ  |      Yes |
| updated_at    | TIMESTAMPTZ  |      Yes |

## Status

```text
ACTIVE
INACTIVE
```

Customer records must never be physically deleted.

`created_by` records which user added the customer (employees may create customers, so audit is required).
`updated_by` records which user last modified the record.

## Audit Columns

```text
created_by  : UUID  - required, the user who created the customer record
updated_by  : UUID  - optional, the user who last edited the customer (NULL when never edited)
```

`created_by` is mandatory at insert time and must reference an existing `users.id`.
`updated_by` is set on every UPDATE and NULL until the first edit.

## Constraints

```text
UNIQUE(customer_code)
```

Phone does not necessarily need to be globally unique because real-world customers may share phone numbers.

---

# 9. Table: children

Stores children associated with a customer.

## Columns

| Column        | Type         | Required |
| ------------- | ------------ | -------: |
| id            | UUID         |      Yes |
| customer_id   | UUID         |      Yes |
| name          | VARCHAR(150) |      Yes |
| initial_class | SMALLINT     |      Yes |
| school_name   | VARCHAR(255) |      Yes |
| notes         | TEXT         |       No |
| created_by    | UUID         |      Yes |
| updated_by    | UUID         |       No |
| created_at    | TIMESTAMPTZ  |      Yes |
| updated_at    | TIMESTAMPTZ  |      Yes |

## Foreign Key

```text
customer_id → customers.id
```

## Audit Columns

```text
created_by  : UUID  - required, the user who added this child record
updated_by  : UUID  - optional, the user who last edited this child (NULL when never edited)
```

`created_by` is mandatory at insert time and must reference an existing `users.id`.
`updated_by` is set on every UPDATE and NULL until the first edit.

## Important Design Decision

Do **not** store the current class as the source of truth.

The database stores:

```text
initial_class
created_at
```

Current class is calculated using the elapsed number of completed years.

Example:

```text
created_at:
01 Sep 2026

initial_class:
5
```

On:

```text
01 Sep 2027 → 6
01 Sep 2028 → 7
01 Sep 2029 → 8
```

This avoids yearly manual database updates.

---

# 10. Child Class Calculation

Conceptually:

```text
current_class =
initial_class
+
completed_years_since_created_at
```

The backend should calculate this value when displaying child information.

The database should not need a scheduled job simply to increment classes.

---

# 11. Table: products

Stores finished products only.

Raw materials must not be stored here.

## Columns

| Column         | Type          | Required |
| -------------- | ------------- | -------: |
| id             | UUID          |      Yes |
| product_code   | VARCHAR(50)   |      Yes |
| name           | VARCHAR(255)  |      Yes |
| purchase_price | NUMERIC(12,2) |       No |
| stock_quantity | INTEGER       |      Yes |
| notes          | TEXT          |       No |
| status         | ENUM          |      Yes |
| created_at     | TIMESTAMPTZ   |      Yes |
| updated_at     | TIMESTAMPTZ   |      Yes |

## Status

```text
ACTIVE
INACTIVE
```

## Important Rules

There is:

* No default selling price
* No school_id
* No separate size column
* No separate colour column
* No separate type column

Example:

```text
Navy Blue Pant - XXL
```

is stored as one product name.

---

# 12. Product Purchase Price

`purchase_price` is optional.

Example:

```text
purchase_price = NULL
```

is valid.

Only Owner users may access this value.

Employees must never receive it through employee-facing API responses.

---

# 13. Product Stock

`stock_quantity` represents current finished-product quantity.

Example:

```text
Product:
Blue Shirt - 40

stock_quantity:
25
```

Stock changes through controlled backend operations.

The frontend must never directly update `stock_quantity`.

---

# 14. Table: sales

Stores direct completed customer sales.

## Columns

| Column       | Type          | Required |
| ------------ | ------------- | -------: |
| id           | UUID          |      Yes |
| sales_code   | VARCHAR(50)   |      Yes |
| customer_id  | UUID          |      Yes |
| total_amount | NUMERIC(12,2) |      Yes |
| status       | ENUM          |      Yes |
| sale_date    | TIMESTAMPTZ   |      Yes |
| notes        | TEXT          |       No |
| created_by   | UUID          |      Yes |
| updated_by   | UUID          |       No |
| created_at   | TIMESTAMPTZ   |      Yes |
| updated_at   | TIMESTAMPTZ   |      Yes |

## Status

Recommended:

```text
COMPLETED
CANCELLED
```

## Foreign Keys

```text
customer_id → customers.id
created_by → users.id
updated_by → users.id
```

---

# 15. Table: sale_items

A sale can contain multiple products.

This table is necessary because one sale may contain:

```text
2 shirts
1 pant
1 shoe
```

## Columns

| Column        | Type          | Required |
| ------------- | ------------- | -------: |
| id            | UUID          |      Yes |
| sale_id       | UUID          |      Yes |
| product_id    | UUID          |      Yes |
| quantity      | INTEGER       |      Yes |
| selling_price | NUMERIC(12,2) |      Yes |
| line_total    | NUMERIC(12,2) |      Yes |
| created_at    | TIMESTAMPTZ   |      Yes |

## Foreign Keys

```text
sale_id → sales.id
product_id → products.id
```

## Important

The product's current purchase price must not be used to reconstruct historical sale profit.

The sale item stores the actual selling price used at the time of sale.

---

# 16. Sale Item Uniqueness

The same product must not appear twice within one sale.

Recommended database constraint:

```text
UNIQUE(sale_id, product_id)
```

If the employee selects an already selected product, backend logic should increase the quantity rather than create another line.

---

# 17. Why sale_items Is Required

Even though `sales` contains the customer and total, it cannot represent multiple products correctly.

For example:

```text
Sale #1001

Customer:
017XXXXXXXX

Products:
Blue Shirt - 2
Navy Pant - 1
Black Shoe - 1
```

Without `sale_items`, this information cannot be represented relationally.

Therefore:

```text
sales
+
sale_items
```

is required.

---

# 18. Table: custom_orders

Stores custom/special orders.

This is intentionally separate from normal sales.

## Columns

| Column                 | Type          | Required |
| ---------------------- | ------------- | -------: |
| id                     | UUID          |      Yes |
| order_code             | VARCHAR(50)   |      Yes |
| customer_id            | UUID          |      Yes |
| product_name           | VARCHAR(255)  |      Yes |
| description            | TEXT          |       No |
| quantity               | INTEGER       |      Yes |
| total_price            | NUMERIC(12,2) |      Yes |
| expected_delivery_date | DATE          |      Yes |
| order_date             | TIMESTAMPTZ   |      Yes |
| delivery_date          | TIMESTAMPTZ   |       No |
| status                 | ENUM          |      Yes |
| notes                  | TEXT          |       No |
| created_by             | UUID          |      Yes |
| updated_by             | UUID          |       No |
| created_at             | TIMESTAMPTZ   |      Yes |
| updated_at             | TIMESTAMPTZ   |      Yes |

## Status

```text
PENDING
READY
DELIVERED
CANCELLED
```

---

# 19. Why custom_order_items Is NOT Required

For the current V1 requirements, a custom order is centered around one requested product/design.

Therefore, unlike a normal sale, a separate `custom_order_items` table is not required.

If future requirements allow one custom order to contain multiple completely separate products, then a `custom_order_items` table can be introduced later.

V1 keeps the model simpler.

---

# 20. Table: custom_order_payments

Stores advance and subsequent payments for custom orders.

Multiple payments are allowed.

## Columns

| Column          | Type          | Required |
| --------------- | ------------- | -------: |
| id              | UUID          |      Yes |
| custom_order_id | UUID          |      Yes |
| amount          | NUMERIC(12,2) |      Yes |
| payment_date    | TIMESTAMPTZ   |      Yes |
| notes           | TEXT          |       No |
| created_by      | UUID          |      Yes |
| created_at      | TIMESTAMPTZ   |      Yes |

## Foreign Keys

```text
custom_order_id → custom_orders.id
created_by → users.id
```

---

# 21. Custom Order Due

Do not store `due` as an independently editable database field.

Calculate:

```text
due =
total_price
-
SUM(custom_order_payments.amount)
```

This avoids inconsistent values.

Example:

```text
Total = 2500

Payments:
500
1000

Due = 1000
```

---

# 22. Table: suppliers

Stores supplier information.

## Columns

| Column        | Type         | Required |
| ------------- | ------------ | -------: |
| id            | UUID         |      Yes |
| supplier_code | VARCHAR(50)  |      Yes |
| name          | VARCHAR(150) |      Yes |
| phone         | VARCHAR(30)  |       No |
| address       | TEXT         |       No |
| notes         | TEXT         |       No |
| status        | ENUM         |      Yes |
| created_at    | TIMESTAMPTZ  |      Yes |
| updated_at    | TIMESTAMPTZ  |      Yes |

## Status

```text
ACTIVE
INACTIVE
```

---

# 23. Table: purchases

Stores supplier purchase transactions.

## Columns

| Column        | Type          | Required |
| ------------- | ------------- | -------: |
| id            | UUID          |      Yes |
| purchase_code | VARCHAR(50)   |      Yes |
| supplier_id   | UUID          |      Yes |
| total_amount  | NUMERIC(12,2) |      Yes |
| purchase_date | TIMESTAMPTZ   |      Yes |
| notes         | TEXT          |       No |
| created_by    | UUID          |      Yes |
| created_at    | TIMESTAMPTZ   |      Yes |
| updated_at    | TIMESTAMPTZ   |      Yes |

## Foreign Keys

```text
supplier_id → suppliers.id
created_by → users.id
```

---

# 24. Purchase Due

Do not store supplier due as a manually editable value.

Calculate:

```text
Supplier Due =
SUM(Purchases)
-
SUM(Supplier Payments)
```

This provides a reliable source of truth.

---

# 25. Table: purchase_items

Stores individual items within a purchase.

## Columns

| Column        | Type          | Required |
| ------------- | ------------- | -------: |
| id            | UUID          |      Yes |
| purchase_id   | UUID          |      Yes |
| item_name     | VARCHAR(255)  |      Yes |
| quantity      | NUMERIC(12,2) |      Yes |
| purchase_cost | NUMERIC(12,2) |      Yes |
| description   | TEXT          |       No |
| notes         | TEXT          |       No |
| created_at    | TIMESTAMPTZ   |      Yes |

## Foreign Key

```text
purchase_id → purchases.id
```

---

# 26. Why purchase_items Is Required

A purchase can contain multiple items:

```text
Purchase #5001

Fabric
Button
Thread
```

Therefore:

```text
purchases
+
purchase_items
```

is required.

This is not the same thing as finished-product inventory.

---

# 27. Supplier Receipt Proof

The database should support receipt image references.

Because supplier purchases may have multiple receipt images, use a separate table if image upload is implemented in V1.

### Additional table: purchase_receipts

This table is therefore included if receipt upload is part of the implementation.

## Columns

| Column      | Type         | Required |
| ----------- | ------------ | -------: |
| id          | UUID         |      Yes |
| purchase_id | UUID         |      Yes |
| file_url    | TEXT         |      Yes |
| file_name   | VARCHAR(255) |       No |
| uploaded_by | UUID         |      Yes |
| created_at  | TIMESTAMPTZ  |      Yes |

## Relationship

```text
purchases
   │
   └── purchase_receipts
```

### Updated Table Count

With receipt-proof support:

```text
18 tables
```

---

# 28. Table: supplier_payments

Stores payments made to suppliers.

## Columns

| Column       | Type          | Required |
| ------------ | ------------- | -------: |
| id           | UUID          |      Yes |
| supplier_id  | UUID          |      Yes |
| amount       | NUMERIC(12,2) |      Yes |
| payment_date | TIMESTAMPTZ   |      Yes |
| notes        | TEXT          |       No |
| created_by   | UUID          |      Yes |
| created_at   | TIMESTAMPTZ   |      Yes |

## Foreign Keys

```text
supplier_id → suppliers.id
created_by → users.id
```

---

# 29. Critical Supplier Payment Rule

Supplier payment must NOT create a cash transaction automatically.

These are separate domains:

```text
Supplier Accounting
        │
        ├── Purchases
        ├── Supplier Payments
        └── Supplier Due


Shop Physical Cash
        │
        ├── Cash In
        ├── Cash Out
        └── Cash Adjustment
```

There must be no automatic FK between:

```text
supplier_payments
```

and:

```text
cash_transactions
```

---

# 30. Table: raw_materials

Stores basic raw-material records.

This module is intentionally simple.

## Columns

| Column        | Type          | Required |
| ------------- | ------------- | -------: |
| id            | UUID          |      Yes |
| item_name     | VARCHAR(255)  |      Yes |
| quantity      | NUMERIC(12,2) |      Yes |
| description   | TEXT          |       No |
| date          | DATE          |      Yes |
| notes         | TEXT          |       No |
| purchase_cost | NUMERIC(12,2) |       No |
| created_by    | UUID          |      Yes |
| created_at    | TIMESTAMPTZ   |      Yes |
| updated_at    | TIMESTAMPTZ   |      Yes |

No unit column is required.

No production relationship is required.

---

# 31. Raw Material Scope

Raw materials are not connected to:

```text
products
```

through a production table.

There is no:

```text
production
bill_of_materials
material_consumption
```

in V1.

---

# 32. Table: expense_categories

Allows Owner to define expense categories.

## Columns

| Column      | Type         | Required |
| ----------- | ------------ | -------: |
| id          | UUID         |      Yes |
| name        | VARCHAR(100) |      Yes |
| description | TEXT         |       No |
| is_active   | BOOLEAN      |      Yes |
| created_at  | TIMESTAMPTZ  |      Yes |
| updated_at  | TIMESTAMPTZ  |      Yes |

Examples:

```text
Electricity
Rent
Transport
Maintenance
Miscellaneous
```

---

# 33. Table: expenses

Stores business expenses.

## Columns

| Column              | Type          | Required |
| ------------------- | ------------- | -------: |
| id                  | UUID          |      Yes |
| expense_category_id | UUID          |      Yes |
| amount              | NUMERIC(12,2) |      Yes |
| expense_date        | DATE          |      Yes |
| description         | TEXT          |       No |
| notes               | TEXT          |       No |
| created_by          | UUID          |      Yes |
| created_at          | TIMESTAMPTZ   |      Yes |
| updated_at          | TIMESTAMPTZ   |      Yes |

## Foreign Keys

```text
expense_category_id → expense_categories.id
created_by → users.id
```

---

# 34. Expense and Cash Separation

Creating an expense must NOT automatically create:

```text
cash_transactions
```

Example:

```text
Expense:
৳2,000

Expense Record:
CREATED

Cash:
UNCHANGED
```

If physical shop cash is removed, Owner separately records:

```text
Cash Out:
৳2,000
Reason:
Electricity bill
```

This intentional separation matches the business requirement.

---

# 35. Table: stock_adjustments

Stores manual finished-product stock changes.

## Columns

| Column          | Type        | Required |
| --------------- | ----------- | -------: |
| id              | UUID        |      Yes |
| product_id      | UUID        |      Yes |
| quantity_change | INTEGER     |      Yes |
| reason          | TEXT        |      Yes |
| created_by      | UUID        |      Yes |
| created_at      | TIMESTAMPTZ |      Yes |

## Example — Correction

```text
Product:
Blue Shirt - 40

quantity_change:
-2

reason:
Product problem
```

## Example — Opening Stock

When the system is bootstrapped, the initial stock of each product is recorded as a `stock_adjustments` row with `reason = "Opening Stock"` and a positive `quantity_change`.

This preserves the history of where the initial stock came from, even though there is no `inventory_movements` table.

```text
Product:
Blue Shirt - 40

quantity_change:
+10

reason:
Opening Stock
```

Subsequent manual corrections (damaged goods, theft, count mismatch) also use this table with a descriptive `reason`.

---

# 36. Stock Adjustment Rules

Only Owner can create stock adjustments.

The backend must:

1. Validate product.
2. Validate quantity.
3. Ensure stock does not become invalid.
4. Update product stock.
5. Create stock-adjustment history.
6. Commit everything in one transaction.

---

# 37. Table: cash_transactions

Stores physical shop cash movements.

This is a ledger.

## Columns

| Column           | Type          | Required |
| ---------------- | ------------- | -------: |
| id               | UUID          |      Yes |
| transaction_type | ENUM          |      Yes |
| amount           | NUMERIC(12,2) |      Yes |
| transaction_date | TIMESTAMPTZ   |      Yes |
| reason           | TEXT          |      Yes |
| reference_type   | VARCHAR(50)   |       No |
| reference_id     | UUID          |       No |
| created_by       | UUID          |      Yes |
| created_at       | TIMESTAMPTZ   |      Yes |

## Transaction Types

```text
OPENING
CASH_IN
CASH_OUT
CASH_ADJUSTMENT
```

`OPENING` is reserved for the **one-time initial seed** (first cash balance when the system is bootstrapped).
It is NOT inserted on a daily basis. The opening cash for each day is derived from the previous day’s closing cash (see §41).

`CASH_IN`, `CASH_OUT`, and `CASH_ADJUSTMENT` are generic cash movements.
The `reference_type` + `reference_id` columns link each row to its business source:

```text
reference_type = SALE                  → CASH_IN  (cash from a normal sale)
reference_type = CUSTOM_ORDER_PAYMENT  → CASH_IN  (advance / due payment for a custom order)
reference_type = SUPPLIER_PAYMENT      → CASH_OUT (cash paid to a supplier)
reference_type = EXPENSE               → CASH_OUT (cash spent on a shop expense)
reference_type = OWNER_INVESTMENT      → CASH_IN  (cash injected into the shop by the OWNER)
reference_type = OWNER_WITHDRAWAL      → CASH_OUT (cash taken out by the OWNER for personal use)
reference_type = CASH_ADJUSTMENT       → CASH_ADJUSTMENT (reconciliation difference)
```

Adding a new cash source later requires only a new `reference_type` value — no schema change.

---

# 38. Cash Ledger

Expected physical cash can be calculated from the cash ledger.

Conceptually:

```text
Expected Cash =
Opening Cash
+
Cash In
+
Sale Cash
-
Cash Out
+
Adjustments
```

The implementation should define a consistent sign convention.

Recommended:

```text
CASH_IN         → positive
OPENING         → positive  (initial seed only)
CASH_OUT        → negative
CASH_ADJUSTMENT → signed
```

Normal sales use `CASH_IN` with `reference_type = SALE` (no separate `SALE_CASH_IN` type).

---

# 39. Cash and Sales

A completed normal sale is fully paid.

Therefore the corresponding sale should contribute to physical cash.

When the sale is completed:

```text
sales
   +
sale_items
   +
cash_transactions
   +
inventory update
```

should be handled atomically.

---

# 40. Custom Order and Cash

Every `custom_order_payments` insert MUST atomically create a matching physical-cash entry in `cash_transactions`.

The system preserves two separate records:

```text
custom_order_payments  → customer-facing payment record (advance / due)
cash_transactions      → physical shop cash ledger
```

Linking fields on the cash row:

```text
transaction_type = CASH_IN
reference_type   = CUSTOM_ORDER_PAYMENT
reference_id     = custom_order_payments.id
amount           = custom_order_payments.amount
```

See §57 for the transactional flow.

If a future payment method is added (e.g. bKash) the `custom_order_payments` row is still created, but the matching cash row should be SKIPPED — only cash that actually entered the shop drawer becomes a `cash_transactions` entry.

---

# 41. Cash Opening/Closing Model

Recommended daily flow:

```text
Previous Closing Cash
          ↓
Next Day Opening Cash  (DERIVED, not inserted)
          ↓
Cash In / Sales
          ↓
Cash Out
          ↓
Closing Calculation
```

**Rule:** the system does NOT insert a new `cash_transactions` row with `transaction_type = OPENING` for each new day.

- `OPENING` is reserved for the **one-time initial seed** when the system is first bootstrapped.
- The opening cash for every subsequent day is **derived** from the previous day’s closing cash, calculated as:

```text
Daily Opening = SUM(CASH_IN + OPENING) - SUM(CASH_OUT) + SUM(CASH_ADJUSTMENT) for the previous business day
```

See §43 (Current Cash Calculation) for the exact formula and §44 (Dashboard Queries) for daily cash position views.

---

# 42. Physical Cash Reconciliation

The Owner should be able to record:

```text
Expected Cash
Physical Cash
Difference
```

The physical count itself can be represented by a cash adjustment/reconciliation mechanism.

A future dedicated reconciliation table can be added if the business later requires detailed audit history for every physical count.

---

# 43. Current Cash Calculation

Current cash should not be stored as a manually editable value.

It should be calculated from the ledger.

Conceptually:

```text
Current Cash =
SUM(all applicable cash_transactions)
```

This prevents multiple sources of truth.

---

# 44. Dashboard Queries

Dashboard values should be derived from transactional data.

## Today's Sales

```text
SUM(sales.total_amount)
WHERE sale_date = today
AND status = COMPLETED
```

## Today's Custom Orders

```text
COUNT(custom_orders)
WHERE order_date = today
```

## Current Cash

```text
SUM(cash_transactions)
```

## Total Stock Items

```text
SUM(products.stock_quantity)
WHERE status = ACTIVE
```

---

# 45. Customer Purchase History

Customer history is derived through relationships:

```text
customers
   ↓
sales
   ↓
sale_items
   ↓
products
```

and:

```text
customers
   ↓
custom_orders
   ↓
custom_order_payments
```

The system does not need a separate:

```text
customer_purchase_history
```

table.

---

# 46. Child Purchase Association

Normal sales do not require a child ID.

The customer account owns the purchase history.

Therefore:

```text
Sale
  ↓
Customer
```

not:

```text
Sale
  ↓
Child
```

This matches the requirement that the parent/father/mother account should contain the overall purchase history regardless of which child the product was intended for.

---

# 47. School Storage

School is stored directly on:

```text
children.school_name
```

There is no:

```text
schools
```

table in V1.

This avoids unnecessary complexity because the shop does not require school-level product management.

---

# 48. Product Type/Size/Colour

No separate tables:

```text
product_types
product_sizes
product_colors
```

are required.

Instead:

```text
products.name
```

contains the complete product identity.

Example:

```text
Navy Blue Pant - XXL
```

---

# 49. Discounts

No discount columns or discount tables are required.

Do not create:

```text
discount
discount_amount
discount_percentage
```

in V1.

---

# 50. Payment Method

No payment-method table or mandatory payment-method column is required in V1.

The current system focuses on:

* Amount
* Payment history
* Due

rather than payment-method tracking.

---

# 51. Recommended Indexes

Indexes should be added to fields frequently used for searching/filtering.

## Customers

```text
customers.customer_code
customers.phone
customers.name
```

## Children

```text
children.customer_id
children.school_name
```

## Products

```text
products.product_code
products.name
products.status
```

## Sales

```text
sales.sales_code
sales.customer_id
sales.sale_date
sales.status
```

## Sale Items

```text
sale_items.sale_id
sale_items.product_id
```

## Custom Orders

```text
custom_orders.order_code
custom_orders.customer_id
custom_orders.order_date
custom_orders.status
custom_orders.expected_delivery_date
```

## Custom Order Payments

```text
custom_order_payments.custom_order_id
custom_order_payments.payment_date
```

## Suppliers

```text
suppliers.supplier_code
suppliers.name
suppliers.phone
```

## Purchases

```text
purchases.purchase_code
purchases.supplier_id
purchases.purchase_date
```

## Supplier Payments

```text
supplier_payments.supplier_id
supplier_payments.payment_date
```

## Expenses

```text
expenses.expense_category_id
expenses.expense_date
```

## Cash

```text
cash_transactions.transaction_date
cash_transactions.transaction_type
```

---

# 52. Monetary Data Type

Never use floating-point types for money.

Do NOT use:

```text
FLOAT
REAL
DOUBLE
```

Use:

```text
NUMERIC(12,2)
```

Example:

```text
2500.00
```

---

# 53. Quantity Data Types

Finished products are piece-based:

```text
INTEGER
```

Raw materials and supplier purchase quantities may use:

```text
NUMERIC(12,2)
```

because the current requirements do not enforce a specific unit model.

---

# 54. Foreign Key Delete Policy

Historical records must be protected.

Recommended:

```text
ON DELETE RESTRICT
```

for important transactional relationships.

Example:

A product with historical sales should not be deletable.

A customer with historical sales should not be deletable.

A supplier with historical purchases should not be deletable.

---

# 55. Soft Deletion

Use status fields rather than physical deletion for:

* Customers
* Products
* Suppliers
* Users

Example:

```text
status = INACTIVE
```

Historical transactions remain intact.

---

# 56. Transaction Safety

The following operations must use database transactions.

## Sale Creation

```text
BEGIN

Create sale
Create sale items
Validate stock
Update stock
Create cash transaction

COMMIT
```

If any step fails:

```text
ROLLBACK
```

---

# 57. Custom Order Payment

Payment creation must be transactional.

```text
BEGIN

Validate order
Validate payment amount (must be > 0)
Create custom_order_payments row
Create matching cash_transactions row:
  transaction_type = CASH_IN
  reference_type   = CUSTOM_ORDER_PAYMENT
  reference_id     = new payment id
  amount           = payment amount
  created_by       = actor user id
Calculate resulting due

COMMIT
```

Guarantees:

```text
payment row       <=>  matching CASH_IN row (same amount, same reference_id)
due                >=  0  (payment amount must not exceed remaining due)
custom_order.status   advances correctly when due reaches 0
```

If the payment method is non-cash (e.g. future bKash support), the `custom_order_payments` row is still inserted, but the cash row MUST be skipped — only physical cash that entered the drawer becomes a `cash_transactions` entry.

---

# 58. Supplier Payment

```text
BEGIN

Validate supplier
Validate amount
Create supplier payment

COMMIT
```

No cash transaction should be created automatically.

---

# 59. Stock Adjustment

```text
BEGIN

Validate Owner
Validate product
Validate quantity
Update stock
Create adjustment history

COMMIT
```

---

# 60. Auditability

The database should preserve who performed important operations.

At minimum, these tables should have:

```text
created_by
```

where appropriate:

```text
updated_by
```

This is particularly important for:

* Sales
* Custom orders
* Payments
* Purchases
* Expenses
* Stock adjustments
* Cash transactions

---

# 61. Profit Query Strategy

Profit should be calculated dynamically.

For a sale item:

```text
profit =
(selling_price - product.purchase_price)
× quantity
```

But only when:

```text
product.purchase_price IS NOT NULL
```

If any required purchase cost is missing, the system must not present a misleading profit value.

---

# 62. Historical Purchase Price Consideration

For V1, product purchase price is stored on the product.

However, this introduces an important historical-data issue:

If the Owner changes:

```text
products.purchase_price
```

later, historical profit calculations could change.

Therefore, before implementing production profit reports, the system should decide whether the actual purchase cost at the time of sale must be snapshotted into `sale_items`.

### Recommended engineering decision

Add:

```text
purchase_cost_at_sale NUMERIC(12,2) NULL
```

to `sale_items`.

This is populated from the product's purchase price when the sale is created.

Then:

```text
purchase_cost_at_sale = NULL
```

means cost was unavailable.

This makes historical profit stable.

---

# 63. Recommended Final sale_items Structure

```text
sale_items
│
├── id
├── sale_id
├── product_id
├── quantity
├── selling_price
├── purchase_cost_at_sale
├── line_total
└── created_at
```

This is strongly recommended if profit reporting is part of V1.

---

# 64. Due Calculation

## Customer Custom Order

```text
Due =
Order Total
-
Sum of Order Payments
```

## Supplier

```text
Supplier Due =
Sum of Purchase Totals
-
Sum of Supplier Payments
```

Neither due value should be manually editable.

---

# 65. No Separate Due Tables

Do NOT create:

```text
customer_dues
supplier_dues
```

because dues are derived from actual financial transactions.

This avoids duplicated financial state.

---

# 66. No Separate Customer Purchase History Table

Do NOT create:

```text
customer_purchase_history
```

History is derived from:

```text
sales
sale_items
custom_orders
custom_order_payments
```

---

# 67. No Separate Supplier Purchase History Table

Do NOT create:

```text
supplier_purchase_history
```

History is derived from:

```text
purchases
purchase_items
supplier_payments
```

---

# 68. No Separate Stock History Table

`stock_adjustments` handles manual adjustments.

Sales already represent sales-related stock movement.

If future requirements demand a unified inventory ledger, an `inventory_movements` table can be introduced later.

For V1, this is intentionally avoided.

---

# 69. Potential Future Inventory Ledger

Future architecture may introduce:

```text
inventory_movements
```

with:

```text
SALE
PURCHASE
ADJUSTMENT
RETURN
```

However, this is not required for V1.

---

# 70. Final Table List

## Required Core Tables

```text
1. users
2. customers
3. children
4. products
5. sales
6. sale_items
7. custom_orders
8. custom_order_payments
9. suppliers
10. purchases
11. purchase_items
12. supplier_payments
13. raw_materials
14. expense_categories
15. expenses
16. stock_adjustments
17. cash_transactions
18. purchase_receipts
```

### Final V1 Count: 18 tables

---

# 71. Final Relationship Diagram

```text
                         ┌──────────────┐
                         │    users     │
                         └──────┬───────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
           sales           purchases          expenses
              │                 │
              ▼                 ▼
         sale_items       purchase_items
              │                 │
              ▼                 ▼
          products           suppliers
              │                 │
              │                 ├──────────────┐
              │                 │              │
              │                 ▼              ▼
              │          supplier_payments  purchase_receipts
              │
              ▼
      stock_adjustments


customers
   │
   ├───────────────┐
   │               │
   ▼               ▼
children          sales
   │
   │
   └──────────────────────┐
                          ▼
                    custom_orders
                          │
                          ▼
                custom_order_payments


cash_transactions
```

---

# 72. Critical Separation of Domains

The system has four important financial domains.

## A. Customer Sales

```text
customers
   ↓
sales
   ↓
sale_items
```

## B. Customer Custom Orders

```text
customers
   ↓
custom_orders
   ↓
custom_order_payments
```

## C. Supplier Accounting

```text
suppliers
   ↓
purchases
   ↓
purchase_items

suppliers
   ↓
supplier_payments
```

## D. Physical Shop Cash

```text
cash_transactions
```

These domains must not be unnecessarily merged.

---

# 73. Important Implementation Rule

The database should be the source of truth.

Frontend calculations are for display only.

The backend must calculate and validate:

* Sale totals
* Custom-order due
* Supplier due
* Stock changes
* Cash balance
* Profit eligibility

The frontend must never be trusted for financial calculations.

---

# 74. Recommended Backend Service Boundaries

Although this is a database document, the schema should map cleanly to backend services/modules.

Recommended modules:

```text
auth
customers
children
products
sales
custom-orders
suppliers
purchases
supplier-payments
raw-materials
expenses
stock
cash
reports
dashboard
```

---

# 75. Recommended Development Order

Database implementation should follow dependency order.

## Phase 1 — Foundation

```text
users
customers
children
products
```

## Phase 2 — Sales

```text
sales
sale_items
cash_transactions
stock logic
```

## Phase 3 — Custom Orders

```text
custom_orders
custom_order_payments
```

## Phase 4 — Suppliers

```text
suppliers
purchases
purchase_items
supplier_payments
purchase_receipts
```

## Phase 5 — Raw Materials

```text
raw_materials
```

## Phase 6 — Expenses

```text
expense_categories
expenses
```

## Phase 7 — Reports

Build reports using queries/views over existing transactional tables.

Do not create redundant report tables unless performance later requires them.

---

# 76. Database Migration Strategy

The database must be managed through migrations.

Never manually modify production schema without a migration.

Example:

```text
001_create_users
002_create_customers
003_create_children
004_create_products
005_create_sales
006_create_sale_items
007_create_custom_orders
008_create_custom_order_payments
009_create_suppliers
010_create_purchases
011_create_purchase_items
012_create_supplier_payments
013_create_raw_materials
014_create_expense_categories
015_create_expenses
016_create_stock_adjustments
017_create_cash_transactions
018_create_purchase_receipts
```

---

# 77. Seed Data

Development environment should contain seed data for:

### Users

```text
Owner
Employee
```

### Products

Examples:

```text
Blue Shirt - 40
Navy Blue Pant - XXL
White Kamiz - 38
Black Shoe - 42
```

### Customers

Example customer with multiple children.

### Suppliers

At least a few sample suppliers.

### Expense Categories

Example categories.

Production data must never be seeded into production automatically.

---

# 78. Data Validation at Database Level

Where possible, enforce constraints at database level.

Examples:

```text
quantity > 0
amount > 0
total_price >= 0
purchase_price >= 0
selling_price >= 0
```

Also enforce:

```text
NOT NULL
UNIQUE
FOREIGN KEY
CHECK
```

where appropriate.

Business rules that require multiple records must still be enforced by backend transactions.

---

# 79. Security Requirements

Sensitive fields must never be unnecessarily exposed.

Especially:

```text
users.password_hash
products.purchase_price
```

Employee API responses must exclude Owner-only financial information.

Authorization must be enforced on backend routes.

Example:

```text
GET /reports/*
→ OWNER only
```

---

# 80. Final Architecture Decision

The database intentionally avoids excessive normalization.

For example, this is NOT required:

```text
products
   ↓
product_types
   ↓
product_sizes
   ↓
product_colors
   ↓
schools
```

Instead:

```text
products
   └── name = "Navy Blue Pant - XXL"
```

This matches the actual business workflow and keeps V1 simple.

---

# 81. Final Database Philosophy

The database should follow one central principle:

> **Store facts once, derive information whenever possible, and preserve historical transactions.**

Therefore:

```text
Customer Due
→ derived

Supplier Due
→ derived

Current Cash
→ derived

Current Child Class
→ derived

Profit
→ derived

Customer Purchase History
→ derived

Supplier Purchase History
→ derived
```

while actual business events are stored:

```text
Sale
Payment
Purchase
Expense
Stock Adjustment
Cash Transaction
```

This keeps the database consistent and minimizes duplicate state.

---

# 82. V1 Final Decision Summary

```text
Database:
PostgreSQL

Total Tables:
18

User Roles:
OWNER
EMPLOYEE

Customer:
One account per customer

Children:
Multiple children per customer

Child Class:
Automatically calculated yearly

Product:
Finished product only

Product Identity:
Single product name

Selling Price:
Entered per sale

Purchase Price:
Optional, Owner only

Normal Sale:
Fully paid

Custom Order:
Partial payment allowed

Customer Due:
Custom orders only

Supplier Due:
Supported

Supplier Payment:
Separate from cash

Expenses:
Separate from cash

Raw Materials:
Separate from finished products

Production:
Not tracked

Stock:
Piece-based for finished products

Stock Adjustment:
Owner only + mandatory reason

Customer Delete:
Not allowed

Product Delete:
Use inactive status

Supplier Delete:
Use inactive status

Reports:
Owner only

Profit:
Optional and only when required purchase cost exists

Physical Receipt:
Handled manually

Sales ID:
Written on physical receipt and searchable later
```

**End of DATABASE_PLAN.md**
