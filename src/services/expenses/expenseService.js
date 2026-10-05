import { apiRequest } from '../api/apiClient.js';
import { ROLES } from '../../constants/roles.js';

const OWNER_ROLE = [ROLES.OWNER];

function requireOwner({ actor } = {}) {
  if (!actor || !OWNER_ROLE.includes(actor.role)) {
    const err = new Error('Only an owner can manage expenses.');
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }
}

function normalizeCategory(raw) {
  return {
    ...raw,
    isActive: raw.isActive ?? true,
    createdBy: raw.createdById || '',
  };
}

function normalizeExpense(raw, categoryMap = new Map()) {
  const categoryName = raw.category?.name || raw.categoryName || categoryMap.get(raw.expenseCategoryId || raw.categoryId) || '';
  return {
    ...raw,
    categoryId: raw.expenseCategoryId || raw.categoryId,
    categoryName,
    amount: Number(raw.amount || 0),
    expenseDate: raw.expenseDate ? String(raw.expenseDate).slice(0, 10) : '',
    description: raw.description || '',
    createdBy: raw.createdById || '',
  };
}

export async function getExpenseCategories() {
  const result = await apiRequest('/api/v1/expense-categories');
  return (result || []).map(normalizeCategory).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createExpenseCategory(payload = {}, { actor } = {}) {
  requireOwner({ actor });
  const body = {
    name: String(payload.name || '').trim(),
    ...(payload.description ? { description: String(payload.description).trim() } : {}),
  };
  const raw = await apiRequest('/api/v1/expense-categories', {
    method: 'POST',
    body,
  });
  return normalizeCategory(raw);
}

export async function getExpenses() {
  const categories = await getExpenseCategories();
  const categoryMap = new Map();
  for (const cat of categories) {
    categoryMap.set(cat.id, cat.name);
  }

  const result = await apiRequest('/api/v1/expenses?pageSize=100', { raw: true });
  let rows = result.data || [];
  if (result.meta && result.meta.total > rows.length) {
    let page = 2;
    while (rows.length < result.meta.total) {
      const next = await apiRequest(`/api/v1/expenses?page=${page}&pageSize=100`, { raw: true });
      rows = rows.concat(next.data || []);
      if (!next.data || next.data.length === 0) break;
      page += 1;
    }
  }

  return rows.map((e) => normalizeExpense(e, categoryMap));
}

export async function createExpense(payload = {}, { actor } = {}) {
  requireOwner({ actor });
  const categoryId = String(payload.categoryId || '').trim();
  const amount = Number(payload.amount);
  const expenseDate = String(payload.expenseDate || '').trim().slice(0, 10);
  const description = String(payload.description || '').trim();

  const body = {
    categoryId,
    amount: String(amount),
    expenseDate,
    ...(description ? { description } : {}),
  };

  const raw = await apiRequest('/api/v1/expenses', {
    method: 'POST',
    body,
    idempotencyKey: payload.idempotencyKey,
  });

  const categories = await getExpenseCategories();
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));
  return normalizeExpense(raw, categoryMap);
}

export async function updateExpense(id, patch = {}, { actor } = {}) {
  requireOwner({ actor });
  const body = {};

  if (patch.categoryId !== undefined) body.categoryId = String(patch.categoryId).trim();
  if (patch.amount !== undefined) body.amount = String(Number(patch.amount));
  if (patch.expenseDate !== undefined) body.expenseDate = String(patch.expenseDate).trim().slice(0, 10);
  if (patch.description !== undefined) body.description = String(patch.description).trim();

  const raw = await apiRequest(`/api/v1/expenses/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
  });

  const categories = await getExpenseCategories();
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));
  return normalizeExpense(raw, categoryMap);
}

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
