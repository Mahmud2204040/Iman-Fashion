/**
 * smoke-customers.mjs — Phase 6 customer module contracts.
 *
 * Pattern follows scripts/smoke-sales.mjs:
 *   - Top-level await on every assertion (Node ESM)
 *   - PASS / FAIL counters, descriptive error messages
 *   - Array-returning methods get a `Array.isArray` regression guard
 *     (this is what bit us in Phase 4 with `stats.find is not a function`)
 *
 * What we cover:
 *   1.  getCustomers() returns an array; currentClass is derived for every row
 *   2.  getCustomers(query) filters on name / phone / address
 *   3.  getCustomerById() returns a decorated object; 'unknown' returns null
 *   4.  createCustomer() rejects empty name (EMPTY_NAME) and short name
 *   5.  createCustomer() happy path returns a decorated customer + sets audit
 *   6.  updateCustomer() merges patch + bumps audit; unknown id throws NOT_FOUND
 *   7.  setCustomerStatus() toggles isActive (no delete semantics)
 *   8.  getCustomerChildren() returns array; each child has currentClass
 *   9.  getCustomerSalesHistory() returns array (regression guard)
 *   10. getCustomerCustomOrders() returns array (regression guard)
 *   11. getCustomerDueSummary() returns numeric totals + currency
 *   12. getCustomerBundle() returns null for unknown id, full bundle otherwise
 *   13. deriveCurrentClass() unit: numeric advances; alphabetic stays
 */
import {
  addCustomerChild,
  createCustomer,
  getCustomerBundle,
  getCustomerById,
  getCustomerChildren,
  getCustomerCustomOrders,
  getCustomerDueSummary,
  getCustomerSalesHistory,
  getCustomers,
  setCustomerStatus,
  updateCustomer,
} from '../src/services/customers/customerService.js';
import { deriveCurrentClass } from '../src/utils/customer.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL  ${name}\n        ${err?.message || err}`);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

console.log('\n=== customer smoke tests ===\n');

await test('getCustomers returns an array with currentClass on every row', async () => {
  const rows = await getCustomers();
  assert(Array.isArray(rows), `expected array, got ${typeof rows}`);
  assert(rows.length >= 6, `expected >= 6 mock customers, got ${rows.length}`);
  for (const c of rows) {
    assert(typeof c.currentClass === 'string', 'currentClass missing');
    assert(typeof c.id === 'string', 'id missing');
    assert(typeof c.name === 'string', 'name missing');
    assert(typeof c.isActive === 'boolean', 'isActive missing');
  }
});

await test('getCustomers(query) filters on name / phone / address', async () => {
  const byName = await getCustomers('Anika');
  assert(byName.length >= 1, 'name filter returned 0');
  assert(byName.every((c) => c.name.includes('Anika')), 'wrong row');
  const byPhone = await getCustomers('01711');
  assert(byPhone.length >= 1, 'phone filter returned 0');
  const byAddress = await getCustomers('Banani');
  assert(byAddress.length >= 1, 'address filter returned 0');
});

await test('getCustomerById returns decorated customer; unknown returns null', async () => {
  const c = await getCustomerById('cust-001');
  assert(c && c.id === 'cust-001', 'cust-001 not returned');
  assert(typeof c.currentClass === 'string', 'currentClass missing on detail');
  const missing = await getCustomerById('cust-does-not-exist');
  assert(missing === null, `expected null, got ${JSON.stringify(missing)}`);
});

await test('createCustomer rejects empty name with EMPTY_NAME', async () => {
  let threw = null;
  try {
    await createCustomer({ name: '' }, { actor: { username: 'test' } });
  } catch (e) {
    threw = e;
  }
  assert(threw, 'expected EMPTY_NAME throw');
  assert(threw.code === 'EMPTY_NAME', `wrong code: ${threw.code}`);
});

await test('createCustomer rejects name shorter than 2 chars', async () => {
  let threw = null;
  try {
    await createCustomer({ name: 'A' }, { actor: { username: 'test' } });
  } catch (e) {
    threw = e;
  }
  assert(threw, 'expected NAME_TOO_SHORT throw');
  assert(threw.code === 'NAME_TOO_SHORT', `wrong code: ${threw.code}`);
});

await test('createCustomer happy path sets audit columns + currentClass', async () => {
  const created = await createCustomer(
    { name: 'Smoke Tester', phone: '0000', initialClass: '1' },
    { actor: { username: 'smoke', role: 'OWNER' } },
  );
  assert(created.id, 'id missing');
  assert(created.createdBy === 'smoke', `createdBy wrong: ${created.createdBy}`);
  assert(created.createdByRole === 'OWNER', 'createdByRole wrong');
  assert(typeof created.currentClass === 'string', 'currentClass missing');
});

await test('updateCustomer merges patch + bumps audit; unknown id throws', async () => {
  const updated = await updateCustomer(
    'cust-002',
    { phone: '01815-999999' },
    { actor: { username: 'editor', role: 'EMPLOYEE' } },
  );
  assert(updated.phone === '01815-999999', 'patch not applied');
  assert(updated.updatedBy === 'editor', 'updatedBy not bumped');
  assert(updated.createdBy !== undefined, 'createdBy must survive update');

  let threw = null;
  try {
    await updateCustomer('cust-nope', {}, { actor: { username: 'x' } });
  } catch (e) {
    threw = e;
  }
  assert(threw && threw.code === 'NOT_FOUND', 'expected NOT_FOUND');
});

await test('setCustomerStatus toggles isActive (no delete)', async () => {
  const before = await getCustomerById('cust-004');
  assert(before.isActive === true, 'precondition: cust-004 must be active');
  const after = await setCustomerStatus(
    'cust-004',
    false,
    { actor: { username: 'owner', role: 'OWNER' } },
  );
  assert(after.isActive === false, 'status not toggled');
  // toggle back so subsequent runs don't drift
  await setCustomerStatus('cust-004', true, {
    actor: { username: 'owner', role: 'OWNER' },
  });
});

await test('getCustomerChildren returns array with currentClass on each', async () => {
  const kids = await getCustomerChildren('cust-001');
  assert(Array.isArray(kids), 'expected array');
  assert(kids.length >= 1, 'expected at least one child for cust-001');
  for (const k of kids) {
    assert(typeof k.currentClass === 'string', 'child currentClass missing');
    assert(k.customerId === 'cust-001', 'wrong parent linked');
  }
});

await test('getCustomerSalesHistory returns an array (regression guard)', async () => {
  const sales = await getCustomerSalesHistory('cust-001');
  assert(Array.isArray(sales), `expected array, got ${typeof sales}`);
});

await test('getCustomerCustomOrders returns an array (regression guard)', async () => {
  const orders = await getCustomerCustomOrders('cust-001');
  assert(Array.isArray(orders), `expected array, got ${typeof orders}`);
});

await test('getCustomerDueSummary returns numeric totals + currency', async () => {
  const due = await getCustomerDueSummary('cust-001');
  assert(due && typeof due === 'object', 'expected object');
  assert(typeof due.totalDue === 'number', 'totalDue not a number');
  assert(due.currency === 'BDT', 'currency missing');
  assert(Array.isArray(due.openCustomOrders), 'openCustomOrders not array');
});

await test('getCustomerBundle returns null for unknown id', async () => {
  const bundle = await getCustomerBundle('cust-nope');
  assert(bundle === null, `expected null, got ${JSON.stringify(bundle)}`);
});

await test('getCustomerBundle returns full bundle for known id', async () => {
  const bundle = await getCustomerBundle('cust-001');
  assert(bundle && bundle.customer && bundle.customer.id === 'cust-001', 'customer missing');
  assert(Array.isArray(bundle.children), 'children not array');
  assert(Array.isArray(bundle.sales), 'sales not array');
  assert(Array.isArray(bundle.customOrders), 'customOrders not array');
  assert(bundle.dueSummary && typeof bundle.dueSummary.totalDue === 'number', 'dueSummary missing');
  assert(bundle.errors && typeof bundle.errors === 'object', 'errors map missing');
});

await test('deriveCurrentClass: numeric label advances by years since createdAt', async () => {
  const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
  const out = deriveCurrentClass('3', twoYearsAgo, new Date());
  assert(out === '5', `expected "5" after 2 years, got "${out}"`);
});

await test('deriveCurrentClass: alphabetic label is unchanged', async () => {
  const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
  const out = deriveCurrentClass('A', twoYearsAgo, new Date());
  assert(out === 'A', `expected "A", got "${out}"`);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
