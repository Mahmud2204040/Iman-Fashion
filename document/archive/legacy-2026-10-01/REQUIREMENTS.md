> ARCHIVED on 2026-10-01. Historical reference only; this file is not an active specification.
> Read [the active documentation index](../../README.md) before using any rule or completion claim below.

# NI Fashion — REQUIREMENTS.md

**Project:** NI Fashion Shop Management System
**Document Type:** Software Requirements Specification
**Version:** 1.0
**Status:** Active
**Primary Users:** Owner, Employee
**Platform:** Responsive Web Application

---

# 1. Introduction

## 1.1 Purpose

NI Fashion is a school and college dress shop that sells ready-made and self-produced clothing products as well as accessories.

The purpose of this application is to digitize the shop's internal business records and replace or reduce dependency on manual notebooks and spreadsheets.

The system will manage:

* Finished-product inventory
* Daily sales
* Customer information
* Customer children information
* Customer purchase history
* Custom dress orders
* Custom-order payments
* Supplier information
* Purchases from suppliers
* Supplier dues
* Supplier payment history
* Supplier receipt proofs
* Raw-material records
* Expenses
* Physical cash tracking
* Business reports
* Optional profit calculation

The system is **not** intended to be an online shopping/e-commerce application.

---

# 2. Business Background

NI Fashion sells school and college clothing, including but not limited to:

* Shirt
* Pant
* Selwar
* Kamiz
* Orna
* Frock
* Shoe
* Bag
* Other accessories

Some clothing products are manufactured by NI Fashion itself.

The shop also purchases raw materials such as:

* Fabric
* Button
* Thread
* Other materials

The shop currently maintains many records manually.

The application will provide a centralized system for maintaining these records.

---

# 3. Goals

The system should allow the Owner to answer questions such as:

* How much did the shop sell today?
* What products were sold today?
* How many pieces of a product have been sold?
* How much finished-product stock is currently available?
* What did a particular customer purchase?
* What are the customer's children and their current classes?
* Which custom orders are pending?
* How much advance has been collected for an order?
* How much is still due for an order?
* What was purchased from a particular supplier?
* How much does a supplier currently have due?
* What payments have been made to a supplier?
* What raw materials were purchased?
* How much was spent on expenses?
* How much cash should currently be physically available?
* Does physical cash match the system's expected cash?
* What were the monthly/yearly sales and expenses?
* What is the calculated profit when purchase-cost information is available?

---

# 4. User Roles

The application has two roles.

## 4.1 Owner

The Owner has full access.

The Owner can:

* View dashboard
* Create sales
* View sales
* Edit sales
* Cancel sales
* Manage customers
* Manage children
* Manage products
* Adjust stock
* Manage suppliers
* Manage purchases
* Record supplier payments
* Upload supplier receipt images
* Manage raw materials
* Manage expenses
* Manage cash
* View reports
* View purchase costs
* View profit
* Manage employees/users

---

## 4.2 Employee

Employees have restricted access.

Employees can:

* Log in
* Create sales
* View sales
* Search sales (including by Sales ID / Sales Code)
* Search customers
* Create customers
* Edit permitted customer information
* View customer basic information
* Add children for an existing customer
* Edit permitted children information
* View children information
* Work with the custom-order workflow

Employees cannot:

* Edit sales
* Cancel sales
* View purchase costs
* View profit
* View reports
* View expenses
* Add expenses
* Manage suppliers
* View supplier dues
* View supplier payment history
* Manage products
* Delete/deactivate products
* Adjust stock
* Manage cash

---

# 5. Authentication

Users must authenticate before accessing the application.

The system must support:

* Login
* Logout
* Secure password storage
* Role-based authorization

The backend must enforce role permissions.

Frontend restrictions alone are not sufficient.

---

# 6. Dashboard

The dashboard is intentionally minimal.

It must display exactly these primary metrics:

### 6.1 Today's Sales

Total sales amount for the current business day.

### 6.2 Today's Custom Orders

Number of custom orders created for the current day.

### 6.3 Current Cash

Current expected physical cash according to the cash ledger.

### 6.4 Total Stock Items

Current quantity of finished products in inventory.

No additional dashboard analytics are required for V1.

---

# 7. Customer Management

## 7.1 Customer Creation

A customer can be created:

1. During a sale
2. During a custom order
3. Manually from the Customer section

This is necessary because NI Fashion already has historical customer information in physical notebooks.

The shop should be able to gradually migrate those customers into the system.

---

## 7.2 Customer Fields

A customer may contain:

| Field        | Required          |
| ------------ | ----------------- |
| Customer ID  | Auto-generated    |
| Name         | Yes               |
| Phone        | Yes               |
| Address      | No                |
| Notes        | No                |
| Created Date | Automatic         |
| Status       | Automatic/Managed |
| `created_by` | Automatic         |
| `updated_by` | Where applicable  |

Customer ID must be automatically generated.

Because employees are allowed to create customers, the system MUST persist `created_by` (and `updated_by` where relevant) to retain who created the record.

---

## 7.3 Customer Status

Customers cannot be deleted.

A customer can be:

* Active
* Inactive

Inactive customers must remain accessible for historical records.

---

## 7.4 Customer Search

Employees and Owners can search customers using:

* Customer ID
* Name
* Phone

Search should support partial matching where practical.

---

# 8. Customer Children

A customer may have multiple children.

Expected usage:

* 1 child
* 2 children
* 3 children
* 4 children

The database must not artificially limit the number.

---

## 8.1 Child Fields

Each child contains:

| Field            | Required  |
| ---------------- | --------- |
| Name             | Yes       |
| Initial Class    | Yes       |
| School           | Yes       |
| Registered Date  | Yes (defaults to today if left empty during creation) |
| Created Date     | Automatic |
| `created_by`     | Automatic |
| `updated_by`     | Where applicable |

Roll number is not required.

`Initial Class` is the class the child was in at the time of registration.
`Registered Date` is the date the child was registered with the school-uniform shop and is captured explicitly during creation so that the automatic yearly class promotion can be calculated accurately.

`Notes` is **not** a child field. Do not add a child `notes` column.

Because employees are allowed to create children, the system MUST persist `created_by` (and `updated_by` where relevant) to retain who created the record.

---

# 9. Automatic Child Class Update

The system must remember when a child record was created.

The child's class must increase by one every year based on the child creation date.

Example:

```text
Child Created:
01 Sep 2026

Initial Class:
5
```

Then:

```text
01 Sep 2027 → Class 6
01 Sep 2028 → Class 7
01 Sep 2029 → Class 8
```

The same rule continues for higher classes.

There is no separate special rule for Classes 11 and 12.

The system should calculate the current class based on:

```text
Initial Class
+
Number of completed years since child creation
```

The system should not require a manual yearly class update.

---

# 10. School Information

School is associated with the child.

The system does not require:

* School master database
* School-wise product database
* School-wise inventory
* School-wise pricing

Example:

```text
Customer
   └── Child
       ├── Name
       ├── Class
       └── School
```

Products must not be linked to schools.

---

# 11. Product Management

## 11.1 Product Purpose

Products represent finished products available for sale.

Examples:

```text
Blue Shirt - 40
Navy Blue Pant - XXL
White Frock - 32
Black Shoe - 42
```

---

## 11.2 Product Fields

A product must contain:

| Field          | Required       |
| -------------- | -------------- |
| Product ID     | Auto-generated |
| Product Name   | Yes            |
| Purchase Price | No             |
| Notes          | No             |
| Status         | Yes            |
| Created Date   | Automatic      |
| Updated Date   | Automatic      |

---

# 12. Product Identification

Each product must have a unique Product ID.

Employees and Owners can search products by:

* Product Name
* Product ID

---

# 13. Product Attribute Strategy

Product type, size, and colour do not need separate mandatory columns.

The shop prefers storing these details in the product name.

Example:

```text
Navy Blue Pant - XXL
Blue Shirt - 40
White Shirt - 38
Black Shoe - 42
```

The system must treat the complete product name as the product identity.

---

# 14. Product Selling Price

Products must not have a default selling price.

The selling price is entered manually every time a product is sold.

Example:

```text
Product:
Blue Shirt - 40

Selling Price:
৳750
```

The same product may be sold at different prices in different sales.

The system must not automatically reuse a previous selling price.

---

# 15. Product Purchase Price

Purchase price is optional.

Only the Owner can:

* Enter purchase price
* Edit purchase price
* View purchase price

Employees must not see purchase price.

If purchase price is not available, it must remain empty.

The system must never estimate or automatically generate a purchase price.

---

# 16. Finished Product Inventory

Finished-product inventory is piece-based.

Example:

```text
Blue Shirt - 40
Stock = 25 pieces
```

Stock changes through:

* Initial stock entry (recorded as a stock adjustment — see §17.1)
* Sales
* Manual stock adjustments

There is no separate inventory movement / inventory ledger table in V1.

## 16.1 Initial Stock

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

# 17. Stock Adjustment

Only the Owner can perform manual stock adjustments.

A stock adjustment must contain:

* Product
* Quantity change
* Reason
* Date/time

Reason is mandatory.

Example:

```text
Product:
Blue Shirt - 40

Adjustment:
-2 pieces

Reason:
Product problem
```

---

# 18. Damage and Lost Product

A separate damage-product module is not required.

A separate lost-product tracking module is not required.

If a product needs to be removed from inventory, the Owner can use stock adjustment.

---

# 19. Stock History

The system must preserve stock movement history.

The Owner should be able to determine why stock changed.

Stock movement sources include:

* Initial stock (entered as a stock adjustment with `reason = "Opening Stock"`)
* Sales
* Manual adjustments

Historical stock movements must not be silently overwritten.

### 19.1 Initial Stock Entry

There is no separate `inventory_movements` table in V1.

When the system is bootstrapped, the Owner records the initial finished-product stock through a stock adjustment with a positive quantity change and a mandatory `reason` of `"Opening Stock"`.

Example:

```text
Product:
Blue Shirt - 40

quantity_change:
+50

reason:
Opening Stock
```

Subsequent corrections (damaged goods, theft, count mismatch) use the same mechanism with a descriptive `reason`.

---

# 20. Sales Management

A sale represents a completed direct customer purchase.

Normal sales are fully paid.

Customer credit/due is not allowed for normal sales.

---

# 21. Normal Sale Example

Customer purchases:

```text
2 × Blue Shirt
1 × Navy Pant
```

Total:

```text
৳2,500
```

The customer must pay the full amount.

The sale is then completed.

---

# 22. Creating a Sale

When a customer arrives:

### Step 1

Employee/Owner searches the customer by:

* Phone
* Name
* Customer ID

### Step 2

If the customer does not exist, the employee/owner can create a new customer.

### Step 3

Employee searches for the required product.

Search can use:

* Product name
* Product ID

### Step 4

Employee selects the product.

### Step 5

Employee enters:

* Quantity
* Selling price

### Step 6

Additional products can be added.

### Step 7

System calculates the total sale amount.

### Step 8

Sale is saved.

### Step 9

Inventory is updated.

### Step 10

A system-generated Sales ID is created.

---

# 23. Duplicate Sale Items

The same product must not appear as separate duplicate line items in a single sale.

Example of incorrect behavior:

```text
Blue Shirt - 40 × 1
Blue Shirt - 40 × 2
```

Correct behavior:

```text
Blue Shirt - 40 × 3
```

If the employee selects an already selected product, the existing quantity should be updated.

---

# 24. Sale Fields

A sale should contain information such as:

* Sales ID
* Customer
* Sale date/time
* Total amount
* Created by
* Status
* Notes where applicable

Each sale contains one or more sale items.

---

# 25. Sale Item Fields

Each sale item must contain:

* Product
* Quantity
* Selling price
* Line total

Line total:

```text
Quantity × Selling Price
```

---

# 26. Sale Search

Sales must be searchable by Sales ID.

The shop uses physical handwritten receipts.

The employee/Owner can write the system-generated Sales ID on the physical receipt.

Later, searching by Sales ID should retrieve the complete sale history.

---

# 27. Sale Editing

Only the Owner can edit a completed sale.

Employees cannot edit completed sales.

If an edited sale affects:

* Inventory
* Customer history
* Cash

the corresponding records must remain consistent.

---

# 28. Sale Cancellation

Only the Owner can cancel a sale.

Cancelled records must not be physically deleted.

The system should preserve the historical record and maintain inventory/financial consistency.

---

# 29. Product Returns

Product returns are not defined in the current requirements.

No product-return workflow is required for V1.

---

# 30. Custom Orders

Custom orders are a separate workflow from normal sales.

A custom order is created when the customer wants a product that:

* Is unavailable
* Needs custom preparation
* Needs to be specially ordered/prepared

---

# 31. Custom Order Payment

Custom orders support partial payment.

Example:

```text
Total Price: ৳2,500
Advance: ৳500
Due: ৳2,000
```

The customer pays the remaining amount when collecting the completed order.

---

# 32. Custom Order Fields

Each custom order must contain:

| Field                  | Required           |
| ---------------------- | ------------------ |
| Order ID               | Auto-generated     |
| Customer               | Yes                |
| Product                | Yes                |
| Description            | No                 |
| Quantity               | Yes                |
| Total Price            | Yes                |
| Advance                | No/0 allowed       |
| Due                    | Calculated         |
| Expected Delivery Date | Yes                |
| Order Date             | Automatic          |
| Delivery Date          | No until delivered |
| Notes                  | No                 |
| Status                 | Yes                |

---

# 33. Custom Order Status

Allowed statuses:

```text
PENDING
READY
DELIVERED
CANCELLED
```

No additional status is required.

---

# 34. Custom Order Description

The system does not require dedicated measurement fields.

Any measurement or special instruction can be written in:

* Description
* Notes

Example:

```text
Description:
Long sleeve, loose fit, white collar.
```

---

# 35. Custom Order Payments

A custom order can have multiple payments.

Example:

```text
01 Sep:
৳500

05 Sep:
৳1,000

10 Sep:
৳1,000
```

The system must preserve payment history.

Remaining due is calculated as:

```text
Total Price - Total Payments
```

### 35.1 Custom Order Payment and Cash

Custom-order customer payments are **real shop cash inflows**.

Whenever a custom-order payment is recorded, the system MUST automatically create a corresponding `CASH_IN` transaction in the **same database transaction**.

This is the **only** business event (besides a completed normal sale) that automatically creates a cash transaction.

Supplier payments MUST NOT automatically create any cash transaction.

Expenses MUST NOT automatically create any cash transaction.

---

# 36. Custom Order Delivery

When the customer receives the product:

* Order status becomes `DELIVERED`
* Delivery date is recorded
* Any remaining due must be settled

The system must not allow the order to incorrectly show an outstanding due after full payment.

---

# 37. Custom Order Cancellation

Only the Owner can cancel a custom order.

Cancellation must preserve the order's history.

---

# 38. Customer Due

Customer due is only supported for custom orders.

Normal direct sales must be fully paid.

There is no general customer credit ledger in V1.

---

# 39. Supplier Management

The Owner can manage suppliers.

A supplier can be:

* Created
* Edited
* Marked inactive

Supplier records must remain available for historical purchases.

---

# 40. Supplier Fields

Supplier information may contain:

* Supplier ID
* Name
* Phone
* Address
* Notes
* Status
* Created date
* Updated date

---

# 41. Supplier Search

Suppliers should be searchable by:

* Name
* Phone
* Supplier ID

---

# 42. Purchase Management

The shop purchases materials/products from suppliers.

Purchases can contain multiple items.

Example:

```text
Purchase:

Supplier:
ABC Store

Items:
Fabric
Button
Thread
```

---

# 43. Purchase Fields

A purchase should contain:

* Purchase ID
* Supplier
* Purchase date
* Total amount
* Paid amount
* Due amount
* Notes
* Created by
* Created date

---

# 44. Purchase Items

Each purchase contains one or more purchase items.

A purchase item should contain:

* Item name/product reference
* Quantity
* Purchase cost
* Description/notes where required

---

# 45. Supplier Purchase History

The Owner must be able to view:

* What was purchased from a supplier
* Purchase dates
* Purchased quantities
* Purchase amounts
* Previous purchase history

---

# 46. Purchase Period Reports

The Owner should be able to see purchase information by:

* Week
* Month
* Custom date range where practical

Examples:

```text
This week's purchased items
This month's purchased items
Total quantity purchased this week
```

---

# 47. Supplier Due

Supplier purchases may be partially paid.

Example:

```text
Purchase Total:
৳20,000

Paid:
৳5,000

Due:
৳15,000
```

The system must maintain the supplier's outstanding due.

---

# 48. Supplier Payment

Supplier payments are recorded separately.

A supplier may receive multiple payments.

Example:

```text
05 Sep → ৳5,000
10 Sep → ৳3,000
```

The system must maintain supplier payment history.

---

# 49. Critical Supplier Payment Rule

Supplier payments and shop cash are separate systems.

Recording a supplier payment must **not automatically create a Cash Out transaction**.

For example:

```text
Supplier Payment:
৳5,000

Supplier Due:
-৳5,000
```

But:

```text
Shop Cash:
UNCHANGED
```

unless the Owner separately records a cash transaction.

This separation is intentional.

---

# 50. Supplier Receipt Images

The Owner can upload receipt images for supplier purchases/payments.

A purchase can contain multiple images.

Images are stored as proof/reference.

The system should allow the Owner to review these images later.

---

# 51. Purchase Return

Purchase return is not required for V1.

---

# 52. Raw Material Management

Raw materials are completely separate from finished products.

Examples:

* Fabric
* Button
* Thread
* Other raw materials

---

# 53. Raw Material Scope

The raw-material module is intentionally basic in V1.

It is only a record-keeping module.

It does not track production.

---

# 54. Raw Material Fields

Each raw-material record contains:

| Field         | Required |
| ------------- | -------- |
| Item Name     | Yes      |
| Quantity      | Yes      |
| Description   | No       |
| Date          | Yes      |
| Notes         | No       |
| Purchase Cost | No       |

No unit field is required.

---

# 55. Raw Material Inventory

Raw materials and finished products are separate.

There must be no automatic relationship between:

```text
Raw Material
        ↓
Production
        ↓
Finished Product
```

Production tracking is outside the current scope.

---

# 56. Expense Management

Only the Owner can manage expenses.

Employees cannot access expense management.

---

# 57. Expense Fields

Each expense contains:

* Expense ID
* Expense type/category
* Amount
* Date
* Description
* Notes
* Created by
* Created date

Date is required.

Description is optional.

---

# 58. Expense Categories

The Owner can create custom expense categories.

The system should not depend only on a hardcoded expense list.

---

# 59. Expense Reports

Owner can view:

* Monthly expenses
* Yearly expenses
* Category-wise expenses where practical

---

# 60. Expense vs Cash

Expenses and cash are intentionally separate.

Creating an expense must not automatically reduce shop cash.

If physical cash is removed from the shop, the Owner records a separate Cash Out transaction.

---

# 61. Cash Management

Cash management tracks physical cash available in the shop.

The primary purpose is daily reconciliation.

The Owner should be able to compare:

```text
Expected System Cash
VS
Actual Physical Cash
```

---

# 62. Opening Cash

At the beginning of the day:

```text
Previous Day Closing Cash
        ↓
Next Day Opening Cash
```

A new `OPENING` cash transaction is **NOT** inserted every day. The opening cash is **derived** from the previous day's closing cash.

The `OPENING` transaction type is reserved for the initial cash setup / manual seed only (the very first time the system is started, or when the Owner bootstraps a new cash baseline).

If the Owner needs to correct cash outside of normal in/out transactions, a separate `CASH_ADJUSTMENT` transaction (with a mandatory reason) must be used.

---

# 63. Cash In

The Owner can add money to shop cash at any time.

Example:

```text
Owner brings:
৳5,000

Reason:
Additional shop cash
```

The transaction must record:

* Amount
* Date/time
* Reason/note
* User

---

# 64. Cash Out

The Owner can remove money from shop cash.

Cash Out requires:

* Amount
* Reason
* Date/time
* User

Example:

```text
Cash Out:
৳3,000

Reason:
Owner withdrawal
```

---

# 65. Cash Sources

Cash can increase from relevant cash transactions such as:

* Customer sales (automatic on completed sale)
* Custom-order customer payments (automatic on payment record)
* Owner cash-in (manual)
* Other explicitly recorded cash-in transactions

All cash-in transactions must be recorded consistently.

### 65.1 Cash Transaction Reference Convention

Cash transactions MUST use a small, generic set of transaction types plus a reference mechanism, rather than a new transaction type per cash source.

Recommended types:

```text
OPENING         → reserved for initial cash seed only
CASH_IN         → any cash inflow (positive)
CASH_OUT        → any cash outflow (negative)
CASH_ADJUSTMENT → signed correction with mandatory reason
```

Each `CASH_IN` / `CASH_OUT` row SHOULD carry `reference_type` and `reference_id` so the source can be identified without inventing new enum values.

Examples:

```text
CASH_IN + reference_type=SALE                 → automatic on completed sale
CASH_IN + reference_type=CUSTOM_ORDER_PAYMENT → automatic on custom-order payment
CASH_IN + reference_type=MANUAL               → Owner-added cash
CASH_OUT + reference_type=MANUAL              → Owner-removed cash
```

Critical reminders:

* Supplier payments MUST NOT automatically create any cash transaction.
* Expenses MUST NOT automatically create any cash transaction.

---

# 66. Cash Reconciliation

At the end of the day, the Owner should see:

```text
Opening Cash
+ Cash In
- Cash Out
= Expected Closing Cash
```

Then compare:

```text
Expected Closing Cash
VS
Physical Cash
```

If there is a difference, the Owner can record a cash adjustment with a reason.

---

# 67. Cash Adjustment

Cash adjustments require:

* Amount
* Direction
* Reason
* Date/time
* User

The system must preserve the adjustment history.

---

# 68. Reports

All reports are Owner-only.

Employees must not access reports.

---

# 69. Sales Reports

Owner can view:

* Today's sales
* Weekly sales
* Monthly sales
* Yearly sales
* Product-wise sales
* Quantity sold
* Sales history

---

# 70. Custom Order Reports

Owner can view:

* Today's custom orders
* Pending orders
* Ready orders
* Delivered orders
* Cancelled orders
* Order payments
* Outstanding order dues

---

# 71. Inventory Reports

Owner can view:

* Current stock
* Product-wise stock
* Quantity sold
* Stock adjustments
* Stock movement history

---

# 72. Customer Reports

Owner can view:

* Customer list
* Customer purchase history
* Total customer purchases
* Customer custom orders

Customer purchase history should belong to the parent/customer account, regardless of which child the purchase was intended for.

---

# 73. Supplier Reports

Owner can view:

* Supplier list
* Supplier purchase history
* Supplier payment history
* Supplier outstanding dues
* Supplier-wise purchase totals

---

# 74. Raw Material Reports

Owner can view raw-material records.

The system may provide:

* Date-wise records
* Item-wise records
* Purchase-cost information where available

Advanced material-consumption reporting is not required.

---

# 75. Expense Reports

Owner can view:

* Monthly expenses
* Yearly expenses
* Category-wise expenses

---

# 76. Cash Reports

Owner can view:

* Opening cash
* Cash in
* Cash out
* Adjustments
* Expected closing cash
* Physical cash
* Cash difference

---

# 77. Profit Calculation

Profit is optional.

The Owner may choose to view profit.

Profit is calculated only when product purchase price has been manually entered.

Basic calculation:

```text
Profit =
Sales Revenue
-
Product Purchase Cost
```

For each sold item:

```text
Item Profit =
Selling Price - Purchase Price
```

Then:

```text
Total Profit =
Sum of Item Profit × Quantity
```

If required purchase-cost information is missing, profit must not be displayed as a fabricated value.

---

# 78. Profit Scope

The V1 profit calculation does not automatically include:

* Raw-material cost
* General expenses
* Supplier payment
* Other operating costs
* Manufacturing overhead

These are outside the current profit calculation requirement.

---

# 79. Data Visibility

## Owner can see:

* Everything

## Employee can see:

* Sales
* Customers
* Children
* Basic customer due information related to custom orders
* Basic customer information

Employee must not see:

* Purchase costs
* Profit
* Reports
* Expenses
* Supplier information
* Supplier dues
* Supplier payment history
* Cash
* Raw-material purchase costs

---

# 80. Customer Due Visibility

Employees can see the customer's outstanding custom-order due.

They must not see unrelated financial reports.

Example:

```text
Order Total: ৳2,500
Paid: ৳500
Due: ৳2,000
```

This information can be shown to the employee because it is necessary for customer/order operations.

---

# 81. Edit Permissions

Owner can edit relevant records.

Employee editing is restricted.

Customer information may be edited by authorized users according to the final permission implementation.

Historical financial records must not be silently destroyed.

---

# 82. Deletion Policy

Customer records cannot be deleted.

Products with historical records should not be physically deleted.

Instead, they should be made inactive.

Historical sales, purchases, payments, and other business records should remain preserved.

---

# 83. Inactive Records

The system should support inactive status where appropriate.

Examples:

```text
Customer → Active / Inactive
Product → Active / Inactive
Supplier → Active / Inactive
User → Active / Inactive
```

Inactive records remain available for historical data.

---

# 84. Search Requirements

### Customer

Search by:

```text
Customer ID
Name
Phone
```

### Product

Search by:

```text
Product ID
Product Name
```

### Sale

Search by:

```text
Sales ID
```

### Supplier

Search by:

```text
Supplier ID
Name
Phone
```

---

# 85. Physical Receipt Workflow

NI Fashion currently uses physical receipt books.

The application does not need to generate digital receipts in V1.

Instead:

1. System creates Sales ID.
2. Employee/Owner writes Sales ID on physical receipt.
3. Physical receipt is given to customer.
4. Later, Sales ID can be searched in the system.
5. Complete sale history can be retrieved.

Supplier receipt images are different: they should be uploadable as digital proof.

---

# 86. Date and Time Requirements

The system must record dates/times for relevant business activities.

Important timestamps include:

* Customer creation
* Child creation
* Product creation
* Sale creation
* Custom order creation
* Custom order delivery
* Custom-order payments
* Purchase creation
* Supplier payments
* Raw-material records
* Expenses
* Cash transactions
* Stock adjustments

---

# 87. Data Integrity Requirements

The system must ensure that:

* Sale totals are correct
* Sale items belong to the correct sale
* Stock changes are consistent
* Custom-order due is correct
* Supplier due is correct
* Payment history is preserved
* Cash calculations are consistent
* Historical records are preserved

---

# 88. Transaction Requirements

Operations involving multiple related records should be atomic.

Example:

Creating a sale may involve:

```text
Sale
+
Sale Items
+
Inventory Update
+
Cash Transaction
```

If one required operation fails, the entire operation should fail safely.

The system must avoid partially saved transactions.

---

# 89. Validation Requirements

The backend must validate all important input.

Examples:

### Sale

* Customer must exist where required
* Product must exist
* Quantity must be positive
* Selling price must be valid
* Stock availability must be checked

### Custom Order

* Customer must exist
* Total price must be valid
* Payment cannot exceed total price
* Due cannot be negative
* Expected delivery date must be valid

### Supplier Payment

* Supplier must exist
* Amount must be positive
* Payment must not incorrectly exceed allowed outstanding amount

### Stock Adjustment

* Product must exist
* Quantity must be valid
* Reason is required

### Cash Out

* Amount must be positive
* Reason is required

---

# 90. Responsive UI Requirements

The application must be mobile-first.

Primary workflows must be comfortable on a smartphone.

The UI must support:

* Mobile
* Tablet
* Desktop

Tables should become responsive layouts on small screens where necessary.

Forms should avoid unnecessary fields.

---

# 91. Sales UX Priority

The New Sale screen is one of the most important screens.

The intended workflow should be fast:

```text
Search Customer
      ↓
Select/Create Customer
      ↓
Search Product
      ↓
Select Product
      ↓
Enter Quantity
      ↓
Enter Selling Price
      ↓
Add More Products
      ↓
Review Total
      ↓
Complete Sale
```

The user should not need to navigate through multiple unnecessary pages.

---

# 92. Custom Order UX

The custom-order workflow should be separate from normal sales.

Suggested flow:

```text
Customer
   ↓
Custom Order
   ↓
Product / Description
   ↓
Quantity
   ↓
Total Price
   ↓
Advance
   ↓
Expected Delivery Date
   ↓
Save Order
```

Later:

```text
Pending
   ↓
Ready
   ↓
Customer Collects
   ↓
Remaining Payment
   ↓
Delivered
```

---

# 93. Supplier UX

Supplier management should support:

```text
Supplier
   ↓
Purchase History
   ↓
Current Due
   ↓
Payment History
   ↓
Receipt Proofs
```

This should allow the Owner to understand the complete relationship with a supplier.

---

# 94. Cash UX

The cash screen should make daily reconciliation easy.

Suggested structure:

```text
Opening Cash

+ Cash In

+ Cash from applicable sales

- Cash Out

= Expected Cash

Physical Cash

= Difference
```

Supplier payments must remain outside this calculation unless separately recorded as cash transactions.

---

# 95. Reporting UX

Reports should support date filtering.

At minimum:

* Today
* This week
* This month
* This year
* Custom date range where useful

Reports should prioritize useful business information rather than decorative charts.

---

# 96. Out of Scope — V1

The following are explicitly outside the current requirements:

* Online customer ordering
* Online payment gateway
* E-commerce marketplace
* Customer mobile application
* Product delivery management
* Product returns
* Purchase returns
* Lost-product tracking
* Separate damage-product module
* Production tracking
* Manufacturing workflow
* Bill of Materials
* Raw-material consumption tracking
* Measurement database
* School-wise product database
* Product-school relationship
* Default selling price
* Customer credit for normal sales
* General customer debt ledger
* Advanced accounting
* Payroll
* Employee attendance
* Employee salary management
* Advanced taxation
* Automated supplier-payment-to-cash integration
* Automated expense-to-cash integration

---

# 97. Future Extensibility

Although these features are outside V1, the architecture should not make them impossible to add later.

Potential future modules include:

* Product returns
* Purchase returns
* Raw-material inventory management
* Production tracking
* Measurement profiles
* Advanced accounting
* Payroll
* Online customer ordering
* Digital receipts
* Payment gateways
* Advanced analytics

The V1 implementation should remain simple while keeping reasonable extensibility.

---

# 98. Acceptance Criteria

The system will be considered functionally complete when:

### Customers

* Customer can be created
* Customer receives automatic ID
* Customer can have multiple children
* Child school/class information can be stored
* Child class automatically advances yearly
* Customer cannot be deleted
* Customer can be made inactive
* Customer search works

### Products

* Product ID is generated
* Product name can contain type/size/colour
* Product can be searched
* Purchase price is optional
* Selling price is entered during sale
* Stock is maintained
* Stock adjustments work
* Stock history is preserved

### Sales

* Customer can be selected/created
* Multiple products can be sold
* Duplicate product lines are prevented
* Selling price can vary per sale
* Sales ID is generated
* Sales can be searched by Sales ID
* Inventory updates correctly
* Only Owner can edit/cancel sales

### Custom Orders

* Custom orders can be created
* Partial payments work
* Multiple payments work
* Due is calculated correctly
* Status workflow works
* Delivery date is recorded
* Customer due can be viewed

### Suppliers

* Supplier can be created
* Purchases can be recorded
* Multiple purchase items can be stored
* Supplier due is calculated
* Supplier payment history works
* Receipt images can be uploaded
* Supplier payment does not automatically affect cash

### Raw Materials

* Raw material records can be created
* Required fields work
* Raw materials remain separate from finished products

### Expenses

* Owner can create expenses
* Custom expense categories work
* Monthly/yearly reports work
* Employees cannot access expenses

### Cash

* Opening cash works
* Previous closing cash can become next opening cash
* Cash in works
* Cash out works
* Cash adjustments work
* Physical cash reconciliation works
* Supplier payments remain separate

### Reports

* Owner can access reports
* Employees cannot access reports
* Sales reports work
* Purchase reports work
* Inventory reports work
* Customer history works
* Supplier history works
* Expense reports work
* Cash reports work
* Optional profit calculation works correctly

---

# 99. Final Business Rule Summary

The following rules are especially important and must not be violated:

```text
1. There are only two roles: OWNER and EMPLOYEE.

2. Product does not belong to a school.

3. School belongs to the child.

4. Customer has one unified account.

5. Customer can have multiple children.

6. Child class automatically increases by one every year
   based on child creation date.

7. Normal sales are fully paid.

8. Customer due is only supported for custom orders.

9. Custom orders support advance and multiple payments.

10. Product selling price is entered manually during every sale.

11. Product has no default selling price.

12. Product purchase price is optional.

13. Only Owner can see purchase cost.

14. Missing purchase cost means profit must not be calculated.

15. Finished-product inventory is piece-based.

16. Stock can be manually adjusted by Owner.

17. Stock adjustment requires a reason.

18. Products are not physically deleted when historical records exist.

19. Customer records cannot be deleted.

20. Supplier payments are completely separate from shop cash.

21. Expenses are completely separate from shop cash.

22. Raw materials are completely separate from finished products.

23. Production tracking is not required.

24. Supplier payment history is required.

25. Supplier receipt images can be stored as proof.

26. Physical sales receipts are handled manually.

27. System Sales ID is written on the physical receipt.

28. Sales can later be retrieved using Sales ID.

29. Employees can perform sales.

30. Employees cannot access reports, expenses, purchase costs,
    supplier dues, or profit.

31. Only Owner can edit/cancel sales.

32. Dashboard only needs:
    - Today's Sales
    - Today's Custom Orders
    - Current Cash
    - Total Stock Items

33. Historical business records must be preserved.

34. Backend must enforce all important business rules.

35. Financial and inventory-related operations must maintain data consistency.
```

---

# 100. Document Status

This document represents the current V1 functional requirements for NI Fashion.

Any future business requirement that changes the above behavior should be explicitly documented before implementation.

**End of REQUIREMENTS.md**
