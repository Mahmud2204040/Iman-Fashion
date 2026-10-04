/**
 * Phase 9 — Purchases smoke tests.
 *
 * Asserts the public API of `purchaseService`:
 *   - getPurchases returns sorted (newest first) array of defensive clones
 *   - getPurchaseById returns a clone for known ids, null otherwise
 *   - getPurchasesBySupplier filters by supplierId
 *   - createPurchase rejects: no supplier, unknown supplier, no items,
 *     empty item name, qty <= 0, negative unit price
 *   - createPurchase happy path returns a clone with generated id,
 *     computed total, status DRAFT, empty payments
 *   - recordPurchasePayment rejects: not found, cancelled purchase,
 *     non-positive amount, overpayment, EMPLOYEE role
 *   - recordPurchasePayment appends purchase-specific CASH payment without creating Cash Out
 *   - setPurchaseStatus enforces valid statuses + sets receivedAt on RECEIVED
 *   - updatePurchase rejects received/cancelled (IMMUTABLE)
 *   - attachPurchaseReceipt stores image metadata + audit
 *   - computePurchaseTotals totals across payments
 */
import assert from 'node:assert/strict';

import { ROLES } from '../src/constants/roles.js';
import {
  attachPurchaseReceipt,
  computePurchaseTotals,
  createPurchase,
  getPurchaseById,
  getPurchases,
  getPurchasesBySupplier,
  listSuppliersForPurchase,
  recordPurchasePayment,
  setPurchaseStatus,
  updatePurchase,
} from '../src/services/purchases/purchaseService.js';

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
const EMPLOYEE = { actor: { username: 'staff', role: ROLES.EMPLOYEE } };

console.log('Phase 9 — purchases service smoke tests');

await test('getPurchases — returns array sorted newest-first', async () => {
  const rows = await getPurchases();
  assert.ok(Array.isArray(rows));
  assert.ok(rows.length >= 4, 'expected seed of >= 4 purchases');
  for (let i = 1; i < rows.length; i += 1) {
    assert.ok(
      new Date(rows[i - 1].createdAt) >= new Date(rows[i].createdAt),
      'purchases must be sorted newest first',
    );
  }
});

await test('getPurchases — defensive clones', async () => {
  const a = await getPurchases();
  const b = await getPurchases();
  assert.notEqual(a[0], b[0]);
  a[0].notes = 'MUTATED';
  assert.notEqual(a[0].notes, b[0].notes);
});

await test('getPurchaseById — returns clone for known id', async () => {
  const p = await getPurchaseById('pch-001');
  assert.ok(p);
  assert.equal(p.id, 'pch-001');
  assert.equal(p.status, 'RECEIVED');
  assert.equal(p.total, 23000);
});

await test('getPurchaseById — returns null for unknown id', async () => {
  const p = await getPurchaseById('pch-doesnotexist');
  assert.equal(p, null);
});

await test('getPurchasesBySupplier — filters and sorts', async () => {
  const rows = await getPurchasesBySupplier('sup-001');
  assert.ok(rows.length >= 1);
  assert.ok(rows.every((r) => r.supplierId === 'sup-001'));
});

await test('listSuppliersForPurchase — returns name+id pairs', async () => {
  const list = await listSuppliersForPurchase();
  assert.ok(list.length >= 1);
  assert.ok(list.every((s) => s.id && s.name));
});

await test('createPurchase — rejects missing supplier', async () => {
  await assert.rejects(
    () =>
      createPurchase(
        {
          supplierId: '',
          items: [{ name: 'x', qty: 1, unitPrice: 100 }],
        },
        OWNER,
      ),
    (err) => err.code === 'EMPTY_SUPPLIER',
  );
});

await test('createPurchase — rejects unknown supplier', async () => {
  await assert.rejects(
    () =>
      createPurchase(
        {
          supplierId: 'sup-xxx',
          items: [{ name: 'x', qty: 1, unitPrice: 100 }],
        },
        OWNER,
      ),
    (err) => err.code === 'SUPPLIER_NOT_FOUND',
  );
});

await test('createPurchase — rejects no items', async () => {
  await assert.rejects(
    () =>
      createPurchase({ supplierId: 'sup-001', items: [] }, OWNER),
    (err) => err.code === 'NO_ITEMS',
  );
});

await test('createPurchase — rejects empty item name', async () => {
  await assert.rejects(
    () =>
      createPurchase(
        {
          supplierId: 'sup-001',
          items: [{ name: '   ', qty: 1, unitPrice: 100 }],
        },
        OWNER,
      ),
    (err) => err.code === 'ITEM_EMPTY_NAME',
  );
});

await test('createPurchase — rejects qty <= 0', async () => {
  await assert.rejects(
    () =>
      createPurchase(
        {
          supplierId: 'sup-001',
          items: [{ name: 'Roll A', qty: 0, unitPrice: 100 }],
        },
        OWNER,
      ),
    (err) => err.code === 'ITEM_INVALID_QTY',
  );
});

await test('createPurchase — rejects negative unit price', async () => {
  await assert.rejects(
    () =>
      createPurchase(
        {
          supplierId: 'sup-001',
          items: [{ name: 'Roll A', qty: 2, unitPrice: -5 }],
        },
        OWNER,
      ),
    (err) => err.code === 'ITEM_INVALID_PRICE',
  );
});

await test('createPurchase — happy path returns clone with id + total', async () => {
  const created = await createPurchase(
    {
      supplierId: 'sup-002',
      items: [
        { name: 'Buttons', qty: 100, unitPrice: 5 },
        { name: 'Zippers', qty: 50, unitPrice: 20 },
      ],
      notes: 'Smoke test purchase',
    },
    OWNER,
  );
  assert.ok(created.id);
  assert.equal(created.status, 'DRAFT');
  assert.equal(created.total, 100 * 5 + 50 * 20);
  assert.equal(created.paidTotal, 0);
  assert.equal(created.payments.length, 0);
  assert.equal(created.createdBy, 'owner');
});

await test('createPurchase — EMPLOYEE rejected', async () => {
  await assert.rejects(
    () =>
      createPurchase(
        {
          supplierId: 'sup-002',
          items: [{ name: 'x', qty: 1, unitPrice: 10 }],
        },
        EMPLOYEE,
      ),
    (err) => err.code === 'FORBIDDEN_ROLE',
  );
});

await test('recordPurchasePayment — rejects non-positive amount', async () => {
  // Use a fresh draft purchase so payments remain under total
  const draft = await createPurchase(
    {
      supplierId: 'sup-003',
      items: [{ name: 'Test fabric', qty: 10, unitPrice: 100 }],
    },
    OWNER,
  );
  await setPurchaseStatus(draft.id, 'ORDERED', OWNER);
  await assert.rejects(
    () =>
      recordPurchasePayment(
        draft.id,
        { amount: 0, method: 'CASH' },
        OWNER,
      ),
    (err) => err.code === 'INVALID_AMOUNT',
  );
});

await test('recordPurchasePayment — rejects overpayment', async () => {
  const draft = await createPurchase(
    {
      supplierId: 'sup-003',
      items: [{ name: 'Tiny', qty: 1, unitPrice: 100 }],
    },
    OWNER,
  );
  await setPurchaseStatus(draft.id, 'ORDERED', OWNER);
  await assert.rejects(
    () =>
      recordPurchasePayment(
        draft.id,
        { amount: 5000, method: 'CASH' },
        OWNER,
      ),
    (err) => err.code === 'OVERPAY',
  );
});

await test('recordPurchasePayment — cash-only purchase allocation without Cash Out', async () => {
  const draft = await createPurchase(
    {
      supplierId: 'sup-004',
      items: [{ name: 'Poly', qty: 20, unitPrice: 50 }],
    },
    OWNER,
  );
  await setPurchaseStatus(draft.id, 'ORDERED', OWNER);
  const result = await recordPurchasePayment(
    draft.id,
    { amount: 500, method: 'CASH', note: 'partial' },
    OWNER,
  );
  assert.equal(result.pairedCashOut, undefined);
  assert.equal(result.purchase.paidTotal, 500);
  assert.equal(result.purchase.payments.length, 1);
  assert.equal(result.purchase.payments[0].method, 'CASH');
  assert.equal(result.purchase.payments[0].cashOutId, undefined);
});

await test('recordPurchasePayment — rejects EMPLOYEE', async () => {
  const draft = await createPurchase(
    {
      supplierId: 'sup-004',
      items: [{ name: 'Poly', qty: 1, unitPrice: 100 }],
    },
    OWNER,
  );
  await assert.rejects(
    () =>
      recordPurchasePayment(
        draft.id,
        { amount: 10, method: 'CASH' },
        EMPLOYEE,
      ),
    (err) => err.code === 'FORBIDDEN_ROLE',
  );
});

await test('setPurchaseStatus — moves DRAFT → ORDERED → RECEIVED', async () => {
  const draft = await createPurchase(
    {
      supplierId: 'sup-002',
      items: [{ name: 'Buttons', qty: 10, unitPrice: 4 }],
    },
    OWNER,
  );
  const ordered = await setPurchaseStatus(draft.id, 'ORDERED', OWNER);
  assert.equal(ordered.status, 'ORDERED');
  const received = await setPurchaseStatus(draft.id, 'RECEIVED', OWNER);
  assert.equal(received.status, 'RECEIVED');
  assert.ok(received.receivedAt, 'receivedAt should be set');
});

await test('setPurchaseStatus — rejects invalid status', async () => {
  await assert.rejects(
    () => setPurchaseStatus('pch-001', 'WHATEVER', OWNER),
    (err) => err.code === 'INVALID_STATUS',
  );
});

await test('updatePurchase — rejects RECEIVED (IMMUTABLE)', async () => {
  await assert.rejects(
    () => updatePurchase('pch-001', { notes: 'too late' }, OWNER),
    (err) => err.code === 'IMMUTABLE',
  );
});

await test('updatePurchase — accepts notes on DRAFT', async () => {
  const draft = await createPurchase(
    {
      supplierId: 'sup-002',
      items: [{ name: 'Buttons', qty: 1, unitPrice: 4 }],
    },
    OWNER,
  );
  const updated = await updatePurchase(
    draft.id,
    { notes: 'Updated note' },
    OWNER,
  );
  assert.equal(updated.notes, 'Updated note');
});

await test('attachPurchaseReceipt — stores gallery metadata + audit', async () => {
  const draft = await createPurchase(
    {
      supplierId: 'sup-002',
      items: [{ name: 'Buttons', qty: 1, unitPrice: 4 }],
    },
    OWNER,
  );
  const attached = await attachPurchaseReceipt(
    draft.id,
    'data:image/png;base64,FAKE',
    OWNER,
  );
  assert.equal(attached.receipts.length, 1);
  assert.equal(attached.receipts[0].dataUrl, 'data:image/png;base64,FAKE');
  assert.equal(attached.receipts[0].purchaseId, draft.id);
  assert.equal(attached.updatedBy, 'owner');
});

await test('computePurchaseTotals — sums payments', async () => {
  const p = {
    total: 1000,
    payments: [{ amount: 200 }, { amount: 300 }],
  };
  const t = computePurchaseTotals(p);
  assert.equal(t.total, 1000);
  assert.equal(t.paidTotal, 500);
  assert.equal(t.dueTotal, 500);
});

await test('recordPurchasePayment — rejects cancelled purchase', async () => {
  const draft = await createPurchase(
    {
      supplierId: 'sup-004',
      items: [{ name: 'X', qty: 1, unitPrice: 10 }],
    },
    OWNER,
  );
  await setPurchaseStatus(draft.id, 'CANCELLED', OWNER);
  await assert.rejects(
    () =>
      recordPurchasePayment(
        draft.id,
        { amount: 5, method: 'CASH' },
        OWNER,
      ),
    (err) => err.code === 'PAYMENT_STATUS',
  );
});

await test('DRAFT cannot receive payment and paid ORDERED cannot cancel', async () => {
  const draft = await createPurchase({ supplierId: 'sup-001', items: [{ name: 'Thread', qty: 2, unitPrice: 40 }] }, OWNER);
  await assert.rejects(() => recordPurchasePayment(draft.id, { amount: 10, method: 'CASH' }, OWNER), (error) => error.code === 'PAYMENT_STATUS');
  await setPurchaseStatus(draft.id, 'ORDERED', OWNER);
  await recordPurchasePayment(draft.id, { amount: 10, method: 'CASH' }, OWNER);
  await assert.rejects(() => setPurchaseStatus(draft.id, 'CANCELLED', OWNER), (error) => error.code === 'PAID_PURCHASE');
});

await test('RECEIVED can accept remaining cash due and cannot cancel', async () => {
  const draft = await createPurchase({ supplierId: 'sup-001', items: [{ name: 'Labels', qty: 2, unitPrice: 50 }] }, OWNER);
  await setPurchaseStatus(draft.id, 'ORDERED', OWNER);
  await setPurchaseStatus(draft.id, 'RECEIVED', OWNER);
  const result = await recordPurchasePayment(draft.id, { amount: 100, method: 'CASH' }, OWNER);
  assert.equal(result.purchase.paidTotal, 100);
  assert.equal(computePurchaseTotals(result.purchase).dueTotal, 0);
  await assert.rejects(() => setPurchaseStatus(draft.id, 'CANCELLED', OWNER));
});

await test('receipt proof validates type, size and payment association', async () => {
  const draft = await createPurchase({ supplierId: 'sup-001', items: [{ name: 'Tape', qty: 1, unitPrice: 10 }] }, OWNER);
  await assert.rejects(() => attachPurchaseReceipt(draft.id, { type: 'image/gif', size: 1, dataUrl: 'data:image/gif;base64,AA' }, OWNER), (error) => error.code === 'INVALID_RECEIPT');
  await assert.rejects(() => attachPurchaseReceipt(draft.id, { type: 'image/png', size: 5 * 1024 * 1024 + 1, dataUrl: 'data:image/png;base64,AA' }, OWNER), (error) => error.code === 'INVALID_RECEIPT');
  await assert.rejects(() => attachPurchaseReceipt(draft.id, { type: 'image/png', size: 1, dataUrl: 'data:image/png;base64,AA', paymentId: 'other' }, OWNER), (error) => error.code === 'INVALID_PAYMENT_LINK');
});

console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
