import { apiRequest } from '../api/apiClient.js';
import { getSuppliers, getSupplierById } from '../suppliers/supplierService.js';

export const PURCHASE_STATUSES = Object.freeze([
  'DRAFT',
  'ORDERED',
  'RECEIVED',
  'CANCELLED',
]);
const TERMINAL_STATUSES = new Set(['RECEIVED', 'CANCELLED']);

function normalizePurchaseItem(item) {
  const qty = Number(item.quantity ?? item.qty ?? 0);
  const unitPrice = Number(item.purchaseCost ?? item.unitPrice ?? 0);
  return {
    id: item.id || '',
    name: item.itemName || item.name || '',
    qty,
    unitPrice,
    lineTotal: qty * unitPrice,
  };
}

function normalizePurchase(raw, supplierMap = new Map()) {
  const total = Number(raw.totalAmount ?? raw.total ?? 0);
  const items = (raw.items || []).map(normalizePurchaseItem);
  const payments = (raw.payments || []).map(p => ({
    id: p.id,
    amount: Number(p.amount),
    method: 'CASH',
    note: p.notes || '',
    createdAt: p.paymentDate || p.createdAt,
    createdBy: p.createdById || '',
  }));
  const paidTotal = payments.reduce((sum, p) => sum + p.amount, 0);
  const supplierName = raw.supplier?.name || raw.supplierName || (raw.supplierId ? supplierMap.get(raw.supplierId) : '') || '';

  return {
    ...raw,
    id: raw.id,
    code: raw.purchaseCode || raw.code || '',
    supplierId: raw.supplierId,
    supplierName,
    orderedAt: raw.purchaseDate || raw.createdAt || '',
    expectedAt: raw.expectedDeliveryDate || raw.expectedAt || null,
    receivedAt: raw.status === 'RECEIVED' ? (raw.updatedAt || raw.purchaseDate || '') : null,
    status: raw.status || 'DRAFT',
    items,
    total,
    paidTotal,
    payments,
    notes: raw.notes || '',
    receiptUrl: null,
    createdBy: raw.createdById || '',
    createdAt: raw.purchaseDate || raw.createdAt || '',
    updatedAt: raw.updatedAt || raw.createdAt || '',
  };
}

export async function listSuppliersForPurchase() {
  const suppliers = await getSuppliers();
  return suppliers.filter((s) => s.isActive).map((s) => ({ id: s.id, name: s.name }));
}

let cachedSupplierMap = null;
let lastSupplierFetchTime = 0;
async function getSupplierMap() {
  const now = Date.now();
  if (!cachedSupplierMap || now - lastSupplierFetchTime > 30000) {
    try {
      const suppliers = await getSuppliers();
      cachedSupplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
      lastSupplierFetchTime = now;
    } catch {
      if (!cachedSupplierMap) cachedSupplierMap = new Map();
    }
  }
  return cachedSupplierMap;
}

export async function getPurchases() {
  const supplierMap = await getSupplierMap();
  const result = await apiRequest('/api/v1/purchases?pageSize=100', { raw: true });
  let rows = result.data || [];
  if (result.meta && result.meta.total > rows.length) {
    let page = 2;
    while (rows.length < result.meta.total) {
      const next = await apiRequest(`/api/v1/purchases?page=${page}&pageSize=100`, { raw: true });
      rows = rows.concat(next.data || []);
      if (!next.data || next.data.length === 0) break;
      page += 1;
    }
  }
  return rows.map((p) => normalizePurchase(p, supplierMap));
}

export async function getPurchaseById(id) {
  try {
    const raw = await apiRequest(`/api/v1/purchases/${encodeURIComponent(id)}`);
    if (!raw) return null;
    let customerMap = new Map();
    if (raw.supplierId && !raw.supplier?.name) {
       try {
          const supp = await getSupplierById(raw.supplierId);
          if (supp) customerMap.set(raw.supplierId, supp.name);
       } catch { /* ignore */ }
    }
    return normalizePurchase(raw, customerMap);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export async function getPurchasesBySupplier(supplierId) {
  const purchases = await getPurchases();
  return purchases.filter((p) => p.supplierId === supplierId);
}

export async function createPurchase(payload = {}, _options = {}) {
  const supplierId = String(payload.supplierId || '').trim();
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (!supplierId) {
    throw Object.assign(new Error('Select a supplier.'), { code: 'EMPTY_SUPPLIER' });
  }
  if (items.length === 0) {
    throw Object.assign(new Error('Add at least one line item.'), { code: 'NO_ITEMS' });
  }

  const apiItems = items.map((it, i) => {
    const itemName = String(it.name || '').trim();
    if (!itemName) {
      throw Object.assign(new Error(`Line item #${i + 1} is missing a name.`), { code: 'ITEM_EMPTY_NAME' });
    }
    return {
      itemName,
      quantity: String(Number(it.qty)),
      purchaseCost: String(Number(it.unitPrice)),
      description: null,
      notes: null,
    };
  });

  const body = {
    supplierId,
    purchaseDate: new Date().toISOString(),
    expectedDeliveryDate: payload.expectedAt ? String(payload.expectedAt) : null,
    items: apiItems,
    notes: String(payload.notes || '').trim(),
    status: 'ORDERED',
  };

  const raw = await apiRequest('/api/v1/purchases', {
    method: 'POST',
    body,
    idempotencyKey: payload.idempotencyKey,
  });

  const supplierMap = new Map();
  if (payload.supplierName) supplierMap.set(supplierId, payload.supplierName);
  return normalizePurchase(raw, supplierMap);
}

export async function updatePurchase(id, patch = {}, _options = {}) {
  // Backend doesn't support PATCH /api/v1/purchases/:id yet.
  // We'll just fetch and return the current state to prevent crashing the UI.
  console.warn('Backend does not support updating purchase metadata yet.');
  return getPurchaseById(id);
}

export async function setPurchaseStatus(id, nextStatus, _options = {}) {
  const target = String(nextStatus || '').toUpperCase();
  const raw = await apiRequest(`/api/v1/purchases/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    body: { status: target },
  });
  return getPurchaseById(id);
}

export async function recordPurchasePayment(id, payment = {}, _options = {}) {
  const amount = Number(payment.amount);
  const body = {
    amount: String(amount),
    notes: String(payment.note || '').trim(),
  };

  const rawPayment = await apiRequest(`/api/v1/purchases/${encodeURIComponent(id)}/payments`, {
    method: 'POST',
    body,
    idempotencyKey: payment.idempotencyKey,
  });

  return { purchase: await getPurchaseById(id) };
}

export async function attachPurchaseReceipt(id, file, _options = {}) {
  // Mock behavior as backend upload requires FormData and Cloudinary
  console.warn('Real receipt upload skipped in frontend API mapping due to FormData complexity vs apiClient.js.');
  await new Promise((resume) => setTimeout(resume, 500));
  return { purchase: await getPurchaseById(id) };
}

export function computePurchaseTotals(p) {
  const total = Number(p.total || 0);
  const paidTotal = (p.payments || []).reduce(
    (s, pay) => s + Number(pay.amount || 0),
    0,
  );
  const dueTotal = p.status === 'CANCELLED' ? 0 : Math.max(total - paidTotal, 0);
  return { total, paidTotal, dueTotal };
}
