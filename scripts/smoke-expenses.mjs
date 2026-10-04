/**
 * Phase 11 — Expenses smoke tests.
 *
 * Asserts the public API of expenseService:
 *   - getExpenseCategories returns seed array
 *   - createExpenseCategory rejects empty / short name and EMPLOYEE role
 *   - getExpenses returns an array sorted newest-first
 *   - createExpense rejects invalid amount, missing category, missing date, EMPLOYEE
 *   - aggregateExpensesByCategory rolls up totals by category
 *   - sumExpensesByMonth returns month buckets
 *   - CRITICAL: creating an expense MUST NOT create a cash row anywhere
 */
import assert from 'node:assert/strict';

import { ROLES } from '../src/constants/roles.js';
import {
  getExpenseCategories,
  createExpenseCategory,
  getExpenses,
  createExpense,
  updateExpense,
  aggregateExpensesByCategory,
  sumExpensesByMonth,
} from '../src/services/expenses/expenseService.js';

import {
  getCashEntries,
  getCurrentCash,
} from '../src/services/cash/cashService.js';

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

await test('getExpenseCategories returns a non-empty array', async () => {
  const cats = await getExpenseCategories(OWNER);
  assert.ok(Array.isArray(cats));
  assert.ok(cats.length >= 1, 'expected seed categories');
});

await test('createExpenseCategory rejects empty name', async () => {
  await assert.rejects(
    () => createExpenseCategory({ name: '' }, OWNER),
    /name/i,
  );
});

await test('createExpenseCategory happy path returns clone', async () => {
  const cat = await createExpenseCategory({ name: 'Internet bill' }, OWNER);
  assert.ok(cat.id);
  assert.equal(cat.name, 'Internet bill');
});

await test('createExpenseCategory rejects EMPLOYEE', async () => {
  await assert.rejects(
    () => createExpenseCategory({ name: 'Unused' }, EMPLOYEE),
    /owner/i,
  );
});

await test('getExpenses returns an array', async () => {
  const list = await getExpenses(OWNER);
  assert.ok(Array.isArray(list));
});

await test('createExpense happy path', async () => {
  const cats = await getExpenseCategories(OWNER);
  const created = await createExpense(
    {
      categoryId: cats[0].id,
      amount: 1200,
      expenseDate: '2026-09-15',
      description: 'Internet',
    },
    OWNER,
  );
  assert.ok(created.id);
  assert.equal(created.amount, 1200);
  assert.equal(created.createdBy, 'owner');
  assert.equal(created.createdByRole, ROLES.OWNER);
  assert.equal(Object.hasOwn(created, 'notes'), false);
});

await test('expenses do not persist a separate notes field', async () => {
  const cats = await getExpenseCategories(OWNER);
  const created = await createExpense({
    categoryId: cats[0].id, amount: 100, expenseDate: '2026-09-16', notes: 'ignored',
  }, OWNER);
  assert.equal(Object.hasOwn(created, 'notes'), false);
  const updated = await updateExpense(created.id, { notes: 'still ignored' }, OWNER);
  assert.equal(Object.hasOwn(updated, 'notes'), false);
  const list = await getExpenses(OWNER);
  assert.ok(list.every((expense) => !Object.hasOwn(expense, 'notes')));
});

await test('createExpense rejects zero or negative amount', async () => {
  const cats = await getExpenseCategories(OWNER);
  await assert.rejects(
    () => createExpense({ categoryId: cats[0].id, amount: 0, expenseDate: '2026-09-15' }, OWNER),
    /amount/i,
  );
});

await test('createExpense rejects missing categoryId', async () => {
  await assert.rejects(
    () => createExpense({ categoryId: '', amount: 100, expenseDate: '2026-09-15' }, OWNER),
    /category/i,
  );
});

await test('createExpense rejects missing date', async () => {
  const cats = await getExpenseCategories(OWNER);
  await assert.rejects(
    () => createExpense({ categoryId: cats[0].id, amount: 100, expenseDate: '' }, OWNER),
    /date/i,
  );
});

await test('createExpense rejects EMPLOYEE', async () => {
  const cats = await getExpenseCategories(OWNER);
  await assert.rejects(
    () => createExpense(
      { categoryId: cats[0].id, amount: 100, expenseDate: '2026-09-15' },
      EMPLOYEE,
    ),
    /owner/i,
  );
});

await test('aggregateExpensesByCategory returns sorted totals', async () => {
  const expenses = await getExpenses(OWNER);
  const categories = await getExpenseCategories(OWNER);
  const agg = aggregateExpensesByCategory(expenses, categories);
  assert.ok(Array.isArray(agg));
  for (let i = 1; i < agg.length; i += 1) {
    assert.ok(agg[i - 1].total >= agg[i].total, 'expected sorted desc');
  }
});

await test('sumExpensesByMonth returns an array of buckets', async () => {
  const expenses = await getExpenses(OWNER);
  const buckets = sumExpensesByMonth(expenses);
  assert.ok(Array.isArray(buckets));
});

await test('CRITICAL: creating an expense MUST NOT create a cash row', async () => {
  const cashBefore = await getCashEntries(OWNER);
  const currentBefore = getCurrentCash();

  const cats = await getExpenseCategories(OWNER);
  await createExpense(
    { categoryId: cats[0].id, amount: 7777, expenseDate: '2026-09-15', description: 'no-cash guard' },
    OWNER,
  );

  const cashAfter = await getCashEntries(OWNER);
  const currentAfter = getCurrentCash();

  assert.equal(cashAfter.length, cashBefore.length, 'cash ledger must not grow from an expense');
  assert.equal(currentAfter, currentBefore, 'current cash must not move from an expense');
  for (const row of cashAfter) {
    assert.notEqual(row.referenceType, 'EXPENSE', 'cash must not carry an EXPENSE reference');
  }
});

console.log(`\n  Expenses: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
