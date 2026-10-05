import { apiRequest } from '../api/apiClient.js';
import { ROLES } from '../../constants/roles.js';

function normalizeSupplier(raw) {
  return {
    ...raw,
    supplierCode: raw.supplierCode || '',
    isActive: raw.isActive ?? true,
    createdBy: raw.createdById || '',
    updatedBy: raw.updatedById || '',
  };
}

export async function getSuppliers() {
  const result = await apiRequest('/api/v1/suppliers?pageSize=100', { raw: true });
  let rows = result.data || [];
  if (result.meta && result.meta.total > rows.length) {
    let page = 2;
    while (rows.length < result.meta.total) {
      const next = await apiRequest(`/api/v1/suppliers?page=${page}&pageSize=100`, { raw: true });
      rows = rows.concat(next.data || []);
      if (!next.data || next.data.length === 0) break;
      page += 1;
    }
  }
  return rows.map(normalizeSupplier);
}

export async function getSupplierById(id) {
  try {
    const raw = await apiRequest(`/api/v1/suppliers/${encodeURIComponent(id)}`);
    if (!raw) return null;
    return normalizeSupplier(raw);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export async function searchSuppliers(query = '') {
  const q = String(query || '').trim();
  if (!q) {
    return getSuppliers();
  }
  const result = await apiRequest(`/api/v1/suppliers?search=${encodeURIComponent(q)}&pageSize=100`, { raw: true });
  return (result.data || []).map(normalizeSupplier);
}

export async function createSupplier(payload = {}, _options = {}) {
  const body = {
    name: String(payload.name || '').trim(),
    phone: String(payload.phone || '').trim(),
    isActive: payload.isActive === false ? false : true,
    ...(payload.contactPerson ? { contactPerson: String(payload.contactPerson).trim() } : {}),
    ...(payload.email ? { email: String(payload.email).trim() } : {}),
    ...(payload.address ? { address: String(payload.address).trim() } : {}),
    ...(payload.notes ? { notes: String(payload.notes).trim() } : {}),
  };

  const raw = await apiRequest('/api/v1/suppliers', {
    method: 'POST',
    body,
  });

  return normalizeSupplier(raw);
}

export async function updateSupplier(id, patch = {}, _options = {}) {
  const body = {};
  if (patch.name !== undefined) body.name = String(patch.name).trim();
  if (patch.phone !== undefined) body.phone = String(patch.phone).trim();
  if (patch.contactPerson !== undefined) body.contactPerson = String(patch.contactPerson).trim();
  if (patch.email !== undefined) body.email = String(patch.email).trim();
  if (patch.address !== undefined) body.address = String(patch.address).trim();
  if (patch.notes !== undefined) body.notes = String(patch.notes).trim();
  if (patch.isActive !== undefined) body.isActive = Boolean(patch.isActive);

  const raw = await apiRequest(`/api/v1/suppliers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
  });

  return normalizeSupplier(raw);
}

export async function setSupplierStatus(id, isActive, _options = {}) {
  return updateSupplier(id, { isActive }, _options);
}

export function computeSupplierTotals(supplier, purchases = []) {
  const mine = purchases.filter((p) => p.supplierId === supplier.id);
  const purchasesTotal = mine.reduce((s, p) => s + Number(p.total || 0), 0);
  const paidTotal = mine.reduce(
    (s, p) =>
      s +
      (p.payments || []).reduce((x, pay) => x + Number(pay.amount || 0), 0),
    0,
  );
  const dueTotal = mine.reduce((sum, purchase) => {
    if (purchase.status === 'CANCELLED') return sum;
    const paid = (purchase.payments || []).reduce((amount, payment) => amount + Number(payment.amount || 0), 0);
    return sum + Math.max(Number(purchase.total || 0) - paid, 0);
  }, 0);
  return {
    purchasesTotal,
    paidTotal,
    dueTotal,
    purchaseCount: mine.length,
  };
}

export function getAllSupplierPayments(purchases = []) {
  const rows = [];
  for (const p of purchases) {
    for (const pay of p.payments || []) {
      rows.push({
        ...pay,
        supplierId: p.supplierId,
        supplierName: p.supplierName,
        purchaseId: p.id,
        purchaseCode: p.code,
      });
    }
  }
  return rows
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
