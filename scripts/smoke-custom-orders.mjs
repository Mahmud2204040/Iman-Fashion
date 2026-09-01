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
  recordCustomOrderPayment,
  setCustomOrderStatus,
} from '../src/services/customOrders/customOrderService.js';

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
    ['PENDING', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CANCELLED'],
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
  assert.equal(a.status, 'IN_PROGRESS');
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

await test('recordCustomOrderPayment — happy path produces CASH_IN row', async () => {
  const result = await recordCustomOrderPayment(
    'co-003',
    { amount: 2200, method: 'CASH', note: 'Full payment' },
    { actor: { username: 'owner', role: 'OWNER' } },
  );
  assert.ok(result.cashIn);
  assert.equal(result.cashIn.type, 'CASH_IN');
  assert.equal(result.cashIn.referenceType, 'CUSTOM_ORDER_PAYMENT');
  assert.equal(result.cashIn.referenceId, 'co-003');
  assert.equal(result.cashIn.amount, 2200);
  assert.equal(result.order.status, 'READY');
  assert.equal(result.order.payments.length, 1);
});

await test('getCustomOrderPayments — returns payment rows', async () => {
  const payments = await getCustomOrderPayments('co-001');
  assert.ok(Array.isArray(payments));
  assert.ok(payments.length >= 1);
  assert.equal(payments[0].cashInId, 'cashin-co-001');
});

await test('setCustomOrderStatus — persists transition', async () => {
  const updated = await setCustomOrderStatus('co-003', 'DELIVERED');
  assert.equal(updated.status, 'DELIVERED');
  // Verify persistence
  const refetched = await getCustomOrderById('co-003');
  assert.equal(refetched.status, 'DELIVERED');
});

await test('setCustomOrderStatus — unknown status rejected', async () => {
  await assert.rejects(
    () => setCustomOrderStatus('co-002', 'NONSENSE'),
    /unknown status/i,
  );
});

await test('recordCustomOrderPayment — cancelled order rejected', async () => {
  await setCustomOrderStatus('co-002', 'CANCELLED');
  await assert.rejects(
    () =>
      recordCustomOrderPayment(
        'co-002',
        { amount: 100, method: 'CASH' },
        { actor: { username: 'owner', role: 'OWNER' } },
      ),
    /cancelled/i,
  );
});

console.log(
  '\n  ' + passed + ' passed, ' + failed + ' failed\n',
);

if (failed > 0) {
  process.exit(1);
}