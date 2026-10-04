> ARCHIVED on 2026-10-01. Historical reference only; this file is not an active specification.
> Read [the active documentation index](../../README.md) before using any rule or completion claim below.

# Phase 4 — Dashboard

> **Scope:** Replace the Phase 1 placeholder dashboard with the four
> required KPI cards, on a real app shell (sidebar + topbar), with role
> parity for OWNER and EMPLOYEE.

## What landed

### Design system upgrades

| Area | Change |
| --- | --- |
| Brand palette | Replaced generic neutrals with indigo `#4f46e5` → violet `#7c3aed` brand gradient and matching tinted surfaces (`--color-primary-soft`, `--color-primary-ring`). |
| Sidebar palette | New dark neutral palette (`--color-sidebar-*`) so navigation reads as product chrome, not marketing. |
| Gradients | `--gradient-brand`, `--gradient-brand-soft`, plus a mesh gradient hint at the page background. |
| Shadows | Full tiered scale `--shadow-{xs,sm,md,lg,xl}` plus dedicated card shadows `--shadow-card` and `--shadow-card-hover` for the lifted effect. |
| Type | Full scale `--font-size-{xs..3xl}`, weights, and letter-spacing tokens; Inter loaded from Google Fonts. |
| Motion | `--transition-fast/normal/slow` and ease tokens; cards lift on hover with the `card-hover` shadow. |
| Layout | `--layout-sidebar-width`, `--layout-topbar-height`, `--layout-content-max-width` so the shell is sourced from one place. |
| Spacing / radius | Extended `--space-1..16` and `--radius-{xs,sm,md,lg,2xl,full}` so cards feel like a SaaS product, not a generic form. |

### New files (Phase 4 only)

```
src/constants/app.js
src/constants/navigation.js
src/utils/format.js
src/components/icons/DashboardIcon.jsx
src/services/dashboard/dashboardService.js
src/layouts/AppShell/AppShell.jsx
src/layouts/AppShell/AppShell.module.css
src/layouts/AppShell/Topbar.jsx
src/layouts/AppShell/Sidebar.jsx
src/layouts/AppShell/Logo.jsx
src/layouts/AppShell/index.js
src/components/domain/dashboard/StatCard/StatCard.jsx
src/components/domain/dashboard/StatCard/StatCard.module.css
src/components/domain/dashboard/StatCard/index.js
src/components/domain/dashboard/ActivityFeed/ActivityFeed.jsx
src/components/domain/dashboard/ActivityFeed/ActivityFeed.module.css
src/components/domain/dashboard/ActivityFeed/index.js
src/components/domain/dashboard/QuickActions/QuickActions.jsx
src/components/domain/dashboard/QuickActions/QuickActions.module.css
src/components/domain/dashboard/QuickActions/index.js
scripts/smoke-dashboard.mjs
```

### Modified files

```
src/styles/tokens.css              design-token overhaul
src/styles/global.css              Inter Google Font import
src/pages/dashboard/DashboardPage.jsx     full rewrite
src/pages/dashboard/DashboardPage.module.css   full rewrite
src/routes/ProtectedRoute.jsx       wraps children in <AppShell>
src/routes/RoleRoute.jsx            wraps children in <AppShell>
```

## AppShell

The shell lives in `src/layouts/AppShell/`. `ProtectedRoute` and `RoleRoute` now wrap their children in `<AppShell>`, so every authenticated route gets the sidebar + topbar automatically — no per-route opt-in.

- **Desktop (≥1024px)** — fixed dark sidebar on the left, sticky topbar above a centred content column.
- **Mobile (<1024px)** — sidebar collapses into a slide-in drawer with a scrim. Tap a link → drawer closes. `Esc` closes it too. Body scroll is locked while it is open.
- **Topbar** — hamburger (mobile only) + greeting-side greeting in the hero instead, brand clock with date + time, role chip (Owner / Employee / Guest colour-coded), Refresh button, Sign out.
- **Sidebar** — grouped nav (Overview / Sales / Inventory / Procurement / Finance). Each link has a 3px leading accent bar that animates in on the active route. Footer card shows the current user with their initial as an avatar.
- **Role parity (Phase 4 rule)** — the four KPI cards are identical for OWNER and EMPLOYEE. The only role-aware surface in Phase 4 is the sidebar (`filterNavByRole`) and the quick-actions list (OWNER sees an extra "Add stock" shortcut).

## Dashboard composition

```
DashboardPage
├── Hero           greeting + display name + long date
├── 4-up stats     StatCard × 4 (Today’s sales, custom orders, current cash, stock)
└── Two-column split
    ├── ActivityFeed   recent sales + custom-order events
    └── QuickActions   shortcuts (New sale, Add customer, Custom order, + Add stock for OWNER)
```

### StatCard

- Icon badge in a tinted gradient (top-left), label, large tabular-numeral value, delta chip with up/down arrow, and a 7-bar inline SVG sparkline at the bottom.
- The accent prop drives the badge tint. Cash is intentionally highlighted (subtle gradient border) because it is the most-glanced metric for a daily shop.

### ActivityFeed

- 5 mock events with kind-coded icon, title, BDT or unit amount, customer detail, and a `timeAgo` relative timestamp.
- Empty state ("No activity yet today") is wired up even though Phase 4 ships with mock data — so when the real backend lands, the empty state is reachable by code path.
- Skeleton loader is wired but unused in the live page (mock service resolves instantly); kept so the loading contract is documented.

### QuickActions

- 4 actions: New sale (brand), Add customer (info), New custom order (warning), and — for OWNER only — Add stock (success).
- Tile hover lifts the card 1px and intensifies the shadow.

## Mock data

`dashboardService.js` returns a deterministic snapshot so the dashboard does not flicker between renders:

```
Today’s sales                ৳18,750   +12.4%   7-bar trend
Today’s custom orders        4          -20%    7-bar trend
Current cash                 ৳64,320    +7.8%   7-bar trend
Total stock items           1,286       -1.4%   7-bar trend
```

The recent activity list contains 5 events: 4 sales and 1 custom-order payment, with timestamps relative to "now" so the `timeAgo` labels read naturally.

## Role parity assertion

Per FRONTEND_PLAN.md §4, Phase 4 must show **exactly four cards, identical for both roles, no owner extras strip**. Confirmed:

- `DashboardPage.jsx` renders the same four `<StatCard>` instances for both roles.
- There is no role-conditional code path inside the four card slots.
- `quickActions` is the only role-conditional surface and it lives below the cards as a separate panel — not in the KPI strip.

## Accessibility

- `AppShell` `<main>` area has `min-width: 0` to prevent grid blowout from wide tables in future pages.
- All icons are `aria-hidden="true"` because they decorate labels rather than carry meaning.
- Topbar role chip is a plain `<span>` with descriptive text ("Owner" / "Employee" / "Guest") — not a coloured dot that screen readers would skip.
- Activity feed has `aria-labelledby` linking the heading. Loading and error states use `aria-busy` and `role="alert"` respectively.
- Sidebar uses `<NavLink>` from `react-router-dom` so the active route is exposed as `aria-current="page"` automatically.

## Responsive

| Breakpoint | Stats grid | Split (activity + actions) | Drawer |
| --- | --- | --- | --- |
| < 640px | 1 column | 1 column | yes |
| 640px – 1023px | 2 columns | 1 column | yes |
| 1024px – 1099px | 2 columns | 2 columns (2:1) | no, sidebar pinned |
| ≥ 1100px | 4 columns | 2 columns (2:1) | no |

## Verification

```
npm run lint     → 0 errors, 0 warnings
npm run build    → vite v5.4.21
                   index.html    0.47 kB │ gzip:  0.30 kB
                   index-*.css  42.00 kB │ gzip:  8.03 kB
                   index-*.js  213.33 kB │ gzip: 68.69 kB
                   built in 1.26s

node smoke-auth.mjs                          → 8/8 pass (Phase 3 still green)
node scripts/smoke-dashboard.mjs             → 4/4 pass
  ✓ index.html served
  ✓ SPA fallback for /dashboard
  ✓ SPA fallback for /sales
  ✓ JS bundle mentions dashboard strings
```

## Open questions resolved by this phase

None — Phase 4 did not invent any business rules. All visual decisions are within the design-system pass that FRONTEND_PLAN.md reserves for Phase 2 / Phase 15. The plan's §4 "non-inventions" rule is respected:

- No charts (just KPI cards with sparklines).
- No owner-only extras strip.
- No deletion or status toggle on customers (those are Phase 6).
- No 5th or 6th card.

## Known follow-ups (not in Phase 4)

- Phase 5 — Sales flow will reuse the StatCard and ActivityFeed patterns.
- Phase 14 — explicit role pass: walk every page with both roles and verify field-level restrictions.
- Phase 15 — test 360 / 414 / 768 / 1024 / 1280 / 1440 breakpoints on a real device; current breakpoints are 480 / 640 / 1024 / 1100 which cover the common set but the plan asks for six.
- The mock service returns instantly, so the loading skeleton paths are exercised by code but not by UX. Once the real backend lands, the loading state will actually appear.

## How to run

```bash
npm install            # if not done already
npm run dev            # http://localhost:5173/
npm run build          # production bundle in dist/
npm run lint           # eslint, no warnings expected
node smoke-auth.mjs    # Phase 3 auth smoke tests (8 cases)
node scripts/smoke-dashboard.mjs    # Phase 4 bundle smoke tests (4 cases)
```

Login with `owner / 1234` (OWNER) or `employee / 1234` (EMPLOYEE) on `/login`. The dashboard renders the same four cards for both; the sidebar and quick-actions panel are the only surfaces that differ.
