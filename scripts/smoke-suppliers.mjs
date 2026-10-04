/**
 * Phase 9 — Suppliers smoke tests.
 *
 * Asserts the public API of `supplierService`:
 *   - getSuppliers returns sorted (by name) array of defensive clones
 *   - getSupplierById returns a clone for known ids, null otherwise
 *   - searchSuppliers matches by name / contactPerson / phone
 *   - createSupplier rejects empty name, missing phone, duplicate active name
 *   - createSupplier happy path returns a clone with generated id + audit
 *   - updateSupplier rejects empty name (post-creation edit)
 *   - setSupplierStatus toggles isActive through updateSupplier
 *   - computeSupplierTotals totals purchases/paid/due across supplied list
 *   - getAllSupplierPayments sorts newest-first without synthetic cash transactions
 *   - forbidden role (EMPLOYEE) is rejected for mutations
 */
import assert from 'node:assert/strict';

import { ROLES } from '../src/constants/roles.js';
import {
  computeSupplierTotals,
  createSupplier,
  getAllSupplierPayments,
  getSupplierById,
  getSuppliers,
  searchSuppliers,
  setSupplierStatus,
  updateSupplier,
} from '../src/services/suppliers/supplierService.js';

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

console.log('Phase 9 — suppliers service smoke tests');

await test('getSuppliers — returns array sorted by name', async () => {
  const suppliers = await getSuppliers();
  assert.ok(Array.isArray(suppliers));
  assert.ok(suppliers.length >= 5, 'expected seed of >= 5 suppliers');
  assert.ok(suppliers.every((supplier) => !Object.hasOwn(supplier, 'category')),
    'supplier records must match the planned schema without category');
  for (let i = 1; i < suppliers.length; i += 1) {
    assert.ok(
      suppliers[i - 1].name.localeCompare(suppliers[i].name) <= 0,
      'suppliers must be sorted by name',
    );
  }
});

await test('getSuppliers — returns defensive clones', async () => {
  const a = await getSuppliers();
  const b = await getSuppliers();
  assert.notEqual(a[0], b[0], 'must be different instances');
  a[0].name = 'MUTATED';
  assert.notEqual(a[0].name, b[0].name, 'clones must isolate mutations');
});

await test('getSupplierById — returns clone for known id', async () => {
  const sup = await getSupplierById('sup-001');
  assert.ok(sup);
  assert.equal(sup.id, 'sup-001');
  assert.equal(sup.name, 'Aarong Fabrics Ltd.');
});

await test('getSupplierById — returns null for unknown id', async () => {
  const sup = await getSupplierById('sup-doesnotexist');
  assert.equal(sup, null);
});

await test('searchSuppliers — matches by name', async () => {
  const hits = await searchSuppliers('aarong');
  assert.ok(hits.length >= 1);
  assert.ok(hits.some((s) => s.name.toLowerCase().includes('aarong')));
});

await test('searchSuppliers — matches by phone', async () => {
  const hits = await searchSuppliers('01722000222');
  assert.ok(hits.some((s) => s.name === 'Bengal Buttons & Trims'));
});

await test('searchSuppliers — empty query returns full set', async () => {
  const all = await searchSuppliers('');
  assert.ok(all.length >= 5);
});

await test('createSupplier — rejects empty name', async () => {
  await assert.rejects(
    () =>
      createSupplier(
        { name: '   ', phone: '+8801700000000' },
        OWNER,
      ),
    (err) => err.code === 'EMPTY_NAME',
  );
});

await test('createSupplier — rejects missing phone', async () => {
  await assert.rejects(
    () =>
      createSupplier(
        { name: 'Test supplier ' + Date.now(), phone: '' },
        OWNER,
      ),
    (err) => err.code === 'EMPTY_PHONE',
  );
});

await test('createSupplier — rejects duplicate active name', async () => {
  await assert.rejects(
    () =>
      createSupplier(
        { name: 'Aarong Fabrics Ltd.', phone: '+8801700000999' },
        OWNER,
      ),
    (err) => err.code === 'DUPLICATE_NAME',
  );
});

await test('createSupplier — happy path returns clone with id + audit', async () => {
  const unique = 'New Supplier ' + Date.now();
  const created = await createSupplier(
    {
      name: unique,
      contactPerson: 'Tester One',
      phone: '+8801790000000',
      email: 'x@y.example',
      notes: 'n/a',
      category: 'ignored legacy field',
    },
    OWNER,
  );
  assert.ok(created.id);
  assert.equal(created.name, unique);
  assert.equal(created.createdBy, 'owner');
  assert.equal(created.createdByRole, ROLES.OWNER);
  assert.equal(created.isActive, true);
  assert.equal(Object.hasOwn(created, 'category'), false);
});

await test('updateSupplier — updates notes + audit', async () => {
  const updated = await updateSupplier(
    'sup-001',
    { notes: 'Updated note ' + Date.now() },
    OWNER,
  );
  assert.ok(updated.notes.startsWith('Updated note'));
  assert.equal(updated.updatedBy, 'owner');
});

await test('updateSupplier — rejects empty name patch', async () => {
  await assert.rejects(
    () => updateSupplier('sup-001', { name: '   ' }, OWNER),
    (err) => err.code === 'EMPTY_NAME',
  );
});

await test('updateSupplier — rejects unknown id', async () => {
  await assert.rejects(
    () => updateSupplier('sup-xxx', { notes: 'x' }, OWNER),
    (err) => err.code === 'NOT_FOUND',
  );
});

await test('setSupplierStatus — toggles isActive', async () => {
  const off = await setSupplierStatus('sup-005', false, OWNER);
  assert.equal(off.isActive, false);
  const on = await setSupplierStatus('sup-005', true, OWNER);
  assert.equal(on.isActive, true);
});

await test('createSupplier — rejects EMPLOYEE', async () => {
  await assert.rejects(
    () =>
      createSupplier(
        { name: 'Should not work', phone: '+8801700000001' },
        EMPLOYEE,
      ),
    (err) => err.code === 'FORBIDDEN_ROLE',
  );
});

await test('updateSupplier — rejects EMPLOYEE', async () => {
  await assert.rejects(
    () => updateSupplier('sup-001', { notes: 'no' }, EMPLOYEE),
    (err) => err.code === 'FORBIDDEN_ROLE',
  );
});

await test('computeSupplierTotals — sums supplied purchase list', async () => {
  const fakePurchases = [
    {
      id: 'a',
      supplierId: 'sup-001',
      total: 1000,
      payments: [{ amount: 400 }, { amount: 200 }],
    },
    {
      id: 'b',
      supplierId: 'sup-001',
      total: 500,
      payments: [],
    },
  ];
  const totals = computeSupplierTotals({ id: 'sup-001' }, fakePurchases);
  assert.equal(totals.purchasesTotal, 1500);
  assert.equal(totals.paidTotal, 600);
  assert.equal(totals.dueTotal, 900);
  assert.equal(totals.purchaseCount, 2);
});

await test('computeSupplierTotals — ignores other suppliers', async () => {
  const totals = computeSupplierTotals(
    { id: 'sup-001' },
    [{ id: 'a', total: 1000, supplierId: 'sup-002', payments: [] }],
  );
  assert.equal(totals.purchasesTotal, 0);
  assert.equal(totals.dueTotal, 0);
});

await test('getAllSupplierPayments — sorts newest-first without synthetic cash row', async () => {
  const fakePurchases = [
    {
      id: 'pch-1',
      code: 'P-TEST-001',
      supplierId: 'sup-001',
      supplierName: 'Test',
      payments: [
        {
          amount: 100,
          method: 'CASH',
          note: '',
          createdBy: 'owner',
          createdByRole: ROLES.OWNER,
          createdAt: '2025-09-01T10:00:00Z',
        },
        {
          amount: 200,
          method: 'CASH',
          note: '',
          createdBy: 'owner',
          createdByRole: ROLES.OWNER,
          createdAt: '2025-09-05T10:00:00Z',
        },
      ],
    },
  ];
  const all = getAllSupplierPayments(fakePurchases);
  assert.equal(all.length, 2);
  assert.equal(all[0].amount, 200, 'newest first');
  assert.equal(all[1].amount, 100);
  assert.equal(all[0].pairedCashOut, undefined);
  assert.equal(all[0].purchaseId, 'pch-1');
});

console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
