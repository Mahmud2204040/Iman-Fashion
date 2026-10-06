import { apiRequest } from '../api/apiClient.js';
import { getCustomers, getCustomerById } from '../customers/customerService.js';

export const CUSTOM_ORDER_STATUSES = Object.freeze([
  'PENDING',
  'READY',
  'DELIVERED',
  'CANCELLED',
]);

function normalizeCustomOrder(raw) {
  const quantity = Number(raw.quantity ?? raw.qty ?? 1);
  const total = Number(raw.totalPrice ?? raw.total ?? 0);
  const unitPrice = quantity > 0 ? total / quantity : total;
  const dueDate = raw.expectedDeliveryDate
    ? (typeof raw.expectedDeliveryDate === 'string' ? raw.expectedDeliveryDate.slice(0, 10) : new Date(raw.expectedDeliveryDate).toISOString().slice(0, 10))
    : (raw.dueDate || '');
  const createdAt = raw.orderDate || raw.createdAt || new Date().toISOString();
  const customerName = raw.customer?.name || raw.customerName || '';

  const payments = Array.isArray(raw.payments)
    ? raw.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount ?? 0),
        method: 'CASH',
        note: p.notes || p.note || '',
        createdBy: p.createdById || p.createdBy || '',
        createdAt: p.paymentDate || p.createdAt || '',
        cashInId: p.cashInId || null,
      }))
    : [];

  const statusHistory = Array.isArray(raw.statusHistory) && raw.statusHistory.length > 0
    ? raw.statusHistory
    : [
        { status: 'PENDING', at: createdAt, by: raw.createdById || 'system' },
        ...(raw.readyAt ? [{ status: 'READY', at: raw.readyAt, by: raw.readyById || '' }] : []),
        ...(raw.deliveredAt ? [{ status: 'DELIVERED', at: raw.deliveredAt, by: raw.deliveredById || '' }] : []),
        ...(raw.cancelledAt ? [{ status: 'CANCELLED', at: raw.cancelledAt, by: raw.cancelledById || '' }] : []),
      ];

  return {
    ...raw,
    id: raw.id,
    code: raw.orderCode || raw.code || '',
    orderCode: raw.orderCode || raw.code || '',
    customerId: raw.customerId,
    customerName,
    productName: raw.productName || '',
    description: raw.description || '',
    qty: quantity,
    quantity,
    unitPrice,
    total,
    totalPrice: total,
    status: raw.status || 'PENDING',
    dueDate,
    expectedDeliveryDate: dueDate,
    notes: raw.notes || '',
    payments,
    statusHistory,
    deliveredAt: raw.deliveredAt || null,
    cancelledAt: raw.cancelledAt || null,
    readyAt: raw.readyAt || null,
    createdAt,
    updatedAt: raw.updatedAt || createdAt,
    createdBy: raw.createdById || raw.createdBy || '',
    updatedBy: raw.updatedById || raw.updatedBy || '',
  };
}

export async function listCustomersForCustomOrders() {
  const result = await getCustomers({ pageSize: 5000 });
  return (result.data || []).filter((customer) => customer.isActive);
}

export async function getCustomOrders() {
  const result = await apiRequest('/api/v1/custom-orders?pageSize=100', { raw: true });
  let rows = result.data || [];
  if (result.meta && result.meta.total > rows.length) {
    let page = 2;
    while (rows.length < result.meta.total) {
      const next = await apiRequest(`/api/v1/custom-orders?page=${page}&pageSize=100`, { raw: true });
      rows = rows.concat(next.data || []);
      if (!next.data || next.data.length === 0) break;
      page += 1;
    }
  }
  return rows.map(normalizeCustomOrder);
}

export async function getCustomOrderById(id) {
  try {
    const raw = await apiRequest(`/api/v1/custom-orders/${encodeURIComponent(id)}`);
    if (!raw) return null;
    return normalizeCustomOrder(raw);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export async function createCustomOrder(payload = {}, _options = {}) {
  const qty = Number(payload.qty || payload.quantity || 1);
  const total = payload.totalPrice !== undefined
    ? Number(payload.totalPrice)
    : qty * Number(payload.unitPrice);
  const advance = Number(payload.advanceAmount ?? 0);
  const dueDate = String(payload.dueDate || payload.expectedDeliveryDate || '').trim();

  const body = {
    customerId: String(payload.customerId).trim(),
    productName: String(payload.productName || '').trim(),
    quantity: qty,
    totalPrice: String(total),
    expectedDeliveryDate: dueDate,
    ...(payload.description ? { description: String(payload.description).trim() } : {}),
    ...(payload.notes ? { notes: String(payload.notes).trim() } : {}),
    ...(advance > 0 ? { advanceAmount: String(advance) } : {}),
  };

  const raw = await apiRequest('/api/v1/custom-orders', {
    method: 'POST',
    body,
    idempotencyKey: payload.idempotencyKey,
  });
  return normalizeCustomOrder(raw);
}

export async function updateCustomOrder(id, patch = {}, _options = {}) {
  const body = {};
  if (patch.productName !== undefined) body.productName = String(patch.productName).trim();
  if (patch.description !== undefined) body.description = String(patch.description).trim();
  if (patch.notes !== undefined) body.notes = String(patch.notes).trim();
  if (patch.qty !== undefined) body.quantity = Number(patch.qty);
  if (patch.quantity !== undefined) body.quantity = Number(patch.quantity);
  if (patch.dueDate !== undefined) body.expectedDeliveryDate = String(patch.dueDate).trim();
  if (patch.expectedDeliveryDate !== undefined) body.expectedDeliveryDate = String(patch.expectedDeliveryDate).trim();

  if (patch.totalPrice !== undefined) {
    body.totalPrice = String(patch.totalPrice);
  } else if (patch.unitPrice !== undefined || patch.qty !== undefined) {
    const current = await getCustomOrderById(id);
    if (current) {
      const q = patch.qty !== undefined ? Number(patch.qty) : current.qty;
      const u = patch.unitPrice !== undefined ? Number(patch.unitPrice) : current.unitPrice;
      body.totalPrice = String(q * u);
    }
  }

  const raw = await apiRequest(`/api/v1/custom-orders/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
  });
  return normalizeCustomOrder(raw);
}

export async function setCustomOrderStatus(id, nextStatus, options = {}) {
  const target = String(nextStatus || '').toLowerCase();
  let endpointAction = '';
  if (target === 'ready') endpointAction = 'ready';
  else if (target === 'delivered') endpointAction = 'deliver';
  else if (target === 'cancelled') endpointAction = 'cancel';
  else throw new Error('Unknown custom order status: ' + nextStatus);

  const body = endpointAction === 'cancel' ? { reason: options.reason || 'Cancelled by user' } : {};
  await apiRequest(`/api/v1/custom-orders/${encodeURIComponent(id)}/${endpointAction}`, {
    method: 'POST',
    body,
  });
  return getCustomOrderById(id);
}

export async function recordCustomOrderPayment(id, payment = {}, _options = {}) {
  const amount = Number(payment.amount);
  const body = {
    amount: String(amount),
    ...(payment.note ? { notes: String(payment.note).trim() } : (payment.notes ? { notes: String(payment.notes).trim() } : {})),
  };

  const rawPayment = await apiRequest(`/api/v1/custom-orders/${encodeURIComponent(id)}/payments`, {
    method: 'POST',
    body,
    idempotencyKey: payment.idempotencyKey,
  });

  const order = await getCustomOrderById(id);
  const paymentRow = {
    id: rawPayment.id,
    amount: Number(rawPayment.amount),
    method: 'CASH',
    note: rawPayment.notes || '',
    createdAt: rawPayment.paymentDate || rawPayment.createdAt,
    cashInId: null,
  };

  return {
    order,
    payment: paymentRow,
    cashIn: null,
  };
}

export async function getCustomOrderPayments(id) {
  const order = await getCustomOrderById(id);
  return order?.payments || [];
}
