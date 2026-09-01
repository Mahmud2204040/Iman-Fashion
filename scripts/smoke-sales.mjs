#!/usr/bin/env node
/**
 * Phase 5 smoke tests — sales service contracts and lifecycle.
 *
 * Run with:  npm run smoke:sales
 *
 * Imports the service module directly and asserts on the returned
 * shapes. Catches the "service returned an object where an array was
 * expected" class of bugs that caused the Phase 4 dashboard blank.
 *
 * All service exports are async (return Promises), so the tests use
 * top-level await (Node ESM).
 */
import assert from 'node:assert/strict';

import {
  completeSale,
  createCustomer,
  generateSalesCode,
  getSaleById,
  getSales,
  searchCustomers,
  searchProducts,
  searchSalesByCode,
} from '../src/services/sales/salesService.js';

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL  ${name}\n        ${err.message}`);
  }
}

console.log('\nPhase 5 — sales service smoke tests\n');

await test('generateSalesCode — format S-YYYYMMDD-NNNN for a fixed date', () => {
  const code = generateSalesCode(new Date('2025-09-12T10:00:00'));
  assert.match(code, /^S-\d{8}-\d{4}$/);
  assert.equal(code, 'S-20250912-0001');
});

await test('searchCustomers — returns an array', async () => {
  const res = await searchCustomers('Anika');
  assert.ok(Array.isArray(res), 'searchCustomers must return an array');
});

await test('searchCustomers — empty query yields a slice of the catalogue', async () => {
  const res = await searchCustomers('');
  assert.ok(Array.isArray(res));
  assert.ok(res.length >= 3, 'expected at least 3 seed customers');
});

await test('searchCustomers — case-insensitive substring match', async () => {
  const res = await searchCustomers('anika');
  assert.ok(res.some((c) => /anika/i.test(c.name)));
});

await test('createCustomer — rejects empty name', async () => {
  await assert.rejects(() => createCustomer({ name: '' }), /required/i);
});

await test('createCustomer — rejects name shorter than 2 chars', async () => {
  await assert.rejects(() => createCustomer({ name: 'A' }), /too short/i);
});

await test('createCustomer — happy path', async () => {
  const c = await createCustomer({ name: 'Test Walk-in', phone: '01700000000' });
  assert.ok(c.id);
  assert.equal(c.name, 'Test Walk-in');
  assert.equal(c.phone, '01700000000');
  const found = await searchCustomers('Test Walk-in');
  assert.ok(found.some((x) => x.id === c.id));
});

await test('searchProducts — returns an array', async () => {
  const res = await searchProducts('shirt');
  assert.ok(Array.isArray(res), 'searchProducts must return an array');
});

await test('searchProducts — empty query yields a slice of the catalogue', async () => {
  const res = await searchProducts('');
  assert.ok(Array.isArray(res));
  assert.ok(res.length >= 3, 'expected at least 3 seed products');
});

await test('getSales — returns an array', async () => {
  const res = await getSales();
  assert.ok(Array.isArray(res), 'getSales must return an array');
});

await test('completeSale — requires items', async () => {
  await assert.rejects(
    () =>
      completeSale(
        { customer: null, items: [] },
        { actor: { username: 'tester', role: 'OWNER' } },
      ),
    /at least one item/i,
  );
});

await test('completeSale — invalid line.qty is rejected', async () => {
  await assert.rejects(
    () =>
      completeSale(
        {
          customer: null,
          items: [{ productId: 'p1', productName: 'X', qty: 0, price: 100 }],
        },
        { actor: { username: 'tester', role: 'OWNER' } },
      ),
    /quantity/i,
  );
});

await test('completeSale — happy path returns sale + paired CASH_IN', async () => {
  const products = await searchProducts('');
  const p = products[0];
  const result = await completeSale(
    {
      customer: null,
      items: [{ productId: p.id, productName: p.name, qty: 2, price: 100 }],
    },
    { actor: { username: 'tester', role: 'OWNER' } },
  );
  assert.ok(result.sale, 'expected a sale object');
  assert.ok(result.cashIn, 'expected a paired cashIn object');
  assert.match(result.sale.salesCode, /^S-\d{8}-\d{4}$/);
  assert.equal(result.sale.total, 200);
  assert.equal(result.cashIn.amount, 200);
  assert.equal(result.cashIn.referenceType, 'SALE');
  assert.equal(result.cashIn.referenceId, result.sale.id);
});

await test('completeSale — single line with merged qty works', async () => {
  const products = await searchProducts('');
  const p = products[1];
  const merged = await completeSale(
    {
      customer: null,
      items: [{ productId: p.id, productName: p.name, qty: 3, price: 50 }],
    },
    { actor: { username: 'tester', role: 'OWNER' } },
  );
  assert.equal(merged.sale.items.length, 1);
  assert.equal(merged.sale.items[0].qty, 3);
});

await test('getSaleById — returns the sale object', async () => {
  const list = await getSales();
  if (list.length === 0) return;
  const found = await getSaleById(list[0].id);
  assert.ok(found, 'expected sale to be found');
  assert.equal(found.id, list[0].id);
  assert.ok(Array.isArray(found.items));
});

await test('getSaleById — unknown id returns null', async () => {
  const found = await getSaleById('does-not-exist');
  assert.equal(found, null);
});

await test('searchSalesByCode — by sales_code substring', async () => {
  const list = await getSales();
  if (list.length === 0) return;
  const hit = await searchSalesByCode(list[0].salesCode);
  assert.ok(Array.isArray(hit));
  assert.ok(hit.some((s) => s.id === list[0].id));
});

console.log(`\n${passed}/${passed + failed} passed\n`);

if (failed > 0) {
  process.exit(1);
}
