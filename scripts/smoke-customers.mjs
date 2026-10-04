/**
 * smoke-customers.mjs — Phase 6 customer module contracts.
 *
 * Pattern follows scripts/smoke-sales.mjs:
 *   - Top-level await on every assertion (Node ESM)
 *   - PASS / FAIL counters, descriptive error messages
 *   - Array-returning methods get a `Array.isArray` regression guard
 *     (this is what bit us in Phase 4 with `stats.find is not a function`)
 *
 * What we cover (aligned to DATABASE_PLAN.md §8 customers + §9 children):
 *   1.  getCustomers() returns an array; every row exposes the schema
 *       fields (id, customerCode, name, phone, address, notes,
 *       isActive, audit timestamps). NOTE: customers do NOT have a
 *       `currentClass` — class is a child-level concept.
 *   2.  getCustomers(query) filters on name / phone / address
 *   3.  getCustomerById() returns a row with customerCode; 'unknown' returns null
 *   4.  createCustomer() rejects empty name (EMPTY_NAME) and short name
 *   5.  createCustomer() happy path returns the new customer with an
 *       auto-generated customerCode (CUS-NNNNNN) and audit timestamps
 *   6.  createCustomer() persists inline children atomically (Phase 4b)
 *   7.  createCustomer() with empty children array is still valid (regression guard)
 *   8.  createCustomer() rejects the whole transaction when a child
 *       name is missing (CHILD_EMPTY_NAME) — atomic guarantee
 *   9.  updateCustomer() merges patch + bumps audit; unknown id throws NOT_FOUND
 *   10. setCustomerStatus() toggles isActive (no delete semantics)
 *   11. getCustomerChildren() returns array; each child has currentClass
 *       (derived from initial_class + years_since(registered_date))
 *   12. getCustomerSalesHistory() returns array (regression guard)
 *   13. getCustomerCustomOrders() returns array (regression guard)
 *   14. getCustomerDueSummary() returns numeric totals + currency
 *   15. getCustomerBundle() returns null for unknown id, full bundle otherwise
 *   16. deriveCurrentClass() unit: numeric advances; alphabetic stays
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
import { createCustomer as createSalesCustomer, searchCustomers as searchSalesCustomers } from '../src/services/sales/salesService.js';

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

await test('getCustomers returns an array with customerCode on every row', async () => {
  const rows = await getCustomers();
  assert(Array.isArray(rows), `expected array, got ${typeof rows}`);
  assert(rows.length >= 6, `expected >= 6 mock customers, got ${rows.length}`);
  for (const c of rows) {
    assert(typeof c.id === 'string', 'id missing');
    assert(typeof c.customerCode === 'string', 'customerCode missing');
    assert(/^CUS-\d{6}$/.test(c.customerCode), `bad customerCode: ${c.customerCode}`);
    assert(typeof c.name === 'string', 'name missing');
    assert(typeof c.isActive === 'boolean', 'isActive missing');
    assert('notes' in c, 'notes field missing');
    assert(typeof c.createdAt === 'string', 'createdAt missing');
    assert(typeof c.updatedAt === 'string', 'updatedAt missing');
    assert(c.currentClass === undefined, 'customers must NOT carry a class');
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
  assert(typeof c.customerCode === 'string', 'customerCode missing on detail');
  assert(c.currentClass === undefined, 'detail must not expose customer class');
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

await test('createCustomer requires phone at both entry points', async () => {
  for (const create of [createCustomer, createSalesCustomer]) {
    let error;
    try { await create({ name: 'Phone Missing' }); } catch (caught) { error = caught; }
    assert(error?.code === 'EMPTY_PHONE', `expected EMPTY_PHONE, got ${error?.code}`);
  }
});

await test('createCustomer happy path sets audit columns + customerCode', async () => {
  const created = await createCustomer(
    { name: 'Smoke Tester', phone: '0000', notes: 'auto-created by smoke' },
    { actor: { username: 'smoke', role: 'OWNER' } },
  );
  assert(created.id, 'id missing');
  assert(typeof created.customerCode === 'string', 'customerCode missing');
  assert(/^CUS-\d{6}$/.test(created.customerCode), `bad customerCode: ${created.customerCode}`);
  assert(created.notes === 'auto-created by smoke', 'notes not stored');
  assert(created.createdBy === 'smoke', `createdBy wrong: ${created.createdBy}`);
  assert(created.createdByRole === 'OWNER', 'createdByRole wrong');
  assert(typeof created.createdAt === 'string', 'createdAt missing');
  assert(created.currentClass === undefined, 'created must not carry a class');
});

await test('createCustomer with inline children persists every child atomically', async () => {
  const created = await createCustomer(
    {
      name: 'Inline Kids Parent',
      phone: '01711-000111',
      notes: 'parent created with 2 kids',
      children: [
        {
          name: 'First Kid',
          initialClass: '2',
          schoolName: 'Banani School',
        },
        {
          name: 'Second Kid',
          initialClass: 'Nursery',
          schoolName: 'Banani School',
        },
      ],
    },
    { actor: { username: 'smoke', role: 'OWNER' } },
  );
  assert(created.id, 'parent id missing');

  const kids = await getCustomerChildren(created.id);
  assert(kids.length === 2, `expected 2 children, got ${kids.length}`);
  const [first, second] = kids;
  assert(first.name === 'First Kid', `first name wrong: ${first.name}`);
  assert(first.initialClass === '2', 'first class wrong');
  assert(first.schoolName === 'Banani School', 'first school wrong');
  assert(!('notes' in first), 'child must not have notes');
  assert(typeof first.currentClass === 'string', 'first currentClass missing');
  assert(first.customerId === created.id, 'first not linked to parent');
  assert(second.name === 'Second Kid', `second name wrong: ${second.name}`);
  assert(second.initialClass === 'Nursery', 'second class wrong');
  assert(second.customerId === created.id, 'second not linked to parent');
});

await test('createCustomer with empty children array still creates a customer', async () => {
  const created = await createCustomer(
    { name: 'No Kids Parent', phone: '01700000002', children: [] },
    { actor: { username: 'smoke', role: 'OWNER' } },
  );
  assert(created.id, 'parent id missing');
  const kids = await getCustomerChildren(created.id);
  assert(Array.isArray(kids) && kids.length === 0, 'no kids expected');
});

await test('both entry points share customer store, code search and child validation', async () => {
  const created = await createSalesCustomer({
    name: 'Shared Entry Parent', phone: '01700000004', address: 'Dhaka',
    notes: 'Guardian note', children: [{ name: 'Shared Child', initialClass: '2', schoolName: 'Test School' }],
  }, { actor: { username: 'employee', role: 'EMPLOYEE' } });
  assert(created.createdByRole === 'EMPLOYEE', 'actor role missing');
  assert((await getCustomers(created.customerCode)).some((row) => row.id === created.id), 'code search missing');
  assert((await searchSalesCustomers(created.phone)).some((row) => row.id === created.id), 'sale search missing');
  const child = (await getCustomerChildren(created.id))[0];
  assert(child.createdByRole === 'EMPLOYEE', 'child actor missing');
  assert(!('notes' in child), 'child notes must be absent');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(child.registeredDate), 'registered date missing');
});

await test('createCustomer rejects the whole transaction when a child is missing a name', async () => {
  const before = (await getCustomers()).length;
  let threw = null;
  try {
    await createCustomer(
      {
        name: 'Bad Kids Parent',
        phone: '01700000003',
        children: [
          { name: 'Good Kid', initialClass: '1', schoolName: 'Test School' },
          { name: '   ', initialClass: '2', schoolName: 'Test School' },
        ],
      },
      { actor: { username: 'smoke', role: 'OWNER' } },
    );
  } catch (e) {
    threw = e;
  }
  assert(threw, 'expected throw for missing child name');
  assert(threw.code === 'CHILD_EMPTY_NAME', `wrong code: ${threw.code}`);
  const after = (await getCustomers()).length;
  assert(after === before, 'partial customer must not be persisted');
});

await test('incomplete child rows reject customer creation atomically', async () => {
  const before = (await getCustomers()).length;
  let error;
  try {
    await createCustomer({
      name: 'Incomplete Child Parent', phone: '01700000008',
      children: [{ name: 'Child One', initialClass: '2', schoolName: '' }],
    });
  } catch (caught) { error = caught; }
  assert(error?.code === 'CHILD_REQUIRED_FIELDS', `expected CHILD_REQUIRED_FIELDS, got ${error?.code}`);
  assert((await getCustomers()).length === before, 'partial parent was saved');
});

await test('addCustomerChild keeps actor and omits child notes', async () => {
  const child = await addCustomerChild('cust-006', {
    name: 'Audit Child', initialClass: '1', schoolName: 'Test School',
    notes: 'Must not be saved',
  }, { actor: { username: 'employee', role: 'EMPLOYEE' } });
  assert(child.createdBy === 'employee' && child.createdByRole === 'EMPLOYEE', 'actor not saved');
  assert(!('notes' in child), 'child notes leaked');
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
    await updateCustomer('cust-nope', {}, { actor: { username: 'x', role: 'OWNER' } });
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

await test('deriveCurrentClass: numeric label advances by completed years since registration', async () => {
  const out = deriveCurrentClass('3', '2024-06-12', new Date('2026-06-12T06:00:00Z'));
  assert(out === '5', `expected "5" after 2 years, got "${out}"`);
});

await test('deriveCurrentClass: alphabetic label is unchanged', async () => {
  const out = deriveCurrentClass('A', '2024-06-12', new Date('2026-06-12T06:00:00Z'));
  assert(out === 'A', `expected "A", got "${out}"`);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
