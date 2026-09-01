/**
 * Mock dashboard service — Phase 4.
 *
 * Returns the four KPI stats for the dashboard plus a few extras
 * (recent activity, quick actions) that the dashboard page renders.
 *
 * Every method is async and uses the shared `delay` helper so the
 * loading states can be exercised just like the real backend will be
 * once Phase 5+ lands.
 *
 * Numbers are illustrative and intentionally plausible for a clothing
 * shop in Bangladesh. They are deterministic so the dashboard never
 * flickers between renders. Tomorrow's data is implied by the deltas.
 */
import { delay } from '../delay.js';
import { ROLES } from '../../constants/roles.js';
import { getCurrentCash } from '../cash/cashService.js';

/**
 * Today's headline KPI numbers, returned as an array of cards.
 *
 * Each card carries the full shape <StatCard> needs:
 *   { id, value, delta, trend }
 *
 * The page looks up specific ids (`today-sales`, `today-custom-orders`,
 * `current-cash`, `total-stock-items`) — that's how it stays robust if
 * the order changes.
 *
 * Trend values are absolute (BDT or count), not normalised — the
 * sparkline component normalises them on render.
 *
 * `current-cash` is sourced from the shared cash ledger (Phase 12) so
 * the dashboard KPI never drifts from the Cash Management page.
 */
function getTodayStats() {
  const currentCash = getCurrentCash();
  return [
    {
      id: 'today-sales',
      value: 18_750,             // BDT earned today via Sales
      delta: 0.124,              // +12.4% vs yesterday
      trend: [8200, 9400, 11100, 9800, 12400, 14200, 18750],
    },
    {
      id: 'today-custom-orders',
      value: 4,                  // count of new orders taken today
      delta: -0.20,              // -20% vs yesterday
      trend: [3, 5, 6, 4, 7, 5, 4],
    },
    {
      id: 'current-cash',
      value: currentCash,        // Derived from cash ledger (Phase 12)
      delta: 0.078,
      trend: [42100, 45200, 48900, 51200, 55600, 59300, currentCash],
    },
    {
      id: 'total-stock-items',
      value: 1_286,              // total pieces across all SKUs
      delta: -0.014,
      trend: [1310, 1305, 1298, 1302, 1294, 1290, 1286],
    },
  ];
}

/**
 * Activity feed — most recent first.
 */
function getRecentActivity() {
  return [
    {
      id: 'a1',
      kind: 'sale',
      title: 'Sale S-20250901-0014',
      detail: 'Anika Tabassum \u00b7 3 items',
      amount: 1_650,
      at: '2026-09-01T11:24:00Z',
    },
    {
      id: 'a2',
      kind: 'custom_order',
      title: 'Custom order CO-20250901-0008',
      detail: 'Tahmid Hossain \u00b7 Salwar set, advance collected',
      amount: 800,
      at: '2026-09-01T10:48:00Z',
    },
    {
      id: 'a3',
      kind: 'sale',
      title: 'Sale S-20250901-0013',
      detail: 'Walk-in \u00b7 Shirt + Pant',
      amount: 720,
      at: '2026-09-01T10:11:00Z',
    },
    {
      id: 'a4',
      kind: 'custom_order',
      title: 'Custom order CO-20250901-0007',
      detail: 'Mst. Rafa \u00b7 Frock, due on 12 Sep',
      amount: 0,
      at: '2026-09-01T09:32:00Z',
    },
    {
      id: 'a5',
      kind: 'sale',
      title: 'Sale S-20250901-0012',
      detail: 'Sabbir Ahmed \u00b7 2 items',
      amount: 1_240,
      at: '2026-09-01T09:02:00Z',
    },
  ];
}

/**
 * Quick actions — surfaced as a small grid on the dashboard.
 * The `roles` array controls who can see each action.
 */
function getQuickActions(role) {
  const base = [
    { id: 'new-sale', label: 'New sale', path: '/sales/new', tone: 'brand' },
    { id: 'new-customer', label: 'Add customer', path: '/customers/new', tone: 'info' },
    { id: 'new-order', label: 'Custom order', path: '/custom-orders/new', tone: 'warning' },
  ];
  if (role === ROLES.OWNER) {
    base.push({ id: 'add-stock', label: 'Add stock', path: '/products', tone: 'success' });
  }
  return base;
}

/**
 * Single call that bundles everything the dashboard needs.
 * Mocked to be deterministic; in Phase 5+ the backend will compose
 * real queries.
 */
export async function getDashboardSnapshot(role) {
  await delay(180);
  return {
    generatedAt: new Date().toISOString(),
    stats: getTodayStats(),
    activity: getRecentActivity(),
    quickActions: getQuickActions(role),
  };
}