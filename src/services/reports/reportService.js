/**
 * reportService — Phase 13 mock.
 *
 * Implements the read-only report views defined in REQUIREMENTS.md §69-76
 * and the dashboard KPIs in §77-78. Every function is owner-only:
 * employees must NOT see reports (PROJECT_RULES.md §4.2, REQUIREMENTS §79).
 *
 * Architecture:
 *   - Pure aggregation over sibling mock services. No persistence.
 *   - All functions take a `{ actor }` second argument; requireOwner() throws
 *     a { code: 'FORBIDDEN_ROLE' } error when called by a non-owner.
 *   - Date filtering is via the `filters` argument:
 *       { range: 'today' | 'week' | 'month' | 'year' | 'custom',
 *         start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
 *     Defaults to "today" if no range is provided.
 *
 * Real backend will replace this file entirely. The mock surface area is the
 * frozen contract Phase 13 ships.
 */
import { delay } from '../delay.js';
import { ROLES } from '../../constants/roles.js';

import { getSales } from '../sales/salesService.js';
import { getCustomOrders } from '../customOrders/customOrderService.js';
import { getCustomers, getCustomerChildren } from '../customers/customerService.js';
import { getProducts, getStockHistory } from '../products/productService.js';
import { getPurchases } from '../purchases/purchaseService.js';
import { getRawMaterials } from '../rawMaterials/rawMaterialService.js';
import { getExpenses } from '../expenses/expenseService.js';
import { getCashPeriodSummary, getCashReconciliations } from '../cash/cashService.js';
import { cashBusinessDate, cashDateRange } from '../../utils/cashDate.js';

/* -------------------------------------------------------------------------- */
/* Role guard                                                                   */
/* -------------------------------------------------------------------------- */

const OWNER_ROLE = [ROLES.OWNER];

function requireOwner({ actor, action = 'view report' } = {}) {
  if (!actor || !OWNER_ROLE.includes(actor.role)) {
    const err = new Error(
      `Only the owner can ${action}.`,
    );
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/* Date helpers                                                                 */
/* -------------------------------------------------------------------------- */

function isoToDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Resolve a filter spec to a concrete [start, end] window.
 */
export function resolveRange(filters = {}, now = new Date()) {
  return cashDateRange(filters, now);
}

function inRange(iso, [start, end]) {
  const d = isoToDate(iso);
  if (!d) return false;
  return d >= start && d <= end;
}

function ymKey(d) {
  if (!d) return '';
  return cashBusinessDate(d).slice(0, 7);
}

/* -------------------------------------------------------------------------- */
/* 1. Sales reports                                                             */
/* -------------------------------------------------------------------------- */

export async function getSalesSummary(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(120);
  const window = resolveRange(filters);
  const sales = await getSales();
  const matched = sales.filter((s) => inRange(s.createdAt, window));
  const revenue = matched.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const items = matched.reduce(
    (sum, s) =>
      sum + (s.items || []).reduce((sub, i) => sub + Number(i.qty || 0), 0),
    0,
  );
  return {
    range: filters.range || 'today',
    start: window[0].toISOString(),
    end: window[1].toISOString(),
    saleCount: matched.length,
    itemCount: items,
    revenue,
    averageSale: matched.length ? revenue / matched.length : 0,
    sales: matched,
  };
}

export async function getSalesMonthly({ actor } = {}) {
  requireOwner({ actor });
  await delay(140);
  const sales = await getSales();
  const byMonth = new Map();
  for (const s of sales) {
    const k = ymKey(isoToDate(s.createdAt));
    if (!k) continue;
    const cur = byMonth.get(k) || { month: k, count: 0, revenue: 0, items: 0 };
    cur.count += 1;
    cur.revenue += Number(s.total || 0);
    cur.items += (s.items || []).reduce((sub, i) => sub + Number(i.qty || 0), 0);
    byMonth.set(k, cur);
  }
  return Array.from(byMonth.values()).sort((a, b) =>
    a.month < b.month ? 1 : -1,
  );
}

export async function getSalesByProduct(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(140);
  const window = resolveRange(filters);
  const sales = await getSales();
  const byProduct = new Map();
  for (const s of sales) {
    if (!inRange(s.createdAt, window)) continue;
    for (const it of s.items || []) {
      const k = it.productId || it.productName || 'unknown';
      const cur = byProduct.get(k) || {
        productId: it.productId || null,
        productName: it.productName || 'Unknown',
        quantity: 0,
        revenue: 0,
        orders: 0,
      };
      cur.quantity += Number(it.qty || 0);
      cur.revenue += Number(it.qty || 0) * Number(it.price || 0);
      cur.orders += 1;
      byProduct.set(k, cur);
    }
  }
  return Array.from(byProduct.values()).sort((a, b) => b.revenue - a.revenue);
}

export async function getSalesList(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(140);
  const window = resolveRange(filters);
  const sales = await getSales();
  return sales
    .filter((s) => inRange(s.createdAt, window))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* -------------------------------------------------------------------------- */
/* 2. Custom-order reports                                                      */
/* -------------------------------------------------------------------------- */

export async function getCustomOrderStatusCounts(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(120);
  const window = resolveRange(filters);
  const orders = await getCustomOrders();
  const counts = {
    PENDING: 0,
    READY: 0,
    DELIVERED: 0,
    CANCELLED: 0,
  };
  let matched = 0;
  for (const o of orders) {
    if (!inRange(o.createdAt, window)) continue;
    matched += 1;
    counts[o.status] = (counts[o.status] || 0) + 1;
  }
  return { range: filters.range || 'today', total: matched, counts };
}

export async function getCustomOrderOutstandingDues({ actor } = {}) {
  requireOwner({ actor });
  await delay(140);
  const orders = await getCustomOrders();
  const rows = [];
  for (const o of orders) {
    if (o.status === 'CANCELLED' || o.status === 'DELIVERED') continue;
    const paid = (o.payments || []).reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0,
    );
    const due = Math.max(Number(o.total || 0) - paid, 0);
    if (due > 0) {
      rows.push({
        id: o.id,
        code: o.code,
        customerName: o.customerName,
        total: Number(o.total || 0),
        paid,
        due,
        status: o.status,
        dueDate: o.dueDate,
      });
    }
  }
  return rows.sort((a, b) => b.due - a.due);
}

export async function getCustomOrderPaymentsReport(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(140);
  const window = resolveRange(filters);
  const orders = await getCustomOrders();
  const rows = [];
  for (const o of orders) {
    for (const p of o.payments || []) {
      if (!inRange(p.createdAt, window)) continue;
      rows.push({
        id: p.id,
        orderId: o.id,
        orderCode: o.code,
        customerName: o.customerName,
        amount: Number(p.amount || 0),
        method: p.method,
        note: p.note,
        createdBy: p.createdBy,
        createdAt: p.createdAt,
        cashInId: p.cashInId || null,
      });
    }
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* -------------------------------------------------------------------------- */
/* 3. Inventory reports                                                         */
/* -------------------------------------------------------------------------- */

export async function getInventoryCurrent({ actor } = {}) {
  requireOwner({ actor });
  await delay(120);
  const products = await getProducts();
  const rows = products
    .filter((p) => p.isActive)
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      stock: Number(p.stock || 0),
      isActive: p.isActive,
      price: Number(p.price || 0),
      stockValue: Number(p.stock || 0) * Number(p.price || 0),
    }));
  return {
    products: rows,
    totalUnits: rows.reduce((s, r) => s + r.stock, 0),
    totalValue: rows.reduce((s, r) => s + r.stockValue, 0),
  };
}

export async function getStockAdjustmentsReport(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(140);
  const window = resolveRange(filters);
  const products = await getProducts();
  const rows = [];
  for (const p of products) {
    const entries = await getStockHistory(p.id);
    for (const e of entries) {
      if (!inRange(e.createdAt, window)) continue;
      rows.push({
        id: e.id,
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        delta: Number(e.delta || 0),
        reason: e.reason,
        note: e.note,
        createdBy: e.createdBy,
        createdAt: e.createdAt,
      });
    }
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* -------------------------------------------------------------------------- */
/* 4. Customer reports                                                          */
/* -------------------------------------------------------------------------- */

export async function getCustomerListReport({ actor } = {}) {
  requireOwner({ actor });
  await delay(140);
  const customers = await getCustomers();
  return Promise.all(customers.map(async (c) => {
    const children = await getCustomerChildren(c.id);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      initialClass: children.map((child) => child.initialClass).join(', '),
      currentClass: children.map((child) => child.currentClass).join(', '),
      isActive: c.isActive,
      createdBy: c.createdBy,
      createdAt: c.createdAt,
    };
  }));
}

/* -------------------------------------------------------------------------- */
/* 5. Supplier reports                                                          */
/* -------------------------------------------------------------------------- */

export async function getSupplierPurchasesReport(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(140);
  const window = resolveRange(filters);
  const purchases = await getPurchases();
  const rows = [];
  for (const p of purchases) {
    if (!inRange(p.orderedAt || p.createdAt, window)) continue;
    const paid = (p.payments || []).reduce(
      (sum, pay) => sum + Number(pay.amount || 0),
      0,
    );
    rows.push({
      id: p.id,
      code: p.code,
      supplierId: p.supplierId,
      supplierName: p.supplierName,
      status: p.status,
      orderedAt: p.orderedAt,
      receivedAt: p.receivedAt,
      total: Number(p.total || 0),
      paid,
      due: p.status === 'CANCELLED' ? 0 : Math.max(Number(p.total || 0) - paid, 0),
      createdBy: p.createdBy,
      createdAt: p.createdAt,
    });
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getSupplierOutstandingDues({ actor } = {}) {
  requireOwner({ actor });
  await delay(140);
  const purchases = await getPurchases();
  const rows = [];
  for (const p of purchases) {
    if (p.status === 'CANCELLED') continue;
    const paid = (p.payments || []).reduce(
      (sum, pay) => sum + Number(pay.amount || 0),
      0,
    );
    const due = Math.max(Number(p.total || 0) - paid, 0);
    if (due > 0) {
      rows.push({
        purchaseId: p.id,
        code: p.code,
        supplierId: p.supplierId,
        supplierName: p.supplierName,
        total: Number(p.total || 0),
        paid,
        due,
        status: p.status,
        orderedAt: p.orderedAt,
      });
    }
  }
  return rows.sort((a, b) => b.due - a.due);
}

export async function getSupplierWiseTotals({ actor } = {}) {
  requireOwner({ actor });
  await delay(140);
  const purchases = await getPurchases();
  const bySupplier = new Map();
  for (const p of purchases) {
    const k = p.supplierId || p.supplierName || 'unknown';
    const cur = bySupplier.get(k) || {
      supplierId: p.supplierId || null,
      supplierName: p.supplierName || 'Unknown',
      purchases: 0,
      total: 0,
      paid: 0,
      due: 0,
    };
    const paid = (p.payments || []).reduce(
      (sum, pay) => sum + Number(pay.amount || 0),
      0,
    );
    cur.purchases += 1;
    cur.total += Number(p.total || 0);
    cur.paid += paid;
    if (p.status !== 'CANCELLED') cur.due += Math.max(Number(p.total || 0) - paid, 0);
    bySupplier.set(k, cur);
  }
  return Array.from(bySupplier.values()).sort((a, b) => b.total - a.total);
}

export async function getSupplierPaymentHistory(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(140);
  const window = resolveRange(filters);
  const purchases = await getPurchases();
  const rows = [];
  for (const p of purchases) {
    for (const pay of p.payments || []) {
      if (!inRange(pay.createdAt, window)) continue;
      rows.push({
        id: pay.id,
        purchaseId: p.id,
        purchaseCode: p.code,
        supplierId: p.supplierId,
        supplierName: p.supplierName,
        amount: Number(pay.amount || 0),
        method: pay.method,
        note: pay.note,
        createdBy: pay.createdBy,
        createdAt: pay.createdAt,
      });
    }
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* -------------------------------------------------------------------------- */
/* 6. Raw-materials reports                                                     */
/* -------------------------------------------------------------------------- */

export async function getRawMaterialsReport(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(140);
  const window = resolveRange(filters);
  const rows = await getRawMaterials();
  return rows
    .filter((r) => {
      if (!r.date) return false;
      const d = new Date(r.date);
      return d >= window[0] && d <= window[1];
    })
    .map((r) => ({
      id: r.id,
      itemName: r.itemName,
      quantity: r.quantity,
      date: r.date,
      description: r.description,
      purchaseCost: r.purchaseCost,
      createdBy: r.createdBy,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/* -------------------------------------------------------------------------- */
/* 7. Expense reports                                                           */
/* -------------------------------------------------------------------------- */

function bucketByYM(rows, getDate, getAmount) {
  const map = new Map();
  for (const r of rows) {
    const d = new Date(getDate(r));
    if (Number.isNaN(d.getTime())) continue;
    const key = ymKey(d);
    map.set(key, (map.get(key) || 0) + Number(getAmount(r) || 0));
  }
  return Array.from(map.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));
}

export async function getExpensesListReport(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(140);
  const window = resolveRange(filters);
  const expenses = await getExpenses();
  return expenses
    .filter((e) => {
      if (!e.expenseDate) return false;
      const d = new Date(e.expenseDate);
      return d >= window[0] && d <= window[1];
    })
    .map((e) => ({
      id: e.id,
      categoryName: e.categoryName,
      amount: Number(e.amount || 0),
      expenseDate: e.expenseDate,
      description: e.description,
      notes: e.notes,
      createdBy: e.createdBy,
      createdAt: e.createdAt,
    }))
    .sort((a, b) => (a.expenseDate < b.expenseDate ? 1 : -1));
}

export async function getExpensesMonthly({ actor } = {}) {
  requireOwner({ actor });
  await delay(140);
  const expenses = await getExpenses();
  const rows = bucketByYM(expenses, (e) => e.expenseDate, (e) => e.amount);
  return rows.slice(0, 12);
}

export async function getExpensesYearly({ actor } = {}) {
  requireOwner({ actor });
  await delay(140);
  const expenses = await getExpenses();
  const map = new Map();
  for (const e of expenses) {
    const d = new Date(e.expenseDate);
    if (Number.isNaN(d.getTime())) continue;
    const key = cashBusinessDate(d).slice(0, 4);
    map.set(key, (map.get(key) || 0) + Number(e.amount || 0));
  }
  return Array.from(map.entries())
    .map(([year, total]) => ({ year, total }))
    .sort((a, b) => (a.year < b.year ? 1 : -1));
}

export async function getExpensesByCategory(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(140);
  const window = resolveRange(filters);
  const expenses = await getExpenses();
  const rows = expenses
    .filter((e) => {
      if (!e.expenseDate) return false;
      const d = new Date(e.expenseDate);
      return d >= window[0] && d <= window[1];
    })
    .reduce((acc, e) => {
      const k = e.categoryName || 'Uncategorised';
      const cur = acc.get(k) || {
        categoryName: k,
        total: 0,
        count: 0,
      };
      cur.total += Number(e.amount || 0);
      cur.count += 1;
      acc.set(k, cur);
      return acc;
    }, new Map());
  return Array.from(rows.values()).sort((a, b) => b.total - a.total);
}

/* -------------------------------------------------------------------------- */
/* 8. Cash reports                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Opening cash balance for the window.
 *
 * Derived from all movements before the selected shop-local period.
 */
export async function getCashOpening(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(60);
  return {
    opening: getCashPeriodSummary(filters, { actor }).opening,
    derivedFrom: 'closing-balance',
    note: 'Opening is carried forward from all earlier cash movements (Asia/Dhaka).',
  };
}

export async function getCashInReport(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(120);
  return getCashPeriodSummary(filters, { actor }).rows
    .filter((r) => r.type === 'CASH_IN')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCashOutReport(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(120);
  return getCashPeriodSummary(filters, { actor }).rows
    .filter((r) => r.type === 'CASH_OUT')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCashAdjustmentsReport(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(40);
  return {
    rows: getCashPeriodSummary(filters, { actor }).rows.filter((row) => row.type === 'CASH_ADJUSTMENT'),
    reconciliations: (await getCashReconciliations({}, { actor })).filter((row) => inRange(row.countedAt, cashDateRange(filters))),
    note: 'Counts are saved even when cash matches. Only explicitly applied adjustments change cash.',
  };
}

export async function getCashExpected(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(120);
  return {
    ...getCashPeriodSummary(filters, { actor }),
    note: 'Closing = carried opening + initial setup in period + cash in − cash out + signed adjustments. Dates use Asia/Dhaka.',
  };
}

/* -------------------------------------------------------------------------- */
/* 9. Profit report                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Profit by period.
 *
 * Product profit = sales revenue - sale-time product purchase cost.
 * Expenses are separate and never deducted here. Missing historical
 * snapshots make the full profit unavailable; the known-cost subtotal
 * covers only lines whose sale-time cost is known.
 *
 * Pure derived figure: it never auto-creates entries.
 */
export async function getProfitReport(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(160);
  const window = resolveRange(filters);
  const sales = await getSales();

  const matchedSales = sales.filter((s) => inRange(s.createdAt, window));

  let revenue = 0;
  let knownCogs = 0;
  let knownRevenue = 0;
  let missingCogsLines = 0;
  let totalCogsLines = 0;
  const byProduct = new Map();

  for (const s of matchedSales) {
    revenue += Number(s.total || 0);
    for (const it of s.items || []) {
      totalCogsLines += 1;
      const qty = Number(it.qty || 0);
      const revenueLine = qty * Number(it.price || 0);
      const key = it.productId || it.productName || 'unknown';
      const row = byProduct.get(key) || {
        productId: it.productId || null,
        productName: it.productName || 'Unknown',
        quantity: 0, revenue: 0, knownRevenue: 0, knownCogs: 0,
        missingCogsLines: 0,
      };
      row.quantity += qty;
      row.revenue += revenueLine;
      const cost = it.purchaseCostAtSale;
      if (cost != null && Number.isFinite(Number(cost)) && Number(cost) >= 0) {
        const cogsLine = qty * Number(cost);
        knownCogs += cogsLine;
        knownRevenue += revenueLine;
        row.knownCogs += cogsLine;
        row.knownRevenue += revenueLine;
      } else {
        missingCogsLines += 1;
        row.missingCogsLines += 1;
      }
      byProduct.set(key, row);
    }
  }

  const knownCostSubtotal = knownRevenue - knownCogs;
  const complete = missingCogsLines === 0;

  return {
    range: filters.range || 'today',
    start: window[0].toISOString(),
    end: window[1].toISOString(),
    saleCount: matchedSales.length,
    revenue,
    cogs: knownCogs,
    knownRevenue,
    knownCostSubtotal,
    profit: complete ? revenue - knownCogs : null,
    partialProfit: complete ? null : knownCostSubtotal,
    missingCogsLines,
    totalCogsLines,
    complete,
    products: Array.from(byProduct.values()).map((row) => ({
      ...row,
      cogs: row.missingCogsLines === 0 ? row.knownCogs : null,
      profit: row.missingCogsLines === 0 ? row.revenue - row.knownCogs : null,
      hasPurchasePrice: row.missingCogsLines === 0,
    })).sort((a, b) => b.revenue - a.revenue),
  };
}
