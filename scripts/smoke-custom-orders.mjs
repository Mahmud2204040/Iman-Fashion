#!/usr/bin/env node
/**
 * Phase 7 smoke tests — custom-order service contract.
 *
 * Run with:  npm run smoke:custom-orders
 *
 * Verifies the custom-order lifecycle:
 *   - list returns an array
 *   - unknown id returns null
 *   - create rejects empty customer / empty product / invalid qty / invalid price
 *   - create happy path returns a new PENDING order with total = qty * unitPrice
 *   - record payment creates a paired CASH_IN row with referenceType CUSTOM_ORDER_PAYMENT
 *   - over-payment is rejected
 *   - status transitions are persisted
 */
import assert from 'node:assert/strict';

import {
  CUSTOM_ORDER_STATUSES,
  createCustomOrder,
  getCustomOrderById,
  getCustomOrderPayments,
  getCustomOrders,
  listCustomersForCustomOrders,
  recordCustomOrderPayment,
  setCustomOrderStatus,
  updateCustomOrder,
} from '../src/services/customOrders/customOrderService.js';
import { createCustomer } from '../src/services/customers/customerService.js';
import { getCashEntries, getCurrentCash } from '../src/services/cash/cashService.js';

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  PASS  ' + name);
  } catch (err) {
    failed += 1;
    console.error('  FAIL  ' + name + '\n        ' + err.message);
  }
}

console.log('\nPhase 7 — custom-orders service smoke tests\n');

await test('CUSTOM_ORDER_STATUSES — expected values', () => {
  assert.deepEqual(
    [...CUSTOM_ORDER_STATUSES],
    ['PENDING', 'READY', 'DELIVERED', 'CANCELLED'],
  );
});

await test('getCustomOrders — returns an array sorted newest-first', async () => {
  const list = await getCustomOrders();
  assert.ok(Array.isArray(list), 'must be an array');
  assert.ok(list.length >= 3, 'expected at least 3 seed orders');
  for (let i = 1; i < list.length; i += 1) {
    assert (
      new Date(list[i - 1].createdAt) >= new Date(list[i].createdAt),
        'list must be sorted newest-first'
      );
  }
});

await test('getCustomOrderById — unknown id returns null', async () => {
  const res = await getCustomOrderById('co-does-not-exist');
  assert.equal(res, null);
});

await test('getCustomOrderById — seed order is a defensive clone', async () => {
  const a = await getCustomOrderById('co-001');
  const b = await getCustomOrderById('co-001');
  assert.notEqual(a, b);
  assert.notEqual(a.payments, b.payments);
  assert.equal(a.id, 'co-001');
  assert.equal(a.status, 'PENDING');
});

await test('createCustomOrder — rejects empty customer', async () => {
  await assert.rejects(
    () =>
      createCustomOrder(
        { customerId: '', productName: 'Test', qty: 1, unitPrice: 100 },
        { actor: { username: 'owner', role: 'OWNER' } },
      ),
    /customer/i,
  );
});

await test('createCustomOrder — rejects empty product name', async () => {
  await assert.rejects(
    () =>
      createCustomOrder(
        { customerId: 'cust-001', productName: '', qty: 1, unitPrice: 100 },
        { actor: { username: 'owner', role: 'OWNER' } },
      ),
    /product/i,
  );
});

await test('createCustomOrder — rejects invalid qty', async () => {
  await assert.rejects(
    () =>
      createCustomOrder(
        { customerId: 'cust-001', productName: 'Test', qty: 0, unitPrice: 100 },
        { actor: { username: 'owner', role: 'OWNER' } },
      ),
    /quantity/i,
  );
});

await test('createCustomOrder — rejects negative price', async () => {
  await assert.rejects(
    () =>
      createCustomOrder(
        { customerId: 'cust-001', productName: 'Test', qty: 1, unitPrice: -10 },
        { actor: { username: 'owner', role: 'OWNER' } },
      ),
    /non-negative|price/i,
  );
});

await test('createCustomOrder — happy path', async () => {
  const order = await createCustomOrder(
    {
      customerId: 'cust-003',
      productName: 'Bespoke saree',
      description: 'Handloom silk',
      qty: 2,
      unitPrice: 4500,
      dueDate: '2099-10-15',
      notes: 'Gift wrap required',
    },
    { actor: { username: 'owner', role: 'OWNER' } },
  );
  assert.ok(order.id);
  assert.match(order.code, /^CO-\d{8}-\d{4}$/);
  assert.equal(order.status, 'PENDING');
  assert.equal(order.customerName, 'Mst. Rafa');
  assert.equal(order.total, 9000);
  assert.equal(order.qty, 2);
  assert.equal(order.unitPrice, 4500);
  assert.deepEqual(order.payments, []);
});

await test('updateCustomOrder — owner can edit valid due date, invalid date cannot mutate order', async () => {
  const actor = { username: 'owner', role: 'OWNER' };
  const before = await getCustomOrderById('co-001');
  await assert.rejects(
    () => updateCustomOrder('co-001', { dueDate: '2026-02-30' }, { actor }),
    (error) => error.code === 'INVALID_DUE_DATE',
  );
  assert.equal((await getCustomOrderById('co-001')).dueDate, before.dueDate);
  const updated = await updateCustomOrder('co-001', { dueDate: '2099-10-25' }, { actor });
  assert.equal(updated.dueDate, '2099-10-25');
  assert.equal((await getCustomOrderById('co-001')).dueDate, '2099-10-25');
});

await test('createCustomOrder — newly created customer and advance work together', async () => {
  const customer = await createCustomer(
    { name: 'New custom-order customer', phone: '01700000000' },
    { actor: { username: 'employee', role: 'EMPLOYEE' } },
  );
  const choices = await listCustomersForCustomOrders();
  assert.ok(choices.some((entry) => entry.id === customer.id));

  const cashBefore = getCurrentCash();
  const order = await createCustomOrder(
    {
      customerId: customer.id,
      productName: 'Custom uniform',
      qty: 2,
      totalPrice: 2500,
      advanceAmount: 500,
      dueDate: '2099-10-20',
    },
    { actor: { username: 'employee', role: 'EMPLOYEE' } },
  );

  assert.equal(order.customerName, customer.name);
  assert.equal(order.total, 2500);
  assert.equal(order.unitPrice, 1250);
  assert.equal(order.status, 'PENDING');
  assert.equal(order.createdBy, 'employee');
  assert.equal(order.payments.length, 1);
  assert.equal(order.payments[0].amount, 500);
  assert.equal(order.total - order.payments[0].amount, 2000);
  assert.equal(getCurrentCash(), cashBefore + 500);
  const entries = await getCashEntries();
  assert.ok(entries.some((entry) => entry.id === order.payments[0].cashInId && entry.referenceId === order.payments[0].id));
});

await test('createCustomOrder — invalid advance or delivery date leaves cash unchanged', async () => {
  const before = getCurrentCash();
  await assert.rejects(
    () => createCustomOrder({ customerId: 'cust-001', productName: 'Test', qty: 1, totalPrice: 100, advanceAmount: 150, dueDate: '2099-10-20' }),
    /advance/i,
  );
  await assert.rejects(
    () => createCustomOrder({ customerId: 'cust-001', productName: 'Test', qty: 1, totalPrice: 100, advanceAmount: 20, dueDate: '' }),
    /delivery date/i,
  );
  assert.equal(getCurrentCash(), before);
});

await test('cash-only advance rejects a non-cash method without creating cash', async () => {
  const before = getCurrentCash();
  await assert.rejects(
    () => createCustomOrder({
      customerId: 'cust-001', productName: 'Non-cash advance', qty: 1,
      totalPrice: 500, advanceAmount: 100, advanceMethod: 'BKASH', dueDate: '2099-10-20',
    }),
    (error) => error.code === 'CASH_ONLY',
  );
  assert.equal(getCurrentCash(), before);
});

await test('recordCustomOrderPayment — invalid amount rejected', async () => {
  await assert.rejects(
    () =>
      recordCustomOrderPayment(
        'co-002',
        { amount: 0, method: 'CASH' },
        { actor: { username: 'owner', role: 'OWNER' } },
      ),
    /greater than zero/i,
  );
});

await test('recordCustomOrderPayment — overpay rejected', async () => {
  await assert.rejects(
    () =>
      recordCustomOrderPayment(
        'co-002',
        { amount: 99999, method: 'CASH' },
        { actor: { username: 'owner', role: 'OWNER' } },
      ),
    /exceeds/i,
  );
});

await test('cash-only later payment rejects non-cash without writing a payment or cash row', async () => {
  const before = getCurrentCash();
  const paymentsBefore = (await getCustomOrderById('co-002')).payments.length;
  await assert.rejects(
    () => recordCustomOrderPayment('co-002', { amount: 100, method: 'NAGAD' }, {
      actor: { username: 'employee', role: 'EMPLOYEE' },
    }),
    (error) => error.code === 'CASH_ONLY',
  );
  assert.equal(getCurrentCash(), before);
  assert.equal((await getCustomOrderById('co-002')).payments.length, paymentsBefore);
});

await test('recordCustomOrderPayment — happy path produces CASH_IN row', async () => {
  const result = await recordCustomOrderPayment(
    'co-003',
    { amount: 2200, method: 'CASH', note: 'Full payment' },
    { actor: { username: 'owner', role: 'OWNER' } },
  );
  assert.ok(result.cashIn);
  assert.equal(result.cashIn.type, 'CASH_IN');
  assert.equal(result.cashIn.referenceType, 'CUSTOM_ORDER_PAYMENT');
  assert.equal(result.cashIn.referenceId, result.payment.id);
  assert.equal(result.cashIn.amount, 2200);
  assert.equal(result.order.status, 'PENDING');
  assert.equal(result.order.payments.length, 1);
  assert.equal(result.order.payments[0].cashInId, result.cashIn.id);
});

await test('Employee can pay and manually move PENDING to READY to DELIVERED', async () => {
  const order = await createCustomOrder({
    customerId: 'cust-001', productName: 'Employee payment test', qty: 1,
    totalPrice: 300, dueDate: '2099-10-20', advanceAmount: 0,
  }, { actor: { username: 'employee', role: 'EMPLOYEE' } });
  assert.equal(order.payments.length, 0, 'zero advance must create no payment');
  const beforeCash = getCurrentCash();
  const result = await recordCustomOrderPayment(order.id, { amount: 300 }, {
    actor: { username: 'employee', role: 'EMPLOYEE' },
  });
  assert.equal(result.order.status, 'PENDING');
  assert.equal(result.payment.createdByRole, 'EMPLOYEE');
  assert.equal(result.cashIn, undefined, 'Employee response must hide cash ledger row');
  assert.equal(getCurrentCash(), beforeCash + 300);
  const ready = await setCustomOrderStatus(order.id, 'READY', {
    actor: { username: 'employee', role: 'EMPLOYEE' },
  });
  assert.equal(ready.status, 'READY');
  assert.equal(ready.statusHistory.at(-1).by, 'employee');
  const delivered = await setCustomOrderStatus(order.id, 'DELIVERED', {
    actor: { username: 'employee', role: 'EMPLOYEE' },
  });
  assert.equal(delivered.status, 'DELIVERED');
  assert.ok(delivered.deliveredAt);
  assert.equal((await getCustomOrderById(order.id)).status, 'DELIVERED');
});

await test('delivery needs manual READY and full payment', async () => {
  await assert.rejects(
    () => setCustomOrderStatus('co-001', 'DELIVERED', { actor: { username: 'owner', role: 'OWNER' } }),
    (error) => error.code === 'INVALID_TRANSITION',
  );
  await setCustomOrderStatus('co-001', 'READY', { actor: { username: 'owner', role: 'OWNER' } });
  await assert.rejects(
    () => setCustomOrderStatus('co-001', 'DELIVERED', { actor: { username: 'owner', role: 'OWNER' } }),
    (error) => error.code === 'UNPAID_DELIVERY',
  );
  assert.equal((await getCustomOrderById('co-001')).status, 'READY');
});

await test('getCustomOrderPayments — returns payment rows', async () => {
  const payments = await getCustomOrderPayments('co-001');
  assert.ok(Array.isArray(payments));
  assert.ok(payments.length >= 1);
  assert.equal(payments[0].cashInId, 'cashin-co-001');
});

await test('setCustomOrderStatus — persists transition', async () => {
  const ready = await setCustomOrderStatus('co-003', 'READY', { actor: { username: 'owner', role: 'OWNER' } });
  assert.equal(ready.status, 'READY');
  const updated = await setCustomOrderStatus('co-003', 'DELIVERED', { actor: { username: 'owner', role: 'OWNER' } });
  assert.equal(updated.status, 'DELIVERED');
  assert.ok(updated.deliveredAt);
  assert.deepEqual(updated.statusHistory.map((entry) => entry.status), ['PENDING', 'READY', 'DELIVERED']);
  // Verify persistence
  const refetched = await getCustomOrderById('co-003');
  assert.equal(refetched.status, 'DELIVERED');
});

await test('setCustomOrderStatus — unknown status rejected', async () => {
  await assert.rejects(
    () => setCustomOrderStatus('co-002', 'NONSENSE', { actor: { username: 'owner', role: 'OWNER' } }),
    /unknown status/i,
  );
});

await test('recordCustomOrderPayment — cancelled order rejected', async () => {
  const beforeCash = getCurrentCash();
  const beforePaymentIds = (await getCustomOrderById('co-002')).payments.map((payment) => payment.id);
  const cancelled = await setCustomOrderStatus('co-002', 'CANCELLED', { actor: { username: 'employee', role: 'EMPLOYEE' } });
  assert.equal(cancelled.statusHistory.at(-1).by, 'employee');
  assert.equal(getCurrentCash(), beforeCash, 'cancellation must not refund or reverse cash');
  assert.deepEqual(cancelled.payments.map((payment) => payment.id), beforePaymentIds);
  await assert.rejects(
    () =>
      recordCustomOrderPayment(
        'co-002',
        { amount: 100, method: 'CASH' },
        { actor: { username: 'owner', role: 'OWNER' } },
      ),
    /closed order/i,
  );
});

console.log(
  '\n  ' + passed + ' passed, ' + failed + ' failed\n',
);

if (failed > 0) {
  process.exit(1);
}
