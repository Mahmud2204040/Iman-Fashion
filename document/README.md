# NI Fashion documentation

Updated: 2026-10-04 (Asia/Dhaka). Status: active documentation baseline.

উদ্দেশ্য: NI Fashion-এর নিয়ম, workflow, development plan এবং বাস্তব progress এক জায়গা থেকে বোঝা। এই folder-এর পরিকল্পনা অনুসরণ করে frontend যাচাই, তারপর backend ও deployment সম্পন্ন করতে হবে।

NI Fashion is an internal shop application, not an online storefront. It supports school/college clothing and accessories, customers and children, direct sales, custom orders, stock, suppliers, purchases, raw-material records, expenses, shop cash and Owner reports.

## Read in this order

| Order | Document | What it owns |
| --- | --- | --- |
| 1 | [Project Rules](PROJECT_RULES.md) | Engineering constraints, document authority and definition of done |
| 2 | [Requirements](REQUIREMENTS.md) | Numbered business requirements, scope and acceptance outcomes |
| 3 | [Role Permissions](ROLE_PERMISSIONS.md) | Who may read data or perform each action |
| 4 | [Workflows](WORKFLOWS.md) | User actions, state changes, validations and side effects |
| 5 | [Decisions](DECISIONS.md) | Confirmed decisions, adopted designs and unresolved choices |
| 6 | [Frontend Plan](FRONTEND_PLAN.md) | Pages, shared forms, routes and UI integration |
| 7 | [Database Plan](DATABASE_PLAN.md) | Proposed 19-table schema, constraints and transactions |
| 8 | [Backend/API Plan](BACKEND_API_PLAN.md) | Services, endpoint contracts and authorization |
| 9 | [Implementation Plan](IMPLEMENTATION_PLAN.md) | Ordered milestones, dependencies and exit criteria |
| 10 | [Test Plan](TEST_PLAN.md) | Acceptance scenarios and evidence requirements |
| 11 | [Docker Plan](DOCKER_PLAN.md) | Local containers and deployment-operational principles |
| 12 | [Deployment Plan](DEPLOYMENT_PLAN.md) | Northflank, Aiven and Cloudinary setup order; later Vercel release |
| 13 | [Project Status](PROJECT_STATUS.md) | Actual progress, known gaps and evidence dates |

This index plus the thirteen linked documents form the fourteen active Markdown files.

## Current approved direction

Build and verify the frontend workflows with mock services first. Then implement the backend and replace mock services with real API calls. The current deployment direction is backend first: Northflank Pay-as-you-go, Aiven Free PostgreSQL and Cloudinary Free; Vercel frontend deployment is deferred. See [Deployment Plan](DEPLOYMENT_PLAN.md). This planning update does not claim those services exist.

The frontend stack is React 18, Vite 5, JavaScript and CSS Modules. The started backend uses Node.js/Express, TypeScript, Prisma 7, PostgreSQL, password hashing and revocable database-backed sessions. There are exactly two roles: OWNER and EMPLOYEE.

The latest decisions are recorded in [Decisions](DECISIONS.md). In particular, Employees cannot access Dashboard, customer-order payments can be recorded by Employees, daily cash reconciliation is retained even when matched, and historical product profit uses sale-time cost snapshots.

## Authority and conflicts

1. Explicit current user decisions take precedence.
2. Active Project Rules govern engineering; Requirements govern business behaviour; Role Permissions govern access.
3. Workflows and technical plans implement those rules. They must not invent competing business rules.
4. Decisions explains why a rule changed. Once accepted, update the authoritative document and dependent plans in the same documentation pass.
5. Source code, tests and status reports are evidence of implementation, not permission to change a requirement.
6. Anything under [archive](archive/README.md) is historical and cannot override active documents.

If two active documents conflict, record the conflict in Decisions/Project Status and resolve it before implementing the affected behaviour. Do not resolve a business ambiguity by copying the current mock implementation.

## Traceability

Requirement IDs such as `SALE-02` remain stable. Workflows, milestone tasks and tests refer to those IDs. A requirement is complete only when implementation and verification evidence are linked in Project Status.

Use separate states: Planned, In progress, Implemented (not verified), Verified for mock frontend, Verified end to end, Deferred. A route declaration or HTTP 200 is not proof that its React page renders correctly.

## Working with this documentation

Before changing a module, read its requirements, permissions and workflow, then inspect its current code. After implementation, update Project Status with exact checks, dates and limitations. Keep historical reports in archive; do not rewrite old evidence to imply new tests were run.

Earlier root-level Markdown files were archived on 2026-10-01. Old source comments that mention those filenames refer to historical sections; use this folder for current requirements.
