> ARCHIVED on 2026-10-01. Historical reference only; this file is not an active specification.
> Read [the active documentation index](../../README.md) before using any rule or completion claim below.

# NI Fashion — Project Initialization & Frontend-First Development Prompt

You are a **Senior Full-Stack Software Engineer and UI/UX Engineer**.

We are building a **mobile-responsive web application** for a clothing shop called **NI Fashion**.

NI Fashion sells school and college dresses and other accessories such as:

* Shirt
* Pant
* Salwar
* Kamiz
* Orna
* Frock
* Shoe
* Bag
* Other accessories

The shop also manufactures some of its own clothing products.

The application will be used by:

* Owner
* Employees / Staff

---

# 1. Development Strategy

This project will be developed **frontend-first**.

Do NOT start backend or database implementation yet.

The current goal is to build a complete, realistic, responsive frontend so that the client can review the UI/UX and identify missing or changing requirements before backend/database development begins.

Development order:

```text
Phase 0
Project setup

↓

Phase 1
Frontend architecture

↓

Phase 2
Design system

↓

Phase 3
Authentication UI

↓

Phase 4
Dashboard

↓

Phase 5
Sales

↓

Phase 6
Customers

↓

Phase 7
Custom Orders

↓

Phase 8
Products & Stock

↓

Phase 9
Suppliers & Purchases

↓

Phase 10
Raw Materials

↓

Phase 11
Expenses

↓

Phase 12
Cash Management

↓

Phase 13
Reports

↓

Phase 14
Owner / Employee permissions

↓

Phase 15
Responsive testing & polishing
```

Backend and database will be implemented only after the frontend and requirements are sufficiently stable.

---

# 2. Technology Stack

Use:

```text
React
Vite
JavaScript
HTML
CSS
```

Do NOT use TypeScript.

Do NOT introduce unnecessary frameworks.

For styling, use a clean and maintainable approach such as:

```text
CSS Modules
```

or another lightweight CSS architecture already established in the project.

If the project already has a styling solution, inspect it before introducing another one.

---

# 3. Frontend Architecture

Create a scalable structure.

Recommended structure:

```text
src/
│
├── assets/
│
├── components/
│   ├── common/
│   ├── layout/
│   ├── forms/
│   ├── tables/
│   ├── modals/
│   └── ui/
│
├── pages/
│   ├── auth/
│   ├── dashboard/
│   ├── sales/
│   ├── customers/
│   ├── orders/
│   ├── products/
│   ├── suppliers/
│   ├── purchases/
│   ├── raw-materials/
│   ├── expenses/
│   ├── cash/
│   └── reports/
│
├── layouts/
│
├── routes/
│
├── hooks/
│
├── services/
│
├── utils/
│
├── constants/
│
├── mock/
│
├── styles/
│
└── App.jsx
```

Do not blindly copy this structure.

Adapt it to the actual project when appropriate.

---

# 4. Important Frontend Principle

The frontend should be designed around the **actual shop workflow**, not around generic CRUD screens.

The application should feel like software made specifically for NI Fashion.

Avoid unnecessary enterprise-style complexity.

The UI should be:

* Simple
* Fast
* Mobile-friendly
* Easy for employees to learn
* Comfortable for daily shop use
* Clear for financial information
* Consistent

---

# 5. User Roles

There are only two roles:

```text
OWNER
EMPLOYEE
```

There is NO ADMIN role.

---

# 6. Employee Permissions

Employee can:

* Make sales
* Search products
* Search customers
* Create customers
* Edit permitted customer information
* View customer basic information
* Add children
* Edit permitted children information
* View children basic information
* View customer's custom-order due
* View sales
* Search sales by Sales ID / Sales Code

Employees can **view and search** sales history but cannot edit or cancel a completed sale.

Employee cannot:

* See purchase cost
* See profit
* See supplier due
* See supplier payments
* See expenses
* See reports
* Delete products
* Edit/cancel transactions
* Perform stock adjustments
* Add expenses
* Manage supplier payments

The frontend must reflect these permissions.

However, do NOT assume frontend hiding is security.

Actual authorization will be implemented later in the backend.

---

# 7. Owner Permissions

Owner has access to all modules.

Owner can:

* Manage products
* Manage customers
* Manage children
* Manage sales
* Manage custom orders
* Manage suppliers
* Manage purchases
* Manage supplier payments
* Manage raw materials
* Manage expenses
* Manage cash
* Adjust stock
* View reports
* View profit
* View purchase costs
* Edit/cancel appropriate records

---

# 8. Main Application Layout

Use a responsive application shell.

Desktop:

```text
┌──────────────────────────────────────┐
│ Header                               │
├────────────┬─────────────────────────┤
│ Sidebar    │ Main Content            │
│            │                         │
│ Dashboard  │                         │
│ Sales      │                         │
│ Customers  │                         │
│ Orders     │                         │
│ Products   │                         │
│ Suppliers  │                         │
│ Purchases  │                         │
│ Expenses   │                         │
│ Cash       │                         │
│ Reports    │                         │
└────────────┴─────────────────────────┘
```

Mobile:

```text
┌──────────────────────┐
│ Header               │
├──────────────────────┤
│                      │
│ Main Content         │
│                      │
│                      │
├──────────────────────┤
│ Bottom Navigation    │
└──────────────────────┘
```

Do not simply shrink the desktop sidebar on mobile.

Create an intentionally mobile-friendly navigation experience.

---

# 9. Dashboard

Dashboard should remain simple.

Required information:

```text
Today's Sales
Today's Custom Orders
Current Cash
Total Stock Items
```

Do NOT fill the dashboard with unnecessary charts or statistics.

Owner may see additional financial information where appropriate.

Employee should only see information allowed by their role.

---

# 10. Sales Page

This is one of the most important screens because employees will use it frequently.

Workflow:

```text
Customer arrives

↓

Search customer by:
- Phone
- Name
- Customer ID

↓

If customer does not exist:
Create customer

↓

Search product

↓

Select product

↓

Enter quantity

↓

Enter selling price

↓

Add to sale

↓

Review sale

↓

Complete sale
```

---

# 11. Sales Requirements

Product can be searched using:

```text
Product Name
Product ID
```

Example:

```text
Blue Shirt - 40
Navy Blue Pant - XXL
```

Product type, size and colour do NOT need separate selection fields.

Product name/title itself can contain those details.

Example:

```text
Navy Blue Pant - XXL
```

Employee enters the actual selling price during every sale.

There is NO default selling price.

---

# 12. Sale Rules

A normal sale:

* Has multiple products
* Must be fully paid
* Does not support customer due
* Supports quantity
* Same product cannot appear twice as separate line items

If employee selects the same product again, the UI should increase the existing quantity.

Example:

```text
Blue Shirt - 40 × 2
```

instead of:

```text
Blue Shirt - 1
Blue Shirt - 1
```

---

# 13. Sales Receipt

Physical receipt is currently handwritten.

The system does NOT need a digital receipt printing system in V1.

However, every sale must have a unique:

```text
sales_code
```

The owner/employee can write this sales code on the physical receipt.

Later they can search the system using the sales code and find the sale history.

Therefore the frontend must support:

```text
Search Sale by Sales ID / Sales Code
```

---

# 14. Customer Page

Customer fields:

```text
Customer ID
Name
Phone
Address
Notes
Status
Created Date
```

Customer ID will be automatically generated.

Customer cannot be deleted.

Customer can be marked inactive.

---

# 15. Customer Children

A customer can have multiple children.

Each child contains:

```text
Name
Initial Class
School
Registered Date
Created Date
```

`Initial Class` is the class the child was in when first registered.
`Registered Date` is the date the child was registered with the school-uniform shop and is captured explicitly during creation so yearly class promotion can be calculated accurately. When left empty, today's date is used as a default.

`Notes` is not collected for a child record.

Do NOT add roll number.

School belongs to the child.

School does NOT belong to the product.

---

# 16. Automatic Class Progression

The child class should progress automatically every year based on the child creation date.

Example:

```text
Created:
01 Sep 2026

Class:
5

01 Sep 2027 → Class 6
01 Sep 2028 → Class 7
01 Sep 2029 → Class 8
```

The same system continues for Class 11 and 12.

The frontend should display the calculated current class appropriately.

Do not create separate screens for yearly class promotion.

---

# 17. Customer Purchase History

Customer has one account.

Sales history belongs to the customer account.

Do NOT require identifying which child a normal sale was purchased for.

Example:

Father purchases:

```text
2 Shirts
1 Pant
1 Shoe
```

All belong to the father's customer account.

Customer profile should show:

```text
Total Purchase History
Sales History
Custom Orders
Custom Order Due
```

Normal sales do not have due.

---

# 18. Custom Orders

Custom orders are a separate flow from normal sales.

Custom order fields:

```text
Order ID
Customer
Product
Description
Total Price
Advance
Due
Expected Delivery Date
Order Date
Delivery Date
Notes
Status
```

Status:

```text
Pending
Ready
Delivered
Cancelled
```

The backend stores these as uppercase enum values (`PENDING`, `READY`, `DELIVERED`, `CANCELLED`). The frontend normalizes them via a display helper so the UI shows the Title-case form above.

No measurement-specific fields.

Measurement information can be written in:

```text
Description
Notes
```

---

# 19. Custom Order Payment

Partial payment is allowed.

Example:

```text
Total Price: 2500

Advance: 500

Due: 2000
```

Multiple payments may be made.

Frontend should show:

```text
Total
Paid
Due
Payment History
```

---

# 20. Products

Products are finished products sold by the shop.

Examples:

```text
Blue Shirt - 40
Navy Blue Pant - XXL
White Kamiz - 38
Black Shoe - 42
School Bag
```

Product should have:

```text
Product ID
Product Name
Purchase Price (Owner only)
Stock Quantity
Notes
Status
```

There is no:

```text
Default Selling Price
School
Separate Size field
Separate Colour field
```

---

# 21. Product Stock

Finished products are tracked piece-wise.

Owner can manually adjust stock.

Adjustment requires:

```text
Quantity Change
Reason
```

Employee cannot adjust stock.

Stock adjustment history should be visible to Owner.

No damage/lost-product module is required.

---

# 22. Suppliers

Supplier fields:

```text
Supplier ID
Name
Phone
Address
Notes
Status
```

Supplier can be:

```text
Active
Inactive
```

Supplier cannot be deleted.

---

# 23. Purchases

Purchase flow:

```text
Supplier
↓
Purchase
↓
Multiple Items
```

Purchase fields:

```text
Purchase ID
Supplier
Total Amount
Purchase Date
Notes
```

Purchase items:

```text
Item Name
Quantity
Description
Purchase Cost
Notes
```

Purchase cost can be recorded.

---

# 24. Supplier Due

Supplier may receive partial payment.

Example:

```text
Purchase:
10,000

Paid:
6,000

Due:
4,000
```

Supplier page should show:

```text
Total Purchases
Total Paid
Current Due
Payment History
Purchase History
```

Supplier payment is a completely separate financial system from shop cash.

---

# 25. Supplier Receipt Images

Purchase can have multiple receipt images.

UI should support:

```text
Upload receipt image
Preview image
View receipt images
```

These are proof/reference documents.

---

# 26. Raw Materials

Raw materials are completely separate from finished products.

Examples:

```text
Fabric
Button
Thread
Other materials
```

Current raw material fields:

```text
Item Name
Quantity
Description
Date
Notes
Purchase Cost (Optional)
```

Do NOT implement:

* Unit management
* Meter calculation
* Production tracking
* Manufacturing workflow
* Material consumption tracking

This module will be expanded later if required.

---

# 27. Expenses

Owner-only module.

Expense fields:

```text
Expense Category
Amount
Date
Description
Notes
```

Expense categories can be created by Owner.

Employee cannot add or view expenses.

---

# 28. Cash Management

Cash means the physical cash currently inside the shop.

Owner can:

```text
Set Opening Cash
Add Cash
Remove Cash
```

Cash removal requires:

```text
Amount
Reason
```

Example:

```text
Cash Out:
1000

Reason:
Owner took cash home
```

---

# 29. Cash Opening/Closing

Preferred workflow:

```text
Previous Closing Cash
        ↓
Next Day Opening Cash
```

Owner can manually adjust the opening cash when necessary.

At the end of the day, Owner should be able to compare:

```text
Expected Cash
Physical Cash
Difference
```

---

# 30. Important Financial Separation

Do NOT mix these systems in the frontend architecture.

### Shop Cash

```text
Opening Cash
Cash In
Sales Cash
Cash Out
Cash Adjustment
```

### Supplier Accounting

```text
Purchases
Supplier Payments
Supplier Due
```

### Expenses

```text
Expenses
```

Supplier payment does NOT automatically become Cash Out.

Expense does NOT automatically become Cash Out.

These relationships will be finalized during backend/database implementation.

---

# 31. Reports

Reports are Owner-only.

Possible reports:

```text
Daily Sales
Monthly Sales
Sales by Product
Stock Report
Customer Purchase History
Custom Order Report
Supplier Purchase History
Supplier Due
Purchase Report
Expense Report
Monthly Expense
Yearly Expense
Cash Report
Profit Report
```

Do not expose reports to employees.

---

# 32. Profit

Profit is optional.

Owner can choose to view profit.

Profit should only be shown when the necessary purchase cost data exists.

The profit calculation is based on manually entered product purchase price.

Raw material cost and other expenses are NOT included in the V1 product profit calculation.

If required purchase cost data is missing, do not display a misleading profit value.

---

# 33. UI/UX Design Principles

The design should feel like a professional modern shop-management application.

Use:

* Clear typography
* Strong visual hierarchy
* Compact tables
* Large touch-friendly buttons
* Clear forms
* Consistent spacing
* Consistent border radius
* Meaningful status badges
* Confirmation dialogs for destructive actions
* Empty states
* Loading states
* Error states
* Success feedback

Avoid:

* Excessive gradients
* Excessive animations
* Huge cards
* Unnecessary charts
* Overly complicated navigation
* Excessive colors

---

# 34. Mobile-First Considerations

The application must work properly on:

```text
Mobile
Tablet
Laptop
Desktop
```

Especially optimize:

```text
Sales
Customer Search
Product Search
Custom Order Entry
```

for mobile use.

Tables should become:

```text
Cards
Scrollable tables
Expandable rows
```

where necessary.

Forms should not become cramped on small screens.

---

# 35. Mock Data

Since backend is not being developed yet, create realistic mock data.

Use mock data for:

```text
Customers
Children
Products
Sales
Custom Orders
Suppliers
Purchases
Expenses
Cash
```

The mock data should represent realistic NI Fashion usage.

Do not hard-code fake data directly inside every component.

Keep mock data centralized.

---

# 36. State Management

Do not introduce a large state-management library unless it becomes necessary.

Start simple.

Use:

```text
React state
Context
Custom hooks
```

where appropriate.

Architecture should allow future API integration without rewriting the entire frontend.

---

# 37. API Preparation

Even though backend does not exist yet, separate business/data access logic from UI components.

For example:

```text
services/
    customerService.js
    productService.js
    salesService.js
    orderService.js
```

Initially these can return mock data.

Later they will call Express APIs.

This will make backend integration easier.

---

# 38. Routing

Use a proper routing system.

Routes should be organized by module.

Example:

```text
/login

/dashboard

/sales
/sales/:id

/customers
/customers/:id

/orders
/orders/:id

/products
/products/:id

/suppliers
/suppliers/:id

/purchases
/purchases/:id

/raw-materials

/expenses

/cash

/reports
```

Protect Owner-only routes at the frontend level.

Again, actual security will later be implemented in the backend.

---

# 39. Development Workflow

Do NOT build all pages randomly.

Follow this order:

### STEP 1

Initialize project.

### STEP 2

Create project architecture.

### STEP 3

Create global design system.

### STEP 4

Create application layout.

### STEP 5

Create responsive navigation.

### STEP 6

Create login page.

### STEP 7

Create dashboard.

### STEP 8

Create Sales.

### STEP 9

Create Customers.

### STEP 10

Create Custom Orders.

### STEP 11

Create Products & Stock.

### STEP 12

Create Suppliers & Purchases.

### STEP 13

Create Raw Materials.

### STEP 14

Create Expenses.

### STEP 15

Create Cash Management.

### STEP 16

Create Reports.

### STEP 17

Implement role-based UI.

### STEP 18

Connect all pages with mock data.

### STEP 19

Test complete user flows.

### STEP 20

Responsive testing.

### STEP 21

UI polish.

---

# 40. Before Writing Code

First inspect:

```text
Existing files
package.json
README
PROJECT_RULES.md
REQUIREMENTS.md
DATABASE_PLAN.md
```

If these files exist, understand them before modifying the project.

Do not overwrite existing work without checking it.

---

# 41. Do Not Implement Backend Yet

At this stage:

```text
NO Express API
NO PostgreSQL
NO Prisma/ORM
NO migrations
NO production authentication
NO database integration
```

unless explicitly requested later.

The goal is to stabilize the frontend first.

---

# 42. Requirement Changes

The client may change requirements during frontend development.

Therefore:

* Keep components modular.
* Avoid tightly coupling UI to mock data.
* Avoid premature abstractions.
* Avoid unnecessary database assumptions.
* Keep forms easy to modify.
* Keep business logic separated from presentation.

When a requirement is unclear, ask before making a major architectural decision.

Do not invent business rules.

---

# 43. Quality Standard

Code should be:

* Clean
* Readable
* Modular
* Maintainable
* Reusable where appropriate
* Responsive
* Accessible
* Consistent

Do not create giant components containing hundreds or thousands of lines.

Do not duplicate the same UI logic unnecessarily.

---

# 44. Final Objective

At the end of the frontend phase, I should be able to open the application and experience the complete NI Fashion workflow using mock data:

```text
Login
 ↓
Dashboard
 ↓
Customer
 ↓
Sale
 ↓
Sale History
 ↓
Custom Order
 ↓
Products
 ↓
Stock
 ↓
Suppliers
 ↓
Purchases
 ↓
Supplier Due
 ↓
Raw Materials
 ↓
Expenses
 ↓
Cash
 ↓
Reports
```

The frontend should look and behave like a real production-ready shop management application even though the backend/database has not yet been connected.

**Build the frontend first.**

**Do not implement backend/database unless explicitly instructed.**
