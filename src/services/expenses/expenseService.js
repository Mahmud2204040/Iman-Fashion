/**
 * expenseService — Phase 11 mock.
 *
 * Owns expense records + the custom-category dictionary.
 *
 * Per FRONTEND_PLAN.md §11 and REQUIREMENTS.md §56-60:
 *   - Owner-only (employees must not see or manage).
 *   - Custom categories owned by the owner (no hardcoded enum, per §58).
 *   - Fields (REQUIREMENTS §57):
 *       id, category_id, amount, expense_date, description, notes,
 *       created_by, created_at, updated_at
 *   - Date required. Description optional.
 *   - Modal-based add form, per UX notes in §56.
 *
 * CRITICAL business rule (REQUIREMENTS §60, §D9, DATABASE_PLAN §40):
 *   - Creating an expense MUST NOT auto-create a cash transaction.
 *   - This file MUST NOT import or call cashService.
 *
 * Real backend will replace this file entirely.
 */
import { delay } from '../delay.js';
import { ROLES } from '../../constants/roles.js';

const OWNER_ROLE = [ROLES.OWNER];

/* -------------------------------------------------------------------------- */
/* Seed categories — these are baseline; owners can add more via the UI.       */
/* -------------------------------------------------------------------------- */

const CATEGORIES = [
  { id: 'cat-001', name: 'Electricity', description: 'Utility bills', isActive: true, createdBy: 'owner', createdAt: '2025-01-04T09:00:00Z', updatedAt: '2025-01-04T09:00:00Z' },
  { id: 'cat-002', name: 'Rent',        description: 'Shop rent',       isActive: true, createdBy: 'owner', createdAt: '2025-01-04T09:00:00Z', updatedAt: '2025-01-04T09:00:00Z' },
  { id: 'cat-003', name: 'Transport',   description: 'Delivery / travel', isActive: true, createdBy: 'owner', createdAt: '2025-01-04T09:00:00Z', updatedAt: '2025-01-04T09:00:00Z' },
  { id: 'cat-004', name: 'Maintenance', description: 'Repairs & upkeep',  isActive: true, createdBy: 'owner', createdAt: '2025-01-04T09:00:00Z', updatedAt: '2025-01-04T09:00:00Z' },
  { id: 'cat-005', name: 'Miscellaneous', description: 'Anything else',  isActive: true, createdBy: 'owner', createdAt: '2025-01-04T09:00:00Z', updatedAt: '2025-01-04T09:00:00Z' },
];

const EXPENSES = [
  {
    id: 'exp-001',
    categoryId: 'cat-001',
    categoryName: 'Electricity',
    amount: 3500,
    expenseDate: '2026-08-25',
    description: 'August electricity bill',
    notes: 'Auto-debit from bank',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2026-08-25T18:00:00Z',
    updatedAt: '2026-08-25T18:00:00Z',
  },
  {
    id: 'exp-002',
    categoryId: 'cat-002',
    categoryName: 'Rent',
    amount: 18000,
    expenseDate: '2026-09-01',
    description: 'September rent',
    notes: '',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'exp-003',
    categoryId: 'cat-003',
    categoryName: 'Transport',
    amount: 850,
    expenseDate: '2026-09-04',
    description: 'Delivery to Gulshan',
    notes: '',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2026-09-04T14:30:00Z',
    updatedAt: '2026-09-04T14:30:00Z',
  },
];

function nowIso() {
  return new Date().toISOString();
}

function requireOwner({ actor } = {}) {
  if (!actor || !OWNER_ROLE.includes(actor.role)) {
    const err = new Error('Only an owner can manage expenses.');
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }
}

function toDateOnly(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return '';
}

function normaliseAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function clone(o) {
  return { ...o };
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                    */
/* -------------------------------------------------------------------------- */

export async function getExpenseCategories() {
  await delay(80);
  return CATEGORIES.slice()
    .filter((c) => c.isActive)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(clone);
}

export async function createExpenseCategory(payload = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(140);

  const name = String(payload.name || '').trim();
  if (!name) {
    const err = new Error('Category name is required.');
    err.code = 'EMPTY_NAME';
    throw err;
  }
  if (name.length < 2) {
    const err = new Error('Category name must be at least 2 characters.');
    err.code = 'NAME_TOO_SHORT';
    throw err;
  }
  const exists = CATEGORIES.some(
    (c) => c.isActive && c.name.toLowerCase() === name.toLowerCase(),
  );
  if (exists) {
    const err = new Error('A category with this name already exists.');
    err.code = 'DUPLICATE_NAME';
    throw err;
  }

  const id = 'cat-' + String(CATEGORIES.length + 1).padStart(3, '0');
  const description = String(payload.description || '').trim();
  const created = {
    id,
    name,
    description,
    isActive: true,
    createdBy: actor?.username || 'owner',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  CATEGORIES.push(created);
  return clone(created);
}

/* -------------------------------------------------------------------------- */
/* Expenses                                                                      */
/* -------------------------------------------------------------------------- */

export async function getExpenses() {
  await delay(140);
  return EXPENSES.slice()
    .sort((a, b) => new Date(b.expenseDate) - new Date(a.expenseDate))
    .map(clone);
}

export async function createExpense(payload = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(180);

  const categoryId = String(payload.categoryId || '').trim();
  if (!categoryId) {
    const err = new Error('Please select an expense category.');
    err.code = 'EMPTY_CATEGORY';
    throw err;
  }
  const category = CATEGORIES.find((c) => c.id === categoryId && c.isActive);
  if (!category) {
    const err = new Error('Selected category is no longer available.');
    err.code = 'CATEGORY_NOT_FOUND';
    throw err;
  }

  const amount = normaliseAmount(payload.amount);
  if (amount === null) {
    const err = new Error('Amount must be a positive number.');
    err.code = 'INVALID_AMOUNT';
    throw err;
  }

  const expenseDate = toDateOnly(payload.expenseDate);
  if (!expenseDate) {
    const err = new Error('Date is required.');
    err.code = 'EMPTY_DATE';
    throw err;
  }

  const description = String(payload.description || '').trim();
  const notes = String(payload.notes || '').trim();

  const createdBy = actor?.username || 'unknown';
  const createdByRole = actor?.role || ROLES.OWNER;

  const id = 'exp-' + String(EXPENSES.length + 1).padStart(3, '0');
  const record = {
    id,
    categoryId,
    categoryName: category.name,
    amount,
    expenseDate,
    description,
    notes,
    createdBy,
    createdByRole,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  EXPENSES.push(record);

  // INTENTIONALLY NO cash-ledger side-effect.
  // REQUIREMENTS §60 / §D9 / DATABASE_PLAN §40.
  return clone(record);
}

/* -------------------------------------------------------------------------- */
/* Aggregations (for reports, future Phase 13)                                  */
/* -------------------------------------------------------------------------- */

export function aggregateExpensesByCategory(expenses = []) {
  const map = new Map();
  for (const e of expenses) {
    const key = e.categoryId || 'unknown';
    const cur = map.get(key) || {
      categoryId: key,
      categoryName: e.categoryName || 'Uncategorised',
      total: 0,
      count: 0,
    };
    cur.total += Number(e.amount || 0);
    cur.count += 1;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function sumExpensesByMonth(expenses = []) {
  const map = new Map();
  for (const e of expenses) {
    const ym = String(e.expenseDate || '').slice(0, 7);
    if (!ym) continue;
    map.set(ym, (map.get(ym) || 0) + Number(e.amount || 0));
  }
  return Array.from(map.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));
}
