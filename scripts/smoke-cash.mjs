/**
 * Phase 12 — Cash Management smoke tests.
 *
 * Asserts the public API of cashService and cross-module invariants:
 *   - getCashEntries returns sorted array, never includes supplier payments
 *   - getCurrentCash reflects the running balance of CASH_IN minus CASH_OUT
 *   - addCashIn / addCashOut are owner-only
 *   - addCashIn / addCashOut reject bad amounts and short reasons
 *   - CRITICAL: sale completion mirrors a CASH_IN row into the shared ledger
 *   - CRITICAL: custom-order payment mirrors a CASH_IN row into the shared ledger
 *   - CRITICAL: creating an expense does NOT touch the cash ledger
 *   - CRITICAL: recording a supplier payment does NOT touch the cash ledger
 *   - CASH_REFERENCE_LABELS exposes the documented kinds
 */
import assert from 'node:assert/strict';

import { ROLES } from '../src/constants/roles.js';
import {
  getCashEntries,
  getCurrentCash,
  addCashIn,
  addCashOut,
  CASH_REFERENCE_LABELS,
  getCashSnapshot,
  setInitialCash,
  saveCashReconciliation,
  applyCashReconciliation,
  getCashReconciliations,
  getCashPeriodSummary,
} from '../src/services/cash/cashService.js';
import { cashBusinessDate, cashDateRange } from '../src/utils/cashDate.js';
import { getCashExpected, getCashAdjustmentsReport } from '../src/services/reports/reportService.js';

import { completeSale } from '../src/services/sales/salesService.js';
import { getProducts } from '../src/services/products/productService.js';
import { recordCustomOrderPayment, createCustomOrder } from '../src/services/customOrders/customOrderService.js';
import { createExpense, getExpenseCategories } from '../src/services/expenses/expenseService.js';
import { recordPurchasePayment, createPurchase, setPurchaseStatus } from '../src/services/purchases/purchaseService.js';

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

const OWNER = { actor: { username: 'owner', role: ROLES.OWNER } };
const EMPLOYEE = { actor: { username: 'employee', role: ROLES.EMPLOYEE } };

await test('empty daily cash out is positive zero', async () => {
  const summary = getCashPeriodSummary({}, OWNER);
  assert.ok(Object.is(summary.cashOut, 0));
});

await test('getCashEntries returns sorted array', async () => {
  const entries = await getCashEntries();
  assert.ok(Array.isArray(entries));
  for (let i = 1; i < entries.length; i += 1) {
    assert.ok(
      new Date(entries[i - 1].createdAt) >= new Date(entries[i].createdAt),
      'expected newest-first',
    );
  }
});

await test('getCashEntries never includes supplier payments', async () => {
  const entries = await getCashEntries();
  for (const row of entries) {
    assert.notEqual(row.referenceType, 'SUPPLIER_PAYMENT');
  }
});

await test('getCurrentCash returns a number', async () => {
  const current = getCurrentCash();
  assert.equal(typeof current, 'number');
});

await test('addCashIn rejects EMPLOYEE', async () => {
  await assert.rejects(
    () => addCashIn({ amount: 100, reason: 'top up' }, EMPLOYEE),
    /owner/i,
  );
});

await test('addCashIn rejects zero amount', async () => {
  await assert.rejects(
    () => addCashIn({ amount: 0, reason: 'top up' }, OWNER),
    /amount/i,
  );
});

await test('addCashIn rejects short reason', async () => {
  await assert.rejects(
    () => addCashIn({ amount: 100, reason: 'no' }, OWNER),
    /reason/i,
  );
});

await test('addCashIn happy path increases current cash', async () => {
  const before = getCurrentCash();
  const row = await addCashIn(
    { amount: 250, reason: 'smoke top-up', referenceType: 'MANUAL' },
    OWNER,
  );
  assert.ok(row.id);
  assert.equal(row.referenceType, 'MANUAL');
  assert.equal(row.type, 'CASH_IN');
  const after = getCurrentCash();
  assert.equal(after, before + 250);
});

await test('addCashOut rejects EMPLOYEE', async () => {
  await assert.rejects(
    () => addCashOut({ amount: 100, reason: 'petty cash' }, EMPLOYEE),
    /owner/i,
  );
});

await test('addCashOut rejects short reason', async () => {
  await assert.rejects(
    () => addCashOut({ amount: 100, reason: 'x' }, OWNER),
    /reason/i,
  );
});

await test('addCashOut happy path decreases current cash', async () => {
  const before = getCurrentCash();
  await addCashOut({ amount: 80, reason: 'smoke petty cash' }, OWNER);
  const after = getCurrentCash();
  assert.equal(after, before - 80);
});

await test('CASH_REFERENCE_LABELS exposes documented kinds', async () => {
  assert.ok(CASH_REFERENCE_LABELS.SALE);
  assert.ok(CASH_REFERENCE_LABELS.CUSTOM_ORDER_PAYMENT);
  assert.ok(CASH_REFERENCE_LABELS.MANUAL);
});

await test('CRITICAL: sale completion mirrors a CASH_IN row into the shared ledger', async () => {
  const before = getCurrentCash();
  const product = (await getProducts()).find((row) => row.isActive && row.stock > 0);
  assert.ok(product, 'expected an in-stock canonical product');
  const { sale, cashIn } = await completeSale(
    {
      customer: { id: 'cust-001', name: 'Anika Tabassum' },
      items: [{ productId: product.id, qty: 1, price: product.price }],
    },
    EMPLOYEE,
  );
  assert.ok(sale.id);
  assert.equal(cashIn, null, 'employee response must not expose cash ledger rows');

  const after = getCurrentCash();
  assert.equal(after, before + product.price, 'cash must grow by sale total');

  const entries = await getCashEntries();
  assert.ok(entries.some((e) => e.referenceType === 'SALE' && e.referenceId === sale.id));
});

await test('CRITICAL: custom-order payment mirrors a CASH_IN row into the shared ledger', async () => {
  const order = await createCustomOrder(
    {
      customerId: 'cust-001',
      customerName: 'Anika Tabassum',
      productName: 'Salwar set',
      qty: 1,
      unitPrice: 2000,
      dueDate: '2099-10-20',
    },
    OWNER,
  );
  const before = getCurrentCash();
  const { cashIn } = await recordCustomOrderPayment(
    order.id,
    { amount: 1000, note: 'advance' },
    OWNER,
  );
  assert.ok(cashIn.id);
  assert.equal(cashIn.referenceType, 'CUSTOM_ORDER_PAYMENT');
  const after = getCurrentCash();
  assert.equal(after, before + 1000);
});

await test('CRITICAL: expense creation does NOT touch the cash ledger', async () => {
  const before = getCurrentCash();
  const cashBefore = await getCashEntries();
  const cats = await getExpenseCategories(OWNER);
  await createExpense(
    { categoryId: cats[0].id, amount: 4321, expenseDate: '2026-09-15', description: 'no-cash guard' },
    OWNER,
  );
  const after = getCurrentCash();
  const cashAfter = await getCashEntries(OWNER);
  assert.equal(after, before);
  assert.equal(cashAfter.length, cashBefore.length);
});

await test('CRITICAL: supplier payment does NOT touch the cash ledger', async () => {
  const before = getCurrentCash();
  const cashBefore = await getCashEntries();
  const purchase = await createPurchase(
    {
      supplierId: 'sup-001',
      date: '2026-09-15',
      items: [{ name: 'Smoke fabric', qty: 1, unitPrice: 999 }],
    },
    OWNER,
  );
  await setPurchaseStatus(purchase.id, 'ORDERED', OWNER);
  await recordPurchasePayment(
    purchase.id,
    { amount: 999, date: '2026-09-15', note: 'smoke payment' },
    OWNER,
  );
  const after = getCurrentCash();
  const cashAfter = await getCashEntries();
  assert.equal(after, before);
  assert.equal(cashAfter.length, cashBefore.length);
  for (const row of cashAfter) {
    assert.notEqual(row.referenceType, 'SUPPLIER_PAYMENT');
  }
});

await test('cash dates use Dhaka midnight and validate calendar dates', async () => {
  assert.equal(cashBusinessDate('2026-09-30T18:00:00Z'), '2026-10-01');
  const [start, end] = cashDateRange({ preset: 'custom', from: '2026-10-01', to: '2026-10-01' });
  assert.equal(start.toISOString(), '2026-09-30T18:00:00.000Z');
  assert.equal(end.toISOString(), '2026-10-01T17:59:59.999Z');
  assert.throws(() => cashDateRange({ from: '2026-02-30' }), /invalid/i);
});

await test('cash reconciliation and snapshot reject Employee', async () => {
  for (const operation of [
    () => getCashSnapshot(EMPLOYEE), () => getCashReconciliations({}, EMPLOYEE),
    () => setInitialCash({ amount: 0 }, EMPLOYEE),
    () => saveCashReconciliation({ physicalCash: 0 }, EMPLOYEE),
    () => applyCashReconciliation('missing', { confirmed: true, reason: 'test' }, EMPLOYEE),
  ]) await assert.rejects(operation, (error) => error.code === 'FORBIDDEN_ROLE');
});

await test('initial setup records zero once and reconciliation requires setup', async () => {
  await assert.rejects(() => saveCashReconciliation({ physicalCash: 0 }, OWNER), /initial opening/i);
  const before = getCurrentCash();
  const row = await setInitialCash({ amount: 0 }, OWNER);
  assert.equal(row.type, 'OPENING');
  assert.equal(row.amount, 0);
  assert.equal(getCurrentCash(), before);
  await assert.rejects(() => setInitialCash({ amount: 10 }, OWNER), /already recorded/i);
});

await test('matched count is saved and retries do not duplicate observations', async () => {
  const before = getCurrentCash();
  const snapshot = await getCashSnapshot(OWNER);
  const payload = { physicalCash: before, ledgerVersion: snapshot.ledgerVersion, idempotencyKey: 'matched' };
  const [first, retry] = await Promise.all([saveCashReconciliation(payload, OWNER), saveCashReconciliation(payload, OWNER)]);
  assert.equal(first.id, retry.id);
  assert.equal(first.difference, 0);
  assert.equal(first.status, 'MATCHED');
  assert.equal((await getCashReconciliations({}, OWNER)).length, 1);
  assert.equal(getCurrentCash(), before);
  await assert.rejects(() => applyCashReconciliation(first.id, { confirmed: true, reason: 'matched' }, OWNER), /no adjustment/i);
  await assert.rejects(() => saveCashReconciliation({ ...payload, physicalCash: before + 1 }, OWNER), /different values/i);
});

await test('blank/negative counts fail without a new record', async () => {
  const before = (await getCashReconciliations({}, OWNER)).length;
  for (const value of ['', null, -1, 'invalid']) {
    await assert.rejects(() => saveCashReconciliation({ physicalCash: value }, OWNER), /zero or greater/i);
  }
  assert.equal((await getCashReconciliations({}, OWNER)).length, before);
});

await test('save discrepancy preserves cash; confirmed negative adjustment applies exactly once', async () => {
  const before = getCurrentCash();
  const row = await saveCashReconciliation({ physicalCash: before - 100, notes: 'Till shortage' }, OWNER);
  assert.equal(row.difference, -100);
  assert.equal(getCurrentCash(), before);
  await assert.rejects(() => applyCashReconciliation(row.id, { reason: 'Count correction' }, OWNER), /confirm/i);
  await assert.rejects(() => applyCashReconciliation(row.id, { confirmed: true, reason: '' }, OWNER), /reason/i);
  const request = { confirmed: true, reason: 'Count correction' };
  const [a, b] = await Promise.all([applyCashReconciliation(row.id, request, OWNER), applyCashReconciliation(row.id, request, OWNER)]);
  assert.equal(a.adjustment.id, b.adjustment.id);
  assert.equal(a.adjustment.amount, -100);
  assert.equal(a.adjustment.referenceId, row.id);
  assert.equal(getCurrentCash(), before - 100);
  const history = await getCashReconciliations({}, OWNER);
  assert.equal(history.find((item) => item.id === row.id).expectedCash, before);
});

await test('cash writes invalidate counts and stale browser versions', async () => {
  const snapshot = await getCashSnapshot(OWNER);
  const count = await saveCashReconciliation({ physicalCash: snapshot.currentCash + 10 }, OWNER);
  await addCashIn({ amount: 20, reason: 'Cash arrived after count' }, OWNER);
  await assert.rejects(() => applyCashReconciliation(count.id, { confirmed: true, reason: 'Stale correction' }, OWNER), /fresh reconciliation/i);
  await assert.rejects(() => saveCashReconciliation({ physicalCash: 100, ledgerVersion: snapshot.ledgerVersion }, OWNER), /count again/i);
});

await test('recount supersedes unapplied count and positive correction updates reports', async () => {
  const before = getCurrentCash();
  const old = await saveCashReconciliation({ physicalCash: before + 50 }, OWNER);
  const current = await saveCashReconciliation({ physicalCash: before + 25 }, OWNER);
  assert.equal(current.supersedesId, old.id);
  await assert.rejects(() => applyCashReconciliation(old.id, { confirmed: true, reason: 'Obsolete count' }, OWNER), /fresh reconciliation/i);
  await applyCashReconciliation(current.id, { confirmed: true, reason: 'Extra cash found' }, OWNER);
  assert.equal(getCurrentCash(), before + 25);
  const report = await getCashExpected({}, OWNER);
  assert.equal(report.expected, getCurrentCash());
  assert.equal(report.expected, Math.round((report.opening + report.initialOpening + report.cashIn - report.cashOut + report.adjustments) * 100) / 100);
  const adjustments = await getCashAdjustmentsReport({}, OWNER);
  assert.equal(adjustments.rows.length, 2);
  assert.ok(adjustments.reconciliations.some((row) => row.difference === 0));
});

await test('quiet days carry prior cash; backdated manual date is honoured', async () => {
  const before = getCashPeriodSummary({ from: '2026-09-03', to: '2026-09-03' }, OWNER);
  assert.equal(before.expected, before.opening);
  assert.ok(before.opening > 0);
  const entry = await addCashIn({ amount: 12.34, reason: 'Backdated cash test', date: '2026-09-02' }, OWNER);
  assert.equal(entry.sessionDate, '2026-09-02');
  const after = getCashPeriodSummary({ from: '2026-09-03', to: '2026-09-03' }, OWNER);
  assert.equal(after.opening, before.opening + 12.34);
});

console.log(`\n  Cash: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
