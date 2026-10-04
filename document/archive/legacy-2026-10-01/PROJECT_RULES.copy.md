> ARCHIVED on 2026-10-01. Historical reference only; this file is not an active specification.
> Read [the active documentation index](../../README.md) before using any rule or completion claim below.

# NI Fashion — PROJECT_RULES.md

**Project:** NI Fashion Shop Management System
**Document Type:** Engineering Rules & Project Constitution
**Version:** 1.0
**Status:** Active

---

# 1. Project Overview

NI Fashion is a school and college dress shop.

The shop sells products such as:

* Shirt
* Pant
* Selwar
* Kamiz
* Orna
* Frock
* Shoe
* Bag
* Other accessories

NI Fashion also produces some of its own clothing products.

The application is an **internal shop management system**, not an e-commerce marketplace.

The primary purpose of the system is to manage:

* Daily sales
* Finished-product inventory
* Customer information
* Customer children information
* Customer purchase history
* Custom orders
* Custom-order payments
* Suppliers
* Purchases
* Supplier dues
* Supplier payment history
* Supplier receipt proofs
* Raw-material records
* Expenses
* Cash management
* Reports
* Optional profit calculation

---

# 2. Core Engineering Principle

The primary engineering principle is:

> **Keep the system simple, reliable, maintainable, secure, and aligned with the actual business workflow.**

The developer or AI coding agent must not introduce unnecessary complexity.

Do not add features simply because they are technically possible.

Do not create business rules that have not been requested.

If a requirement is unclear, do not silently invent an assumption that can affect business logic.

---

# 3. Source of Truth

The following files are the project's primary sources of truth:

```text
PROJECT_RULES.md
REQUIREMENTS.md
DATABASE_PLAN.md
```

When there is a conflict, use this priority:

```text
1. Explicit client/user requirement
2. PROJECT_RULES.md
3. REQUIREMENTS.md
4. DATABASE_PLAN.md
5. Existing implementation
6. Developer assumption
```

The developer must never override an explicit business requirement with a personal assumption.

---

# 4. Technology Stack

## Frontend

The planned frontend stack is:

* React
* Vite
* JavaScript
* Responsive CSS / Tailwind CSS

TypeScript must not be introduced unless explicitly requested later.

---

## Backend

The planned backend stack is:

* Node.js
* Express.js
* JavaScript

---

## Database

The planned database is:

* PostgreSQL

---

## ORM

The planned ORM is:

* Prisma

---

## Authentication

Authentication will use:

* JWT
* Secure password hashing

---

## Version Control

Use:

* Git
* GitHub

---

# 5. Application Type

The application is a:

> **Mobile-first responsive web application.**

The primary users will use the system from mobile phones.

The application must also work properly on:

* Desktop
* Laptop
* Tablet

The UI must not require a desktop-sized screen for normal shop operations.

---

# 6. User Roles

The system has exactly two application roles:

```text
OWNER
EMPLOYEE
```

There is no separate `ADMIN` role.

Do not introduce an ADMIN role unless explicitly requested.

---

# 7. OWNER Permissions

The Owner has full access to the system.

The Owner can:

* Access the dashboard
* Create sales
* View sales
* Edit sales
* Cancel sales
* Manage customers
* Manage children
* Manage products
* Inactivate products
* View inventory
* Adjust stock
* Manage suppliers
* Create purchases
* View purchases
* Record supplier payments
* Upload supplier receipt images
* Manage raw materials
* Manage expenses
* Manage cash
* View reports
* View optional profit information
* Manage employees/users

---

# 8. EMPLOYEE Permissions

Employees have intentionally limited access.

Employees can:

* Log in
* Create sales
* View sales
* View sale details
* Search customers
* Create customers
* Edit permitted customer information
* View customer basic information
* View customer children information
* Work with the permitted custom-order workflow

Employees cannot:

* View purchase costs
* View profit
* View supplier information
* View supplier dues
* View supplier payments
* View expenses
* Add expenses
* View reports
* Manage products
* Delete products
* Inactivate products
* Adjust stock
* Manage cash
* View current cash
* Edit sales
* Cancel sales

---

# 9. Authorization Rule

Hiding buttons in the frontend is **not** sufficient for authorization.

All protected operations must also be enforced on the backend.

For example:

```text
Employee → /api/reports
→ 403 Forbidden

Employee → /api/suppliers
→ 403 Forbidden

Employee → /api/expenses
→ 403 Forbidden

Employee → purchase-cost data
→ Forbidden / filtered response
```

The backend must never rely on frontend restrictions for security.

---

# 10. Customer Rules

Each customer has a single account.

Customer information includes:

* Auto-generated Customer ID
* Name
* Phone number
* Address (optional)
* Notes (optional)
* Created date
* Active/Inactive status
* `created_by` (user id of the creator)
* `updated_by` (user id of the last editor, where applicable)

Customer deletion is not allowed.

Customers may be marked inactive.

Historical records must remain available even if a customer becomes inactive.

Because employees are allowed to create customers, the system MUST persist `created_by` (and `updated_by` where relevant) to retain who created the record.

---

# 11. Customer Identity Rule

A customer must have one unified account.

If the same parent purchases products for multiple children, all purchases remain under the same customer account.

The system does not need to associate a normal sale with a specific child.

Example:

```text
Customer: Rahim
Children:
- Child A
- Child B
- Child C

Purchases:
- Shirt
- Pant
- Shoe
- Bag
```

All purchases belong to Rahim's customer history.

---

# 12. Children Rules

A customer can have multiple children.

The expected number is approximately:

```text
1–4 children
```

Each child can have:

* Name
* Class
* School
* Notes
* Created date
* `created_by` (user id of the creator)
* `updated_by` (user id of the last editor, where applicable)

Roll number is not required.

Do not add a roll-number field.

Because employees are allowed to create children, the system MUST persist `created_by` (and `updated_by` where relevant) to retain who created the record.

---

# 13. Automatic Class Promotion

When a child is created, the system must save:

* Initial class
* Child creation date

Example:

```text
Created: 01 Sep 2026
Class: 5
```

The system should calculate:

```text
01 Sep 2027 → Class 6
01 Sep 2028 → Class 7
01 Sep 2029 → Class 8
```

The class increases by one every year based on the child's creation date.

There is no separate rule for Class 11 or Class 12.

The same yearly increment rule continues.

The system should prefer calculating the current class from the original class and creation date rather than requiring unnecessary scheduled background jobs.

---

# 14. School Rule

School information belongs to the child.

School must **not** be associated with products.

Correct:

```text
Child → School
```

Incorrect:

```text
Product → School
```

There must not be separate product databases for different schools.

---

# 15. Product Rules

Each finished product has:

* Product ID
* Product Name
* Purchase Price (optional)
* Notes
* Active/Inactive status
* Inventory information

Product ID must be generated by the system.

---

# 16. Product Naming Rule

Product type, size, and colour do not need to be separate mandatory database columns.

The product name itself can contain these details.

Examples:

```text
Navy Blue Pant - XXL
Blue Shirt - 40
White Shirt - 38
Black Shoe - 42
```

The system must support searching products by:

* Product name
* Product ID

---

# 17. Selling Price Rule

Products do **not** have a default selling price.

Whenever a product is sold, the employee or owner manually enters the selling price.

Example:

```text
Product:
Blue Shirt - 40

Selling Price:
৳750
```

The same product may be sold at different prices in different sales.

The system must never automatically apply a default selling price.

---

# 18. Purchase Price Rule

Purchase price is optional.

Only the Owner can:

* Enter purchase price
* View purchase price
* Use purchase price for profit calculation

Employees must not be able to view purchase cost.

If purchase price is missing, the system must not invent one.

Do not use:

* Average cost
* Estimated cost
* Raw-material cost
* Expense allocation

unless explicitly requested later.

---

# 19. Profit Rules

Profit calculation is optional.

The Owner may choose to view profit.

Profit must be calculated only from manually entered product purchase prices.

If the purchase price is missing, profit must not be displayed as a calculated value.

Example:

```text
Selling Price = ৳800
Purchase Price = ৳500

Profit = ৳300
```

If:

```text
Purchase Price = NULL
```

then:

```text
Profit = Unavailable
```

Do not estimate the profit.

Raw-material costs and general expenses must not automatically be included in product profit.

---

# 20. Finished Product Inventory

Finished products are tracked piece-by-piece.

Example:

```text
Blue Shirt - 40
Current Stock: 25 pcs
```

Stock can change through:

* Initial stock entry (recorded as a stock adjustment — see §21.1)
* Sales
* Manual stock adjustment

There is no separate inventory movement / inventory ledger table in V1.

## 20.1 Initial Stock

Initial finished-product stock MUST be entered by the Owner through a stock adjustment with a mandatory reason such as:

```text
Opening Stock
```

Example:

```text
Product: Blue Shirt - 40
Adjustment: +50
Reason: Opening Stock
```

This guarantees that the audit trail (`stock_adjustments`) covers the very first stock entry and that no historical stock movement is silently lost.

---

# 21. Stock Adjustment

Only the Owner can adjust stock.

Stock adjustment requires:

* Product
* Quantity change
* Reason
* Date

Reason is mandatory.

Example:

```text
Product:
Blue Shirt - 40

Adjustment:
-2

Reason:
Product problem
```

There is no separate damage-product module in V1.

There is no separate lost-product module in V1.

Stock removal should be handled through stock adjustment.

---

# 22. Stock History

The system must maintain stock history.

Relevant stock movements include:

* Initial stock
* Sale
* Manual adjustment

The system should be able to determine how current stock was reached.

Current stock should not be maintained through uncontrolled manual overwrites when transaction-based tracking can preserve the history.

---

# 23. Normal Sales

Normal/direct sales are fully paid.

Normal sales do not have customer credit/due.

Example:

```text
Customer buys:
2 Shirts
1 Pant

Total:
৳2,500

Payment:
৳2,500
```

The normal sale is completed immediately.

Customer due is not supported for normal sales.

---

# 24. Sale Items

A sale can contain multiple products.

Therefore sales and sale items must be separate concepts.

Example:

```text
Sale:
SALE-00125

Items:
- Blue Shirt - 40 × 2
- Navy Pant - XXL × 1
- Bag × 1
```

Each sale item references a product.

---

# 25. Duplicate Product Selection Rule

Within a single sale, the same product cannot appear as multiple separate line items.

Incorrect:

```text
Blue Shirt - 40 × 1
Blue Shirt - 40 × 2
```

Correct:

```text
Blue Shirt - 40 × 3
```

If the employee selects an already selected product, the system should update the existing item's quantity instead of creating a duplicate line.

---

# 26. Sale Search

Sales must be searchable using:

```text
Sales ID
```

A physical receipt is manually written by the shop.

The system-generated Sales ID can be written on the physical receipt.

Later, the employee/owner can search the Sales ID in the system to retrieve the sale history.

---

# 27. Sale Editing

Only the Owner can:

* Edit a sale
* Cancel a sale

Employees cannot edit or cancel completed sales.

If a sale is cancelled, inventory and related records must remain consistent.

Historical records must not be silently deleted.

---

# 28. Custom Orders

Custom orders are a separate business workflow from normal sales.

Custom orders are created when the required product is unavailable or needs to be specially prepared.

A customer can pay an advance.

Example:

```text
Total Price = ৳2,500
Advance = ৳500
Due = ৳2,000
```

The remaining amount is paid when the customer receives the dress.

### 28.1 Custom Order Payment and Cash

Custom-order customer payments are **real shop cash inflows**.

Therefore, whenever a `custom_order_payment` is created, the system MUST automatically create a corresponding `CASH_IN` transaction in the **same database transaction**.

This rule applies **only** to custom-order customer payments.

Supplier payments and expenses remain completely independent from cash transactions and MUST NOT auto-create any cash transaction.

---

# 29. Custom Order Fields

Custom orders contain:

* Order ID
* Customer
* Product
* Description
* Quantity
* Total Price
* Advance
* Due
* Expected Delivery Date
* Order Date
* Delivery Date
* Notes
* Status

Measurement-specific fields are not required.

Measurement information can be stored inside:

* Description
* Notes

---

# 30. Custom Order Status

Only these statuses are allowed:

```text
PENDING
READY
DELIVERED
CANCELLED
```

The backend/database stores these values in **uppercase**.

The frontend may display them as:

```text
Pending
Ready
Delivered
Cancelled
```

Do not introduce additional statuses without a new requirement.

---

# 31. Custom Order Payments

A custom order can have multiple payments.

Example:

```text
01 Sep → ৳500
05 Sep → ৳1,000
10 Sep → ৳1,000
```

Therefore payment history must be represented separately from the order itself.

The system must be able to calculate:

```text
Total Price
- Total Payments
= Remaining Due
```

---

# 32. Custom Order Stock Rule

Creating or delivering a custom order must not automatically change finished-product inventory in V1.

Production and custom-order manufacturing are outside the current scope.

---

# 33. Customer Due Rule

Normal sales:

```text
Due = Not Allowed
```

Custom orders:

```text
Advance = Allowed
Due = Allowed
```

Customer-level historical debt/credit ledger is not required.

Due is primarily associated with the relevant custom order.

---

# 34. Supplier Rules

Suppliers are separate entities.

Owner can create and manage suppliers.

Supplier information may include:

* Supplier ID
* Name
* Phone
* Address
* Notes
* Active/Inactive status
* Current due

Historical supplier records must be preserved.

---

# 35. Purchase Rules

A purchase can contain multiple items.

Example:

```text
Purchase #001

Supplier:
ABC Store

Items:
- Fabric
- Button
- Thread
```

The purchase must preserve item-level details.

---

# 36. Supplier Due

Purchases from suppliers may be partially paid.

Example:

```text
Purchase Total = ৳20,000
Paid = ৳5,000
Due = ৳15,000
```

The supplier due must be tracked accurately.

---

# 37. Supplier Payment History

Supplier payments must have their own records.

A supplier can receive multiple payments.

Example:

```text
05 Sep → ৳5,000
10 Sep → ৳3,000
```

The supplier's outstanding due must update accordingly.

---

# 38. Critical Rule — Supplier Payment vs Cash

Supplier payment and shop cash management are **two completely independent systems**.

This rule is mandatory.

When a supplier payment is recorded:

```text
Supplier Due ↓
```

But:

```text
Current Shop Cash ↓
```

must NOT happen automatically.

Supplier payments must NOT automatically become Cash Out transactions.

Do not create an automatic financial connection between these two modules.

---

# 39. Supplier Receipt Proof

The Owner can upload images of supplier receipts.

A purchase can contain multiple receipt images.

These images are for:

* Proof
* Reference
* Future verification

The system should support multiple images per purchase.

---

# 40. Purchase Return

Purchase return is not part of V1.

Do not implement purchase returns unless a new requirement explicitly introduces them.

---

# 41. Raw Materials

Raw materials and finished products are completely separate systems.

There is no production tracking in V1.

Do not create relationships such as:

```text
Fabric → Shirt production
Button → Shirt production
```

unless explicitly required later.

---

# 42. Raw Material Fields

Raw material records contain:

* Item Name
* Quantity
* Description
* Date
* Notes
* Purchase Cost (optional)

A unit field is not required.

---

# 43. Raw Material Scope

V1 Raw Material management is intentionally simple.

The system only needs to record raw-material information.

Do not implement:

* Production tracking
* Material consumption
* Manufacturing recipes
* Bill of materials
* Finished-product cost calculation
* Material-to-product relationships

These can be future modules.

---

# 44. Expense Rules

Expenses are Owner-only.

Employees cannot:

* View expenses
* Add expenses
* Edit expenses

Expense records contain:

* Expense category
* Amount
* Date
* Description (optional)
* Notes (optional)

Date is mandatory.

---

# 45. Expense Categories

The Owner can add expense categories.

The system should support custom expense categories.

Do not assume a fixed list of categories is sufficient.

---

# 46. Expense Reports

Expense reporting should support at least:

* Monthly reports

The architecture should allow:

* Daily
* Monthly
* Yearly
* Category-wise

reporting later.

---

# 47. Expense vs Cash

Expense records and cash management are separate.

Creating an expense must NOT automatically reduce the shop's cash balance.

If cash is physically removed from the shop, the Owner must separately record the relevant Cash Out transaction.

---

# 48. Cash Management

Cash management is Owner-only.

The purpose of cash management is:

> To compare the system's expected cash with the shop's physical cash.

The system must maintain a transaction-based cash history.

---

# 49. Opening Cash

At the beginning of a business day:

```text
Previous Day Closing Cash
        ↓
Next Day Opening Cash
```

A new `OPENING` transaction is **NOT** inserted every day. Opening cash is **derived** from the previous day's closing cash.

The `OPENING` transaction type is reserved for the initial cash setup / manual seed only (the very first time the system is started, or when the Owner needs to bootstrap a new cash baseline).

If the Owner needs to correct cash outside of normal in/out transactions, a separate `CASH_ADJUSTMENT` transaction (with a mandatory reason) must be used.

---

# 50. Cash In

The Owner can add cash at any time.

Example:

```text
Owner brings ৳5,000 from home
↓
Cash In
```

Cash In should record:

* Amount
* Date/time
* Reason/note

---

# 51. Cash Out

The Owner can remove physical cash from the shop.

Cash Out requires:

* Amount
* Reason
* Date/time

Reason is mandatory.

Example:

```text
Cash Out:
৳3,000

Reason:
Personal withdrawal
```

---

# 52. Cash and Sales

Cash received from applicable normal sales should increase the system's cash balance.

Cash-related business logic must be implemented on the backend.

The exact transaction creation must be atomic with the relevant sale where applicable.

## 52.1 Cash Transaction Reference Convention

Cash transactions MUST use a small, generic set of transaction types plus a reference mechanism, rather than a new transaction type per cash source.

Recommended types:

```text
OPENING         → reserved for initial cash seed only
CASH_IN         → any cash inflow (positive)
CASH_OUT        → any cash outflow (negative)
CASH_ADJUSTMENT → signed correction with mandatory reason
```

Each `CASH_IN` / `CASH_OUT` row SHOULD carry:

```text
reference_type
reference_id
```

so the source can be identified without inventing new enum values.

Examples:

```text
CASH_IN + reference_type=SALE                    → automatic on completed sale
CASH_IN + reference_type=CUSTOM_ORDER_PAYMENT    → automatic on custom-order payment
CASH_IN + reference_type=MANUAL                  → Owner-added cash (e.g. brought from home)
CASH_OUT + reference_type=MANUAL                 → Owner-removed cash
```

Critical reminders:

* Supplier payments MUST NOT automatically create any cash transaction.
* Expenses MUST NOT automatically create any cash transaction.

If the Owner wants to reflect a supplier payment or an expense as physical cash leaving the shop, they MUST record a separate `CASH_OUT + reference_type=MANUAL` entry themselves.

---

# 53. Cash Reconciliation

At the end of the day, the Owner should be able to compare:

```text
Expected System Cash
        VS
Physical Cash
```

If there is a mismatch, the Owner can make a separate cash adjustment transaction with a reason.

The system should never silently alter the cash balance.

---

# 54. Reports

Reports are Owner-only.

Employees must not have access to reports.

Reports may include:

### Sales

* Daily sales
* Monthly sales
* Yearly sales
* Product-wise sales
* Quantity sold

### Custom Orders

* Order counts
* Pending orders
* Ready orders
* Delivered orders
* Order payments
* Due

### Purchases

* Daily purchases
* Weekly purchases
* Monthly purchases
* Supplier-wise purchases
* Product/item-wise purchases

### Inventory

* Current stock
* Stock history
* Sold quantity
* Stock adjustments

### Customers

* Purchase history
* Total purchases
* Custom orders

### Suppliers

* Purchase history
* Payment history
* Current due

### Expenses

* Monthly expenses
* Yearly expenses
* Category-wise expenses

### Cash

* Opening cash
* Cash in
* Cash out
* Closing cash

### Profit

Profit is optional and only available when the required purchase-cost information exists.

---

# 55. Dashboard Rules

The dashboard must remain intentionally simple.

It should show only:

```text
Today's Sales
Today's Custom Orders
Current Cash
Total Stock Items
```

Do not add unnecessary analytics or decorative statistics.

---

# 56. Search Rules

## Customer Search

Customer can be searched by:

```text
Customer ID
Name
Phone
```

## Product Search

Product can be searched by:

```text
Product Name
Product ID
```

## Sale Search

Sale can be searched by:

```text
Sales ID
```

## Supplier Search

Supplier can be searched by relevant supplier information such as:

```text
Supplier Name
Phone
```

Search must be fast and simple.

---

# 57. Form Rules

Required and optional fields must be clearly distinguished.

Frontend validation is required for user experience.

Backend validation is mandatory for data integrity.

The backend must never trust frontend validation.

---

# 58. UI/UX Rules

The UI must be:

* Simple
* Clean
* Mobile-first
* Responsive
* Fast
* Easy to understand
* Easy for non-technical shop employees

The most frequently used workflows should require minimal interaction.

The New Sale workflow should be especially optimized for speed.

---

# 59. Loading / Empty / Error States

All data-driven screens should provide:

* Loading state
* Empty state
* Error state

Example:

```text
No customers found.
```

Do not leave blank screens when data is unavailable.

---

# 60. Confirmation Rules

Confirmation should be required before destructive or sensitive operations such as:

* Cancel sale
* Cancel custom order
* Stock adjustment
* Cash out
* Product deactivation
* Customer deactivation

---

# 61. File Upload Rules

Supplier receipt images must support:

* Multiple images
* File-type validation
* File-size validation

Invalid files must be rejected by the backend.

---

# 62. Data Integrity

Important relationships must use database-level foreign keys.

Examples:

```text
sale_items.sale_id → sales.id

sale_items.product_id → products.id

children.customer_id → customers.id
```

Orphaned records must not be created.

---

# 63. Delete Policy

Historical business data must be preserved.

Customer deletion is forbidden.

Products with historical sales should not be hard-deleted.

Instead:

```text
active = false
```

or an equivalent inactive status should be used.

Suppliers with historical purchases should preferably be marked inactive instead of deleted.

---

# 64. Auditability

Business records should contain:

```text
created_at
updated_at
```

Where relevant, records should also contain:

```text
created_by
updated_by
```

This is particularly important for:

* Sales
* Custom orders
* Payments
* Purchases
* Stock adjustments
* Cash transactions

The system should be able to determine which user performed important actions.

---

# 65. Date and Time

The application operates in Bangladesh.

The system must use a consistent timezone strategy.

Database timestamps should be timezone-safe.

User-facing dates/times should be displayed according to Bangladesh local time.

---

# 66. API Design

Backend APIs should be RESTful and predictable.

Suggested structure:

```text
/api/auth
/api/customers
/api/children
/api/products
/api/sales
/api/custom-orders
/api/suppliers
/api/purchases
/api/supplier-payments
/api/raw-materials
/api/expenses
/api/cash
/api/reports
```

API responses should follow a consistent structure.

---

# 67. Error Handling

User-facing errors should be understandable.

Example:

```text
Unable to save the sale. Please try again.
```

Technical details should be logged securely on the server.

Raw database errors must not be exposed directly to users.

---

# 68. Database Transaction Safety

Operations involving multiple related database changes must use database transactions where necessary.

For example:

```text
Create Sale
+
Create Sale Items
+
Update Stock
+
Create Cash Transaction
```

must not result in only some operations succeeding.

Either the entire transaction succeeds or the system rolls it back.

The same principle applies to:

* Custom-order payments
* Supplier payments
* Stock adjustments
* Other financial/stock operations

---

# 69. Business Logic Location

Critical business logic must exist on the backend.

Examples:

```text
Sale total calculation
Stock updates
Customer due calculation
Custom-order payment calculation
Supplier due calculation
Cash calculation
Authorization
```

The frontend may perform calculations for UI convenience, but the backend must independently validate them.

---

# 70. No Hidden Business Logic in Frontend

The frontend must not be the only place where important rules are enforced.

For example, hiding the "Cancel Sale" button from employees is not enough.

The backend must reject the request as well.

---

# 71. Database Migration Rules

Before modifying the database schema:

1. Inspect the current schema
2. Check the requirement
3. Identify affected relationships
4. Create a proper migration
5. Consider existing data
6. Test the migration

Do not destroy production data through careless migrations.

---

# 72. Feature Development Workflow

Every feature should follow:

```text
Requirement
    ↓
Database
    ↓
Backend API
    ↓
Authorization
    ↓
Frontend UI
    ↓
Integration
    ↓
Testing
```

Do not implement the entire application in one giant change.

---

# 73. Recommended Development Order

Use this order:

```text
1. Project Setup
2. Database
3. Authentication
4. Authorization
5. UI Design System
6. Customers
7. Children
8. Products
9. Inventory
10. Sales
11. Custom Orders
12. Suppliers
13. Purchases
14. Supplier Payments
15. Raw Materials
16. Expenses
17. Cash
18. Reports
19. Dashboard
20. Testing
21. Security Review
22. Deployment
```

---

# 74. Module Completion Rule

A module is not considered complete until:

* Database is implemented
* Backend API works
* Authorization works
* Validation works
* Frontend works
* Mobile responsive UI works
* Loading state exists
* Empty state exists
* Error handling exists
* Relevant tests pass
* Existing features still work

---

# 75. Regression Testing

Every new module must be checked against existing modules.

Example:

If Sales are changed, verify:

```text
Sales
↓
Inventory
↓
Customer History
↓
Dashboard
↓
Cash
```

still work correctly.

---

# 76. No Overengineering

This project should remain a simple maintainable monolithic application.

Do not introduce unnecessary technologies such as:

* Microservices
* Kafka
* Kubernetes
* GraphQL
* Redis
* Complex event-driven architecture
* Complex distributed systems

unless a future requirement genuinely requires them.

A well-structured Node.js + Express backend is sufficient.

---

# 77. Code Quality

Code should be:

* Readable
* Modular
* Consistent
* Reusable
* Easy to debug
* Easy to extend

Avoid:

* Massive files
* Duplicate logic
* Copy-paste components
* Hardcoded business rules
* Unnecessary abstractions

---

# 78. Environment Variables

Never hardcode:

* Database credentials
* JWT secrets
* API keys
* Cloud storage credentials
* Production secrets

Use environment variables.

Example:

```text
DATABASE_URL
JWT_SECRET
```

Never commit `.env` files containing secrets.

---

# 79. AI Coding Agent Rules

When an AI coding agent works on this project, it must:

### Before coding

1. Read `PROJECT_RULES.md`
2. Read the relevant section of `REQUIREMENTS.md`
3. Read the relevant section of `DATABASE_PLAN.md`
4. Inspect the existing project structure
5. Inspect related existing code
6. Identify dependencies and affected modules

### Before modifying architecture

Explain why the change is necessary.

### During implementation

* Make small changes
* Follow existing architecture
* Reuse existing components
* Follow existing naming conventions
* Preserve business rules
* Add validation
* Add error handling
* Maintain authorization

### After implementation

* Run tests
* Run linting if configured
* Check database migrations
* Check API behavior
* Check responsive UI
* Check existing features for regression
* Summarize changed files
* Mention remaining issues

---

# 80. AI Agent Must Not Do These Things

The AI agent must NOT:

* Invent business requirements
* Add unnecessary features
* Add an ADMIN role
* Add default selling prices
* Add school-to-product relationships
* Add customer credit for normal sales
* Connect supplier payments automatically to cash
* Connect expenses automatically to cash
* Connect raw materials to production
* Add product returns without requirement
* Add purchase returns without requirement
* Add roll numbers to children
* Add unnecessary product type/size/colour columns
* Estimate missing purchase prices
* Estimate missing profit
* Delete historical business data
* Rewrite the entire project unnecessarily
* Replace the existing architecture without approval

---

# 81. Future Feature Policy

The following features are intentionally outside V1:

```text
Product Return
Purchase Return
Production Tracking
Raw Material Consumption
Bill of Materials
School-wise Product Database
Default Selling Price
Customer Credit System
Damage/Lost Product Module
Advanced Accounting
Automatic Supplier-Payment → Cash integration
Automatic Expense → Cash integration
Measurement Management
```

If any of these are required later, they must be introduced as explicit new requirements.

---

# 82. Backward Compatibility

When adding a new feature, existing business workflows should continue to work.

New features should not break:

* Existing sales
* Customer history
* Inventory
* Custom orders
* Supplier records
* Cash records
* Reports

Database changes must consider historical data.

---

# 83. Performance Principles

The application should remain fast on normal shop hardware and mobile internet.

Avoid unnecessary:

* API requests
* Database queries
* Large payloads
* Full-table reloads
* Duplicate requests

Use pagination for large historical datasets where appropriate.

Search should use proper database queries rather than loading the entire database into the browser.

---

# 84. Security Principles

The application must follow basic production security practices:

* Password hashing
* JWT validation
* Role-based authorization
* Input validation
* SQL injection protection through Prisma/parameterized queries
* Secure environment variables
* CORS configuration
* File upload validation
* Rate limiting where appropriate
* Secure error handling

---

# 85. Definition of Done

A feature is officially **Done** only when:

```text
Requirement satisfied
        +
Database correct
        +
API correct
        +
Authorization correct
        +
Validation correct
        +
UI complete
        +
Mobile responsive
        +
Error handling
        +
Testing
        +
Regression check
```

---

# 86. Final Engineering Directive

The NI Fashion application should be built as a **practical business tool**, not as a demonstration of unnecessary technical complexity.

Every technical decision should support one or more of these goals:

```text
Correctness
Security
Simplicity
Maintainability
Reliability
Good User Experience
```

When a choice exists between a complicated solution and a simpler solution that satisfies the requirements equally well, choose the simpler solution.

When requirements are unclear, **do not guess silently**.

When requirements change, update the relevant documentation before making large architectural changes.

The system must preserve historical business data and maintain financial and inventory consistency.

**The AI coding agent must treat this document as a project constitution and follow it throughout development.**

---

# 87. Resolved Cross-Document Decisions

The following decisions resolve conflicts identified during cross-document review. They are binding for V1 and override any conflicting wording in `REQUIREMENTS.md` or `DATABASE_PLAN.md` (per the priority in §3).

### D1. Custom-Order Payment → Cash

Every `custom_order_payments` insert MUST atomically create a matching `cash_transactions` row with `transaction_type = CASH_IN`, `reference_type = CUSTOM_ORDER_PAYMENT`, and `reference_id` pointing to the payment row. Supplier payments and expenses remain completely independent from cash.

### D2. Status Enum Casing

The backend stores status values in uppercase:

```text
PENDING
READY
DELIVERED
CANCELLED
```

The frontend may display them in Title-case (`Pending`, `Ready`, `Delivered`, `Cancelled`) via a centralized display helper.

### D3. Child Class

The database stores `initial_class` and `created_at`. The current class is derived on display as:

```text
current_class = initial_class + floor((today - created_at) / 1 year)
```

The class must not be manually updated each year.

### D4. Employee Sales Access

Employees may **view and search** sales history (including search by Sales ID / Sales Code). Employees cannot edit or cancel a completed sale. Employees must not see purchase cost or profit.

### D5. Initial Stock

There is no separate `inventory_movements` table in V1. Initial finished-product stock is recorded by the Owner as a `stock_adjustments` row with a positive `quantity_change` and a mandatory `reason` of `"Opening Stock"`.

### D6. Customer & Child Audit Columns

`customers` and `children` MUST include `created_by` (required) and `updated_by` (nullable). Employees can create customers and children, so the audit columns are mandatory at insert time.

### D7. Opening Cash

The system does NOT insert a new `OPENING` cash transaction every day. The opening cash for each day is **derived** from the previous day's closing cash. The `OPENING` transaction type is reserved for the one-time initial cash seed / manual correction.

### D8. Custom Order Notes

The `notes` field is kept on `custom_orders`. No conflict.

### D9. Cash Transaction Reference Convention

Use generic `CASH_IN` / `CASH_OUT` / `CASH_ADJUSTMENT` transaction types plus a `reference_type` + `reference_id` mechanism rather than inventing new enum values per cash source. Supplier payments and expenses MUST NOT automatically create cash transactions.

Reference convention:

```text
CASH_IN + reference_type = SALE                  (automatic on completed sale)
CASH_IN + reference_type = CUSTOM_ORDER_PAYMENT  (automatic on custom-order payment)
CASH_IN + reference_type = MANUAL                (Owner-added cash)
CASH_OUT + reference_type = MANUAL               (Owner cash out)
CASH_ADJUSTMENT + reference_type = RECONCILIATION (reconciliation correction)
```

---

# End of PROJECT_RULES.md
