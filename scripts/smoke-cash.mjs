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
} from '../src/services/cash/cashService.js';

import { completeSale } from '../src/services/sales/salesService.js';
import { recordCustomOrderPayment, createCustomOrder } from '../src/services/customOrders/customOrderService.js';
import { createExpense, getExpenseCategories } from '../src/services/expenses/expenseService.js';
import { recordPurchasePayment, createPurchase } from '../src/services/purchases/purchaseService.js';

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
  const { sale, cashIn } = await completeSale(
    {
      customer: { id: 'cust-001', name: 'Anika Tabassum' },
      items: [{ productId: 'prod-002', productName: 'Linen shirt', qty: 1, price: 800 }],
    },
    EMPLOYEE,
  );
  assert.ok(sale.id);
  assert.ok(cashIn.id);
  assert.equal(cashIn.referenceType, 'SALE');

  const after = getCurrentCash();
  assert.equal(after, before + 800, 'cash must grow by sale total');

  const entries = await getCashEntries();
  assert.ok(entries.some((e) => e.id === cashIn.id));
});

await test('CRITICAL: custom-order payment mirrors a CASH_IN row into the shared ledger', async () => {
  const order = await createCustomOrder(
    {
      customerId: 'cust-001',
      customerName: 'Anika Tabassum',
      productName: 'Salwar set',
      qty: 1,
      unitPrice: 2000,
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

console.log(`\n  Cash: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
