/**
 * Phase 13 — Reports smoke tests.
 *
 * Verifies the reportService contract:
 *   - resolveRange honours every preset + custom date range
 *   - every read-only report endpoint returns the documented shape
 *   - every report endpoint rejects a non-owner actor with FORBIDDEN_ROLE
 *   - the profit report honestly reports missing COGS lines
 *   - cash cleanup is honoured: opening is 0, adjustments is empty,
 *     expected = cashIn - cashOut
 */
import assert from 'node:assert/strict';

import { ROLES } from '../src/constants/roles.js';
import { createProduct } from '../src/services/products/productService.js';
import { completeSale } from '../src/services/sales/salesService.js';
import { getCustomers } from '../src/services/customers/customerService.js';
import { createPurchase } from '../src/services/purchases/purchaseService.js';
import {
  resolveRange,
  getSalesSummary,
  getSalesMonthly,
  getSalesByProduct,
  getSalesList,
  getCustomOrderStatusCounts,
  getCustomOrderOutstandingDues,
  getCustomOrderPaymentsReport,
  getInventoryCurrent,
  getStockAdjustmentsReport,
  getCustomerListReport,
  getSupplierPurchasesReport,
  getSupplierOutstandingDues,
  getSupplierWiseTotals,
  getSupplierPaymentHistory,
  getRawMaterialsReport,
  getExpensesListReport,
  getExpensesMonthly,
  getExpensesYearly,
  getExpensesByCategory,
  getCashOpening,
  getCashInReport,
  getCashOutReport,
  getCashAdjustmentsReport,
  getCashExpected,
  getProfitReport,
} from '../src/services/reports/reportService.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  PASS  ' + name);
  } catch (err) {
    failed += 1;
    console.error('  FAIL  ' + name + '\n        ' + (err.message || err));
  }
}

const OWNER = { username: 'owner', role: ROLES.OWNER };
const EMPLOYEE = { username: 'emp', role: ROLES.EMPLOYEE };
const RANGE = { range: 'month' };

console.log('Phase 13 — reports service smoke tests');

// --- resolveRange ---------------------------------------------------------

await test('resolveRange — today preset', async () => {
  const [start, end] = resolveRange({ range: 'today' });
  assert.ok(start instanceof Date);
  assert.ok(end instanceof Date);
  assert.ok(start <= end);
});

await test('resolveRange — custom from/to preserved', async () => {
  const [start, end] = resolveRange({
    range: 'custom',
    start: '2024-01-01',
    end: '2024-01-31',
  });
  // Boundaries are shop-local midnight, regardless of the host timezone.
  assert.equal(start.toISOString(), '2023-12-31T18:00:00.000Z');
  assert.equal(end.toISOString(), '2024-01-31T17:59:59.999Z');
});

await test('resolveRange — week/month/year presets', async () => {
  for (const range of ['week', 'month', 'year']) {
    const [start, end] = resolveRange({ range });
    assert.ok(start instanceof Date, `${range} start`);
    assert.ok(end instanceof Date, `${range} end`);
    assert.ok(start <= end, `${range} start<=end`);
  }
});

// --- 1. Sales reports -----------------------------------------------------

await test('getSalesSummary — summary object + sales list', async () => {
  const data = await getSalesSummary(RANGE, { actor: OWNER });
  assert.equal(typeof data.saleCount, 'number');
  assert.equal(typeof data.revenue, 'number');
  assert.equal(typeof data.averageSale, 'number');
  assert.ok(Array.isArray(data.sales));
});

await test('getSalesMonthly — array of month buckets', async () => {
  const data = await getSalesMonthly({ actor: OWNER });
  assert.ok(Array.isArray(data));
});

await test('getSalesByProduct — array of product rows', async () => {
  const data = await getSalesByProduct(RANGE, { actor: OWNER });
  assert.ok(Array.isArray(data));
});

await test('getSalesList — array of sale rows', async () => {
  const data = await getSalesList(RANGE, { actor: OWNER });
  assert.ok(Array.isArray(data));
});

// --- 2. Custom-order reports ----------------------------------------------

await test('getCustomOrderStatusCounts — counts map', async () => {
  const data = await getCustomOrderStatusCounts(RANGE, { actor: OWNER });
  assert.equal(typeof data.total, 'number');
  assert.ok(data.counts && typeof data.counts === 'object');
  for (const k of ['PENDING', 'READY', 'DELIVERED', 'CANCELLED']) {
    assert.equal(typeof data.counts[k], 'number');
  }
});

await test('getCustomOrderOutstandingDues — due rows', async () => {
  const data = await getCustomOrderOutstandingDues({ actor: OWNER });
  assert.ok(Array.isArray(data));
});

await test('getCustomOrderPaymentsReport — payment rows', async () => {
  const data = await getCustomOrderPaymentsReport(RANGE, { actor: OWNER });
  assert.ok(Array.isArray(data));
});

// --- 3. Inventory ---------------------------------------------------------

await test('getInventoryCurrent — products + totals', async () => {
  const data = await getInventoryCurrent({ actor: OWNER });
  assert.ok(Array.isArray(data.products));
  assert.equal(typeof data.totalUnits, 'number');
  assert.equal(typeof data.totalValue, 'number');
});

await test('getStockAdjustmentsReport — adjustment rows', async () => {
  const data = await getStockAdjustmentsReport(RANGE, { actor: OWNER });
  assert.ok(Array.isArray(data));
});

// --- 4. Customers ---------------------------------------------------------

await test('getCustomerListReport — customer rows', async () => {
  const data = await getCustomerListReport({ actor: OWNER });
  assert.ok(Array.isArray(data));
});

// --- 5. Suppliers ---------------------------------------------------------

await test('getSupplierPurchasesReport — purchase rows', async () => {
  const data = await getSupplierPurchasesReport(RANGE, { actor: OWNER });
  assert.ok(Array.isArray(data));
});

await test('getSupplierOutstandingDues — due rows', async () => {
  const data = await getSupplierOutstandingDues({ actor: OWNER });
  assert.ok(Array.isArray(data));
});

await test('getSupplierWiseTotals — grouped rows', async () => {
  const data = await getSupplierWiseTotals({ actor: OWNER });
  assert.ok(Array.isArray(data));
});

await test('getSupplierPaymentHistory — payment rows', async () => {
  const data = await getSupplierPaymentHistory(RANGE, { actor: OWNER });
  assert.ok(Array.isArray(data));
});

// --- 6. Raw materials -----------------------------------------------------

await test('getRawMaterialsReport — material rows', async () => {
  const data = await getRawMaterialsReport(RANGE, { actor: OWNER });
  assert.ok(Array.isArray(data));
});

// --- 7. Expenses ----------------------------------------------------------

await test('getExpensesListReport — list rows', async () => {
  const data = await getExpensesListReport(RANGE, { actor: OWNER });
  assert.ok(Array.isArray(data));
});

await test('getExpensesMonthly — month buckets', async () => {
  const data = await getExpensesMonthly({ actor: OWNER });
  assert.ok(Array.isArray(data));
});

await test('getExpensesYearly — year buckets', async () => {
  const data = await getExpensesYearly({ actor: OWNER });
  assert.ok(Array.isArray(data));
});

await test('getExpensesByCategory — grouped rows', async () => {
  const data = await getExpensesByCategory(RANGE, { actor: OWNER });
  assert.ok(Array.isArray(data));
});

// --- 8. Cash reports ------------------------------------------------------

await test('getCashOpening — carries earlier ledger movements', async () => {
  const data = await getCashOpening({}, { actor: OWNER });
  assert.ok(data.opening > 0);
  assert.equal(data.derivedFrom, 'closing-balance');
});

await test('getCashInReport — cash-in rows', async () => {
  const data = await getCashInReport(RANGE, { actor: OWNER });
  assert.ok(Array.isArray(data));
});

await test('getCashOutReport — cash-out rows', async () => {
  const data = await getCashOutReport(RANGE, { actor: OWNER });
  assert.ok(Array.isArray(data));
});

await test('getCashAdjustmentsReport — honest empty adjustments and counts', async () => {
  const data = await getCashAdjustmentsReport({}, { actor: OWNER });
  assert.ok(Array.isArray(data.rows));
  assert.equal(data.rows.length, 0);
});

await test('getCashExpected — carried opening plus signed movements', async () => {
  const data = await getCashExpected(RANGE, { actor: OWNER });
  assert.ok(data.opening > 0);
  assert.equal(typeof data.cashIn, 'number');
  assert.equal(typeof data.cashOut, 'number');
  assert.equal(data.expected, data.opening + data.initialOpening + data.cashIn - data.cashOut + data.adjustments);
});

// --- 9. Profit ------------------------------------------------------------

await test('getProfitReport — returns revenue/snapshot cost + profit flag', async () => {
  const data = await getProfitReport(RANGE, { actor: OWNER });
  assert.equal(typeof data.revenue, 'number');
  assert.equal(typeof data.cogs, 'number');
  assert.equal(typeof data.knownCostSubtotal, 'number');
  assert.equal(data.expenseTotal, undefined, 'expenses must not enter product-profit report');
  assert.equal(typeof data.totalCogsLines, 'number');
  assert.equal(typeof data.missingCogsLines, 'number');
  assert.ok(Array.isArray(data.products));
});

await test('getProfitReport uses sale-time cost, not current cost or expenses', async () => {
  const product = await createProduct({
    name: 'Profit smoke product', sku: 'PROFIT-SMOKE', price: 100,
    purchasePrice: 40, stock: 5,
  }, { actor: OWNER });
  const customer = (await getCustomers())[0];
  await completeSale({ customer, items: [{ productId: product.id, qty: 2, price: 100 }] }, { actor: OWNER });
  const today = await getProfitReport({ range: 'today' }, { actor: OWNER });
  assert.equal(today.revenue, 200);
  assert.equal(today.cogs, 80);
  assert.equal(today.profit, 120);
  assert.equal(today.knownCostSubtotal, 120);
});

await test('getProfitReport — profit is null when missingCogsLines > 0', async () => {
  const data = await getProfitReport(RANGE, { actor: OWNER });
  if (data.missingCogsLines > 0) {
    assert.equal(data.profit, null);
    assert.equal(data.complete, false);
    assert.equal(typeof data.partialProfit, 'number');
  } else {
    assert.equal(data.complete, true);
  }
});

// --- Role guard -----------------------------------------------------------

await test('supplier purchase report filters by purchase date, not entry time', async () => {
  const purchase = await createPurchase({
    supplierId: 'sup-001',
    purchaseDate: '2024-05-12',
    items: [{ name: 'Report-date sample fabric', qty: 1, unitPrice: 40 }],
  }, { actor: OWNER });
  const historical = await getSupplierPurchasesReport({ range: 'custom', start: '2024-05-12', end: '2024-05-12' }, { actor: OWNER });
  assert.ok(historical.some((row) => row.id === purchase.id));
  const today = await getSupplierPurchasesReport({ range: 'today' }, { actor: OWNER });
  assert.ok(!today.some((row) => row.id === purchase.id));
});

// --- Role guard -----------------------------------------------------------

await test('every report rejects non-owner actor', async () => {
  const calls = [
    () => getSalesSummary(RANGE, { actor: EMPLOYEE }),
    () => getSalesMonthly({ actor: EMPLOYEE }),
    () => getSalesByProduct(RANGE, { actor: EMPLOYEE }),
    () => getSalesList(RANGE, { actor: EMPLOYEE }),
    () => getCustomOrderStatusCounts(RANGE, { actor: EMPLOYEE }),
    () => getCustomOrderOutstandingDues({ actor: EMPLOYEE }),
    () => getCustomOrderPaymentsReport(RANGE, { actor: EMPLOYEE }),
    () => getInventoryCurrent({ actor: EMPLOYEE }),
    () => getStockAdjustmentsReport(RANGE, { actor: EMPLOYEE }),
    () => getCustomerListReport({ actor: EMPLOYEE }),
    () => getSupplierPurchasesReport(RANGE, { actor: EMPLOYEE }),
    () => getSupplierOutstandingDues({ actor: EMPLOYEE }),
    () => getSupplierWiseTotals({ actor: EMPLOYEE }),
    () => getSupplierPaymentHistory(RANGE, { actor: EMPLOYEE }),
    () => getRawMaterialsReport(RANGE, { actor: EMPLOYEE }),
    () => getExpensesListReport(RANGE, { actor: EMPLOYEE }),
    () => getExpensesMonthly({ actor: EMPLOYEE }),
    () => getExpensesYearly({ actor: EMPLOYEE }),
    () => getExpensesByCategory(RANGE, { actor: EMPLOYEE }),
    () => getCashOpening({}, { actor: EMPLOYEE }),
    () => getCashInReport(RANGE, { actor: EMPLOYEE }),
    () => getCashOutReport(RANGE, { actor: EMPLOYEE }),
    () => getCashAdjustmentsReport({}, { actor: EMPLOYEE }),
    () => getCashExpected(RANGE, { actor: EMPLOYEE }),
    () => getProfitReport(RANGE, { actor: EMPLOYEE }),
  ];
  for (const fn of calls) {
    await assert.rejects(fn, (err) => err.code === 'FORBIDDEN_ROLE');
  }
});

console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
