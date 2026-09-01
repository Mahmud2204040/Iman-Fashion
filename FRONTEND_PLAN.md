# NI Fashion — Frontend Plan

Phase-by-phase plan for building the NI Fashion frontend **before** any backend or database work begins. This document is the source of truth for UI scope and order of implementation.

> **Stack:** React 18 + Vite 5 + JavaScript (no TypeScript) + CSS Modules. No extra UI / state libraries.
> **Roles:** `OWNER` and `EMPLOYEE` only.
> **Mode:** Mock data only until the backend exists.

---

## Phase 0 — Project Setup ✅
- Vite + React + JavaScript scaffold.
- Install only `react-router-dom`.
- Scripts: `dev`, `build`, `preview`, `lint`.
- `.gitignore` + `README.md` referencing the planning docs.

## Phase 1 — Frontend Architecture
Create the `src/` tree and stub files for components, pages, layouts, routes, hooks, services, utils, constants, mock, styles. Services return mock data with `await delay(...)`.

## Phase 2 — Design System
Tokens (color, spacing, radius, type, shadow, motion) and common components: Button, Input, Select, Textarea, Modal, ConfirmDialog, Badge, EmptyState, Spinner, DataTable (with mobile card variant), FormField.

## Phase 3 — Authentication UI
`LoginPage` with username + password + "Remember me" + a visible **"Development mock"** banner. Mock credentials: `owner / 1234`, `employee / 1234`. Auth + Role contexts; `<ProtectedRoute>` and `<RoleRoute>`.

## Phase 4 — Dashboard
**Exactly four cards**, identical for both roles:
1. Today's Sales
2. Today's Custom Orders
3. Current Cash
4. Total Stock Items

No charts, no owner extras strip.

## Phase 5 — Sales
Two-pane on desktop, stacked on mobile. Flow: **search customer → (create if needed) → search product → qty + price → add → review → complete**. Same product re-added merges qty. `sales_code` is generated and surfaced on success. Sale creates a `CASH_IN` row with `reference_type: SALE`. **Price validation:** numeric and present; zero is not blocked here (open question).

## Phase 6 — Customers
Tabs: Profile / Sales History / Custom Orders / Due Summary. Children with **derived current class** from `initial_class + years_since(created_at)`. No delete (status toggle). Audit columns `created_by` / `updated_by`. Employee sees full customer history; only cost / profit / supplier / expense fields are hidden.

## Phase 7 — Custom Orders
Single product + qty (multi-item is an open question). Payment recording creates `CASH_IN` with `reference_type: CUSTOM_ORDER_PAYMENT`. **Cancel** = status change only (Owner-only); no automatic cash reversal. Cancellation cash-treatment is flagged as an open business rule.

## Phase 8 — Products & Stock
Owner-only module. Stock adjustment form: **Quantity Change (+/−)** + **Reason (required, free text)**. The only structured reason shortcut is `OPENING_STOCK`. No predefined reason enum. Stock shown as a plain number — no color bands, no low-stock threshold. **No employee Products/Stock route**; availability surfaces inside the sales flow only.

## Phase 9 — Suppliers & Purchases
Owner-only. Supplier totals: Purchases / Paid / Due. Receipt image upload + preview. Supplier payments are **separate** from shop cash; they never auto-create `CASH_OUT`.

## Phase 10 — Raw Materials
Light module. List + add (name, qty, description, date, notes, optional purchase cost). No units, no meters, no production tracking.

## Phase 11 — Expenses
Owner-only. Categories, amount, date, description, notes. Hidden entirely from employees.

## Phase 12 — Cash Management
Five panels: Opening (derived), Cash In, Cash Out, Expected Closing, End-of-day reconcile. Same row shape as backend: `{ type, amount, reference_type, reference_id, reason, created_by, created_at }`. Supplier payments and expenses never appear here.

## Phase 13 — Reports (Owner-only)
9 reports per `REQUIREMENTS.md`. Profit report gates on availability of `purchase_price`.

## Phase 14 — Role-Based UI (explicit pass)
Walk every page with both roles. Hide owner-only navigation, fields, and actions for employees. Employee keeps full customer purchase history; only cost/profit/supplier/expense/reports are restricted.

## Phase 15 — Responsive Testing & Polishing
Test breakpoints 360 / 414 / 768 / 1024 / 1280 / 1440. Tables → cards on small screens. Forms full-width with sticky primary action. Touch targets ≥ 40px. Empty / loading / error states everywhere. Confirm dialogs for destructive actions.

---

## Open questions (carried into implementation, not invented)

- **Q1** Sales code format — default `S-YYYYMMDD-NNNN`.
- **Q2** Custom-order quantity — single product + qty until clarified; multi-item not built.
- **Q3** Custom-order cancel — cash treatment is not auto-implemented; awaiting business rule.
- **Q4** Zero-price sales — UI does not block; flagged.
- **Q5** Stock adjustment reason — free text + `OPENING_STOCK` shortcut only; no predefined list.

## General rule

If a planning document does not explicitly define a business rule, this plan **does not invent one**. It is surfaced as an open question instead.
