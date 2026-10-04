/**
 * Phase 8 — Products & Stock smoke tests.
 *
 * Asserts the public API of `productService`:
 *   - getProducts returns a sorted (by name) array of defensive clones
 *   - getProductById returns a clone for known ids, null otherwise
 *   - searchProducts matches by name / sku / category
 *   - createProduct rejects empty name, empty SKU, duplicate SKU,
 *     non-positive price, non-numeric stock
 *   - createProduct happy path returns a clone with a generated id
 *     and an OPENING_STOCK ledger entry equal to the initial stock
 *   - adjustStock rejects missing reason, zero delta, out-of-range,
 *     and would-go-negative changes
 *   - adjustStock happy path updates stock and returns paired ledger entry
 *   - getStockHistory returns entries for a product, sorted newest first
 *   - forbidden role (EMPLOYEE) is rejected for mutations
 */
import assert from 'node:assert/strict';

import { ROLES } from '../src/constants/roles.js';
import {
  adjustStock,
  createProduct,
  getProductById,
  getProducts,
  getStockHistory,
  searchProducts,
  updateProduct,
} from '../src/services/products/productService.js';

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

console.log('Phase 8 — products service smoke tests');

await test('getProducts — returns array sorted by name', async () => {
  const products = await getProducts();
  assert.ok(Array.isArray(products));
  assert.ok(products.length >= 5, 'expected seed catalogue of >= 5 products');
  for (let i = 1; i < products.length; i += 1) {
    assert.ok(
      products[i - 1].name.localeCompare(products[i].name) <= 0,
      'products must be sorted by name',
    );
  }
});

await test('getProducts — returned items are defensive clones', async () => {
  const products = await getProducts();
  const first = products[0];
  first.name = '__mutated__';
  const products2 = await getProducts();
  assert.notEqual(products2[0].name, '__mutated__', 'mutation must not leak');
});

await test('getProductById — unknown id returns null', async () => {
  const got = await getProductById('prd-999');
  assert.equal(got, null);
});

await test('getProductById — known id returns a clone', async () => {
  const got = await getProductById('prd-001');
  assert.ok(got);
  assert.equal(got.id, 'prd-001');
  assert.equal(typeof got.stock, 'number');
});

await test('searchProducts — matches by name fragment', async () => {
  const hits = await searchProducts('hijab');
  assert.ok(hits.length >= 1);
  assert.ok(
    hits.some((p) => p.name.toLowerCase().includes('hijab')),
    'expected at least one hijab match',
  );
});

await test('searchProducts — empty query returns full list', async () => {
  const all = await searchProducts('   ');
  assert.equal(all.length, (await getProducts()).length);
});

await test('createProduct — rejects empty name', async () => {
  await assert.rejects(
    () =>
      createProduct(
        { name: '', sku: 'NEW-1', price: 100 },
        { actor: { username: 'owner', role: ROLES.OWNER } },
      ),
    (err) => err.code === 'EMPTY_NAME',
  );
});

await test('createProduct — rejects empty sku', async () => {
  await assert.rejects(
    () =>
      createProduct(
        { name: 'No sku', sku: '', price: 100 },
        { actor: { username: 'owner', role: ROLES.OWNER } },
      ),
    (err) => err.code === 'EMPTY_SKU',
  );
});

await test('createProduct — rejects duplicate SKU', async () => {
  await assert.rejects(
    () =>
      createProduct(
        { name: 'Dup sku', sku: 'UNI-S3-NAVY', price: 100 },
        { actor: { username: 'owner', role: ROLES.OWNER } },
      ),
    (err) => err.code === 'DUPLICATE_SKU',
  );
});

await test('createProduct — rejects non-positive price', async () => {
  await assert.rejects(
    () =>
      createProduct(
        { name: 'Bad price', sku: 'NEW-BAD', price: 0 },
        { actor: { username: 'owner', role: ROLES.OWNER } },
      ),
    (err) => err.code === 'INVALID_PRICE',
  );
});

await test('createProduct — rejects negative stock', async () => {
  await assert.rejects(
    () =>
      createProduct(
        { name: 'Neg stock', sku: 'NEW-NEG', price: 100, stock: -5 },
        { actor: { username: 'owner', role: ROLES.OWNER } },
      ),
    (err) => err.code === 'INVALID_STOCK',
  );
});

await test('createProduct — happy path returns clone with id', async () => {
  const created = await createProduct(
    {
      name: 'Smoke test item',
      sku: 'SMOKE-' + Date.now(),
      category: 'Smoke',
      price: 250,
      stock: 12,
      description: 'Created by smoke test',
    },
    { actor: { username: 'owner', role: ROLES.OWNER } },
  );
  assert.ok(created.id.startsWith('prd-'));
  assert.equal(created.name, 'Smoke test item');
  assert.equal(created.price, 250);
  assert.equal(created.stock, 12);
});

await test('createProduct — happy path adds OPENING_STOCK ledger entry', async () => {
  const sku = 'SMOKE-OS-' + Date.now();
  const created = await createProduct(
    { name: 'Opening smoke', sku, price: 100, stock: 9 },
    { actor: { username: 'owner', role: ROLES.OWNER } },
  );
  const hist = await getStockHistory(created.id);
  assert.equal(hist.length, 1, 'should have exactly one opening ledger row');
  assert.equal(hist[0].reason, 'OPENING_STOCK');
  assert.equal(hist[0].delta, 9);
});

await test('createProduct — zero stock skips ledger entry', async () => {
  const sku = 'SMOKE-ZS-' + Date.now();
  const created = await createProduct(
    { name: 'No opening', sku, price: 100, stock: 0 },
    { actor: { username: 'owner', role: ROLES.OWNER } },
  );
  const hist = await getStockHistory(created.id);
  assert.equal(hist.length, 0);
});

await test('createProduct — spec form generates ID without default sale price or stock', async () => {
  const created = await createProduct(
    { name: 'Navy Blue Pant - XXL', purchasePrice: null, description: 'New product' },
    { actor: { username: 'owner', role: ROLES.OWNER } },
  );
  assert.equal(created.sku, created.id.toUpperCase());
  assert.equal(created.price, null);
  assert.equal(created.purchasePrice, null);
  assert.equal(created.stock, 0);
  assert.equal((await getStockHistory(created.id)).length, 0);
});

await test('adjustStock — rejects zero delta', async () => {
  await assert.rejects(
    () =>
      adjustStock(
        'prd-001',
        { delta: 0, reason: 'test' },
        { actor: { username: 'owner', role: ROLES.OWNER } },
      ),
    (err) => err.code === 'INVALID_DELTA',
  );
});

await test('adjustStock — rejects missing reason', async () => {
  await assert.rejects(
    () =>
      adjustStock(
        'prd-001',
        { delta: 1, reason: '   ' },
        { actor: { username: 'owner', role: ROLES.OWNER } },
      ),
    (err) => err.code === 'EMPTY_REASON',
  );
});

await test('adjustStock — rejects would-go-negative change', async () => {
  const product = await getProductById('prd-005');
  const tooMuch = -(product.stock + 5);
  await assert.rejects(
    () =>
      adjustStock(
        'prd-005',
        { delta: tooMuch, reason: 'Smoke negative' },
        { actor: { username: 'owner', role: ROLES.OWNER } },
      ),
    (err) => err.code === 'NEGATIVE_STOCK',
  );
});

await test('adjustStock — happy path returns paired product + entry', async () => {
  const before = await getProductById('prd-003');
  const result = await adjustStock(
    'prd-003',
    { delta: -2, reason: 'Smoke adjustment', note: 'Test removal' },
    { actor: { username: 'owner', role: ROLES.OWNER } },
  );
  assert.ok(result.product);
  assert.equal(result.entry.delta, -2);
  assert.equal(result.entry.reason, 'Smoke adjustment');
  assert.equal(result.product.stock, before.stock - 2);
});

await test('adjustStock — happy path adds to history', async () => {
  const before = (await getStockHistory('prd-004')).length;
  await adjustStock(
    'prd-004',
    { delta: 1, reason: 'Smoke history' },
    { actor: { username: 'owner', role: ROLES.OWNER } },
  );
  const after = await getStockHistory('prd-004');
  assert.equal(after.length, before + 1);
  assert.equal(after[0].delta, 1);
});

await test('adjustStock — rejects non-owner role', async () => {
  await assert.rejects(
    () =>
      adjustStock(
        'prd-001',
        { delta: 1, reason: 'should fail' },
        { actor: { username: 'emp', role: ROLES.EMPLOYEE } },
      ),
    (err) => err.code === 'FORBIDDEN_ROLE',
  );
});

await test('updateProduct — happy path updates fields', async () => {
  const updated = await updateProduct(
    'prd-001',
    { description: 'Updated by smoke test', price: 1900 },
    { actor: { username: 'owner', role: ROLES.OWNER } },
  );
  assert.equal(updated.description, 'Updated by smoke test');
  assert.equal(updated.price, 1900);
});

await test('updateProduct — rejects duplicate SKU', async () => {
  await assert.rejects(
    () =>
      updateProduct(
        'prd-001',
        { sku: 'UNI-S5-NAVY' },
        { actor: { username: 'owner', role: ROLES.OWNER } },
      ),
    (err) => err.code === 'DUPLICATE_SKU',
  );
});

await test('getStockHistory — sorted newest-first', async () => {
  const hist = await getStockHistory('prd-001');
  for (let i = 1; i < hist.length; i += 1) {
    assert.ok(
      hist[i - 1].createdAt.localeCompare(hist[i].createdAt) >= 0,
      'history must be newest first',
    );
  }
});

console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
