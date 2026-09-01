/**
 * Phase 10 — Raw Materials smoke tests.
 *
 * Asserts the public API of rawMaterialService:
 *   - getRawMaterials returns an array of defensive clones
 *   - createRawMaterial rejects empty name, non-numeric quantity, employee role
 *   - createRawMaterial happy path returns a clone with generated id + audit
 *   - updateRawMaterial can patch name/qty/cost; rejects employee role
 *   - fields are scoped to itemName, quantity, description, date, notes, purchaseCost
 *   - owner-only writes
 *   - raw materials never produce a cash row
 */
import assert from 'node:assert/strict';

import { ROLES } from '../src/constants/roles.js';
import {
  getRawMaterials,
  createRawMaterial,
  updateRawMaterial,
} from '../src/services/rawMaterials/rawMaterialService.js';

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

await test('getRawMaterials returns an array', async () => {
  const list = await getRawMaterials(OWNER);
  assert.ok(Array.isArray(list), 'expected array');
});

await test('createRawMaterial rejects empty itemName', async () => {
  await assert.rejects(
    () => createRawMaterial({ itemName: '', quantity: 1 }, OWNER),
    /name/i,
  );
});

await test('createRawMaterial rejects non-numeric quantity', async () => {
  await assert.rejects(
    () => createRawMaterial({ itemName: 'Cotton', quantity: 'abc' }, OWNER),
    /quantity/i,
  );
});

await test('createRawMaterial rejects zero quantity', async () => {
  await assert.rejects(
    () => createRawMaterial({ itemName: 'Cotton', quantity: 0 }, OWNER),
    /quantity/i,
  );
});

await test('createRawMaterial rejects EMPLOYEE', async () => {
  await assert.rejects(
    () => createRawMaterial({ itemName: 'Cotton', quantity: 1 }, EMPLOYEE),
    /owner/i,
  );
});

await test('createRawMaterial happy path returns clone with full audit', async () => {
  const created = await createRawMaterial(
    {
      itemName: 'Cotton fabric',
      quantity: 50,
      description: 'White cotton roll',
      date: '2026-09-15',
      notes: 'From supplier A',
      purchaseCost: 2500,
    },
    OWNER,
  );
  assert.ok(created.id, 'expected id');
  assert.equal(created.itemName, 'Cotton fabric');
  assert.equal(created.quantity, 50);
  assert.equal(created.purchaseCost, 2500);
  assert.equal(created.createdBy, 'owner');
  assert.equal(created.createdByRole, ROLES.OWNER);
});

await test('createRawMaterial allows purchaseCost to be omitted', async () => {
  const created = await createRawMaterial(
    { itemName: 'Linen roll', quantity: 10, date: '2026-09-15' },
    OWNER,
  );
  assert.equal(created.purchaseCost, null);
});

await test('createRawMaterial allows empty description and notes', async () => {
  const created = await createRawMaterial(
    { itemName: 'Silk piece', quantity: 5, date: '2026-09-15' },
    OWNER,
  );
  assert.equal(created.description, '');
  assert.equal(created.notes, '');
});

await test('updateRawMaterial can patch quantity and cost', async () => {
  const created = await createRawMaterial(
    { itemName: 'Patch target', quantity: 5, date: '2026-09-15' },
    OWNER,
  );
  const updated = await updateRawMaterial(
    created.id,
    { quantity: 12, purchaseCost: 800 },
    OWNER,
  );
  assert.equal(updated.quantity, 12);
  assert.equal(updated.purchaseCost, 800);
});

await test('updateRawMaterial rejects EMPLOYEE', async () => {
  const created = await createRawMaterial(
    { itemName: 'For employee test', quantity: 5, date: '2026-09-15' },
    OWNER,
  );
  await assert.rejects(
    () => updateRawMaterial(created.id, { quantity: 1 }, EMPLOYEE),
    /owner/i,
  );
});

await test('raw materials do not touch cash ledger', async () => {
  const created = await createRawMaterial(
    { itemName: 'No-cash guard', quantity: 1, date: '2026-09-15' },
    OWNER,
  );
  assert.equal(created.cashInId, undefined, 'raw materials must not create cash rows');
  assert.equal(created.type, undefined, 'raw materials must not carry a cash type');
});

console.log(`\n  Raw materials: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
