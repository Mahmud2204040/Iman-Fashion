# Project rules

Updated: 2026-10-04. Status: active engineering rules.
Business behaviour: [Requirements](REQUIREMENTS.md). Access: [Role Permissions](ROLE_PERMISSIONS.md).

## Scope and stack

- Internal, mobile-responsive NI Fashion shop management.
- Frontend: React 18, Vite 5, JavaScript, React Router, CSS Modules/plain CSS.
- Backend target: Node.js, Express, TypeScript (for Prisma 7 generated client), Prisma, PostgreSQL.
- Authentication target: hashed passwords and revocable database-backed cookie sessions; never deploy mock credentials. See E009 in the decision register.
- Exactly OWNER and EMPLOYEE. No ADMIN role.
- Frontend-first delivery. Do not treat a mock-only milestone as backend completion.
- Reuse the existing design system and project structure. Add libraries only when a concrete requirement needs them.

## Source of truth

Follow the authority order in [the index](README.md#authority-and-conflicts).
Requirements defines financial formulas and business restrictions; Role Permissions defines action-level access. Technical designs may choose implementation details but cannot broaden permissions or alter financial side effects.

Every newly agreed rule must be reflected in Requirements, the relevant workflow/permission/schema plan and acceptance tests. Keep a dated decision record. Do not create active `.copy.md` variants.

## Architecture

- Pages orchestrate presentation; shared components own reusable controls and forms.
- Services own data access and domain operations. Pages must not mutate mock arrays or calculate authoritative balances.
- Use one customer store/service and one product store/service across modules.
- Mock service contracts should permit API replacement without redesigning forms.
- Validate input on both UI and backend. The backend is authoritative for totals, roles, identifiers and dates.
- Name database columns in snake_case; use a deliberate DTO mapping for existing camelCase frontend services.
- Keep errors actionable, loading states visible and duplicate submission prevention explicit.

## Data integrity and money

- Store monetary values as PostgreSQL NUMERIC(12,2); use decimal-safe arithmetic in backend logic.
- Store event timestamps as TIMESTAMPTZ; use Asia/Dhaka for business-day boundaries and DATE for registration/reconciliation business dates.
- Product quantities are whole pieces. Raw-material quantities may be decimal; V1 has no unit conversion.
- Raw-material records have no internal notes field; use the optional description for material details.
- Derive due from original totals and payment records. Never maintain an independently editable due balance.
- Derive cash from signed ledger entries; derive daily opening from all earlier entries, not just yesterday's net movement.
- Snapshot sale-time unit purchase cost. Never recalculate an old sale using the product's current purchase price.
- A business write with related stock/cash changes must be atomic and retry-safe.
- Use unique business codes and database constraints; do not generate production IDs from array length.
- Store customer/child created_by and updated_by. Apply equivalent audit fields to financial writes.
- Preserve financial history. Corrections use explicit, attributable operations; no silent overwrite or cascade deletion.
- Owner edits/cancellations of completed sales require the correction design gate in [Decisions](DECISIONS.md#open-design-items).

## Authorization

Frontend guards are navigation assistance. Every protected API/service must verify the authenticated actor, role and allowed fields.
Employee responses must exclude purchase costs, sale cost snapshots, profit, supplier/expense data and shop cash balances.
Hiding a cost field in a component is insufficient if the network response still contains it.
Authorization for creating a customer-order payment does not grant access to the shop cash ledger.

## UI and accessibility

Use shared FormField, Input, Button, Modal, ConfirmDialog, DataTable, loading/empty/error patterns and design tokens.
Do not assume a common component accepts a prop or render shape; inspect its implementation.
Support keyboard operation, programmatic labels, visible focus and touch targets of at least 40 px.
Verify 360, 414, 768, 1024, 1280 and 1440 px layouts with real rendering evidence.
Keep sale entry fast; retain entered data after validation/server errors.

## Repository changes and verification

Preserve unrelated working-tree changes. Inspect overlapping edits before patching.
For each work item, record requirement IDs, changed surfaces, checks and remaining limitations.
Lint/build success and service tests do not prove browser rendering. Browser checks do not prove persistent storage or server authorization.
Keep secrets, real credentials and uploads outside Git. Validate uploaded file type/size and retrieve proofs only through authorized access.

## Definition of done

A mock-frontend milestone requires: complete routes/actions, shared data consistency, correct business effects, both-role tests, meaningful error states and browser verification.
A production feature additionally requires: schema/migration, server validation and authorization, atomic operations, persistent data, integration tests and documented recovery behaviour.
V1 is complete only after the [release gate](IMPLEMENTATION_PLAN.md#m7--release-verification) passes. Reports cannot award completion based only on a page filename or an old test result.
