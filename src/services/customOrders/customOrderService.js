/**
 * customOrderService — Phase 7 mock.
 *
 * Owns the custom-orders workflow:
 *   - List + detail
 *   - Create custom order (single product + qty per FRONTEND_PLAN.md §7)
 *   - Status transitions (PENDING → READY → DELIVERED, plus CANCELLED)
 *   - Record payment — creates a paired CASH_IN row with
 *     `referenceType: CUSTOM_ORDER_PAYMENT`, mirroring DATABASE_PLAN.md's
 *     `cash_transactions` contract.
 *
 * In-memory + deterministic. Real backend will replace this file entirely.
 * No business rules beyond those documented in FRONTEND_PLAN.md are
 * introduced here.
 *
 * Cancellation retains all payments and never auto-reverses cash.
 */
import { delay } from '../delay.js';
import { ROLES } from '../../constants/roles.js';
import { _appendCashIn } from '../cash/cashService.js';
import { getCustomerById, getCustomers } from '../customers/customerService.js';

/* -------------------------------------------------------------------------- */
/* Custom order statuses                                                       */
/* -------------------------------------------------------------------------- */

export const CUSTOM_ORDER_STATUSES = Object.freeze([
  'PENDING',
  'READY',
  'DELIVERED',
  'CANCELLED',
]);

const TERMINAL_STATUSES = new Set(['DELIVERED', 'CANCELLED']);

/* -------------------------------------------------------------------------- */
/* Seed catalogue                                                              */
/* -------------------------------------------------------------------------- */

const ORDERS = [
  {
    id: 'co-001',
    code: 'CO-20260901-0003',
    customerId: 'cust-001',
    customerName: 'Anika Tabassum',
    productName: 'Embroidered three-piece (georgette)',
    description: 'Custom embroidery pattern, navy base, size 38',
    qty: 1,
    unitPrice: 3400,
    total: 3400,
    status: 'PENDING',
    dueDate: '2026-09-25T00:00:00Z',
    notes: 'Customer wants delivery before Eid.',
    payments: [
      {
        id: 'pay-co-001',
        amount: 1500,
        method: 'CASH',
        note: 'Advance at order placement',
        createdBy: 'owner',
        createdByRole: ROLES.OWNER,
        createdAt: '2026-09-01T11:30:00Z',
        cashInId: 'cashin-co-001',
      },
    ],
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2026-09-01T11:24:00Z',
    updatedAt: '2026-09-04T09:10:00Z',
    statusHistory: [{ status: 'PENDING', at: '2026-09-01T11:24:00Z', by: 'owner' }],
  },
  {
    id: 'co-002',
    code: 'CO-20260830-0002',
    customerId: 'cust-005',
    customerName: 'Nusrat Jahan',
    productName: 'School uniform set (Class 2)',
    description: '4 sets, name-tag embroidery, white & blue',
    qty: 4,
    unitPrice: 1950,
    total: 7800,
    status: 'READY',
    dueDate: '2026-09-10T00:00:00Z',
    notes: 'Pickup on Friday after 4pm.',
    payments: [
      {
        id: 'pay-co-002',
        amount: 3900,
        method: 'CASH',
        note: '50% advance',
        createdBy: 'owner',
        createdByRole: ROLES.OWNER,
        createdAt: '2026-08-30T14:20:00Z',
        cashInId: 'cashin-co-002',
      },
    ],
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2026-08-30T14:15:00Z',
    updatedAt: '2026-09-08T18:00:00Z',
    statusHistory: [
      { status: 'PENDING', at: '2026-08-30T14:15:00Z', by: 'owner' },
      { status: 'READY', at: '2026-09-08T18:00:00Z', by: 'owner' },
    ],
  },
  {
    id: 'co-003',
    code: 'CO-20260825-0001',
    customerId: 'cust-002',
    customerName: 'Tahmid Hossain',
    productName: 'Tailored panjabi (cotton)',
    description: 'Off-white, contrast piping, size 42',
    qty: 1,
    unitPrice: 2200,
    total: 2200,
    status: 'PENDING',
    dueDate: '2026-09-20T00:00:00Z',
    notes: 'Awaiting fabric confirmation from supplier.',
    payments: [],
    createdBy: 'employee',
    createdByRole: ROLES.EMPLOYEE,
    createdAt: '2026-08-25T16:42:00Z',
    updatedAt: '2026-08-25T16:42:00Z',
    statusHistory: [{ status: 'PENDING', at: '2026-08-25T16:42:00Z', by: 'employee' }],
  },
];

/* -------------------------------------------------------------------------- */
/* Code generation                                                             */
/* -------------------------------------------------------------------------- */

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function nextOrderCodeFor(date = new Date()) {
  const prefix = `CO-${ymd(date)}-`;
  const sameDay = ORDERS.filter((o) => o.code.startsWith(prefix));
  const seq = sameDay.length + 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

/* -------------------------------------------------------------------------- */
/* Customer lookup (used by detail page when customer is missing)             */
/* -------------------------------------------------------------------------- */

export async function listCustomersForCustomOrders() {
  const customers = await getCustomers();
  return customers.filter((customer) => customer.isActive);
}

/* -------------------------------------------------------------------------- */
/* List / detail                                                               */
/* -------------------------------------------------------------------------- */

export async function getCustomOrders() {
  await delay(140);
  return ORDERS.slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(clone);
}

export async function getCustomOrderById(id) {
  await delay(80);
  const found = ORDERS.find((o) => o.id === id);
  if (!found) return null;
  return clone(found);
}

function clone(o) {
  return {
    ...o,
    payments: (o.payments || []).map((p) => ({ ...p })),
    statusHistory: (o.statusHistory || []).map((event) => ({ ...event })),
  };
}

/* -------------------------------------------------------------------------- */
/* Create custom order                                                         */
/* -------------------------------------------------------------------------- */

export async function createCustomOrder(payload = {}, { actor } = {}) {
  await delay(180);

  const customerId = String(payload.customerId || '').trim();
  const customerName = String(payload.customerName || '').trim();
  const productName = String(payload.productName || '').trim();
  const description = String(payload.description || '').trim();
  const notes = String(payload.notes || '').trim();

  const qty = Number(payload.qty);

  if (!customerId) {
    const err = new Error('Select a customer for this custom order.');
    err.code = 'EMPTY_CUSTOMER';
    throw err;
  }

  const customer = await getCustomerById(customerId);
  if (!customer) {
    const err = new Error('Selected customer could not be found.');
    err.code = 'CUSTOMER_NOT_FOUND';
    throw err;
  }
  if (!customer.isActive) {
    const err = new Error('Select an active customer for this custom order.');
    err.code = 'INACTIVE_CUSTOMER';
    throw err;
  }

  if (!productName) {
    const err = new Error('Product name is required.');
    err.code = 'EMPTY_PRODUCT';
    throw err;
  }

  if (!Number.isInteger(qty) || qty < 1) {
    const err = new Error('Quantity must be at least 1.');
    err.code = 'INVALID_QTY';
    throw err;
  }

  const hasTotalPrice = payload.totalPrice !== undefined;
  const total = hasTotalPrice
    ? Number(payload.totalPrice)
    : qty * Number(payload.unitPrice);
  const unitPrice = total / qty;
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(unitPrice)) {
    const err = new Error('Total price must be greater than zero.');
    err.code = 'INVALID_PRICE';
    throw err;
  }

  const advanceAmount = Number(payload.advanceAmount ?? 0);
  if (!Number.isFinite(advanceAmount) || advanceAmount < 0 || advanceAmount > total) {
    const err = new Error('Advance must be between zero and the order total.');
    err.code = 'INVALID_ADVANCE';
    throw err;
  }
  if (advanceAmount > 0 && payload.advanceMethod && String(payload.advanceMethod).toUpperCase() !== 'CASH') {
    const err = new Error('Only cash payments are accepted.');
    err.code = 'CASH_ONLY';
    throw err;
  }

  const dueDate = String(payload.dueDate || '').trim();
  const parsedDueDate = new Date(`${dueDate}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
    Number.isNaN(parsedDueDate.getTime()) ||
    parsedDueDate.toISOString().slice(0, 10) !== dueDate
  ) {
    const err = new Error('Expected delivery date is required and must be valid.');
    err.code = 'INVALID_DUE_DATE';
    throw err;
  }

  const now = new Date();
  const code = nextOrderCodeFor(now);
  const id = `co-${String(ORDERS.length + 1).padStart(3, '0')}`;

  const createdBy = actor?.username || 'unknown';
  const createdByRole = actor?.role || null;

  const order = {
    id,
    code,
    customerId,
    customerName: customerName || customer.name,
    productName,
    description,
    qty,
    unitPrice,
    total,
    status: 'PENDING',
    dueDate,
    notes,
    payments: [],
    createdBy,
    createdByRole,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    statusHistory: [{ status: 'PENDING', at: now.toISOString(), by: createdBy }],
  };

  if (advanceAmount > 0) {
    const paymentId = `pay-${id}-1`;
    const cashIn = _appendCashIn({
      amount: advanceAmount,
      referenceType: 'CUSTOM_ORDER_PAYMENT',
      referenceId: paymentId,
      reason: 'Custom-order advance ' + code,
      createdBy,
      createdByRole,
      createdAt: now.toISOString(),
    });
    order.payments.push({
      id: paymentId,
      amount: advanceAmount,
      method: 'CASH',
      note: 'Advance at order placement',
      createdBy,
      createdByRole,
      createdAt: now.toISOString(),
      cashInId: cashIn.id,
    });
  }

  ORDERS.push(order);
  return clone(order);
}

/* -------------------------------------------------------------------------- */
/* Update metadata (notes, dueDate, description, qty/price while PENDING)      */
/* -------------------------------------------------------------------------- */

export async function updateCustomOrder(id, patch = {}, { actor } = {}) {
  await delay(120);
  if (actor?.role !== ROLES.OWNER) {
    const err = new Error('Only the owner can edit custom-order terms.');
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }
  const order = ORDERS.find((o) => o.id === id);
  if (!order) return null;
  if (TERMINAL_STATUSES.has(order.status)) {
    const err = new Error('Cannot edit a completed or cancelled order.');
    err.code = 'IMMUTABLE';
    throw err;
  }

  const next = { ...order };
  if (patch.description !== undefined) next.description = String(patch.description || '').trim();
  if (patch.notes !== undefined) next.notes = String(patch.notes || '').trim();
  if (patch.dueDate !== undefined) {
    const dueDate = String(patch.dueDate || '').trim();
    const parsedDueDate = new Date(`${dueDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(parsedDueDate.getTime()) || parsedDueDate.toISOString().slice(0, 10) !== dueDate) {
      const err = new Error('Expected delivery date is required and must be valid.');
      err.code = 'INVALID_DUE_DATE';
      throw err;
    }
    next.dueDate = dueDate;
  }
  if (patch.qty !== undefined) {
    const q = Number(patch.qty);
    if (!Number.isInteger(q) || q < 1) {
      const err = new Error('Quantity must be at least 1.');
      err.code = 'INVALID_QTY';
      throw err;
    }
    next.qty = q;
  }
  if (patch.unitPrice !== undefined) {
    const p = Number(patch.unitPrice);
    if (!Number.isFinite(p) || p <= 0) {
      const err = new Error('Unit price must be greater than zero.');
      err.code = 'INVALID_PRICE';
      throw err;
    }
    next.unitPrice = p;
  }

  next.total = next.qty * next.unitPrice;
  const paid = order.payments.reduce((sum, payment) => sum + payment.amount, 0);
  if (next.total < paid) {
    const err = new Error('Order total cannot be less than payments already recorded.');
    err.code = 'BELOW_PAID';
    throw err;
  }
  next.updatedAt = new Date().toISOString();
  next.updatedBy = actor?.username || 'unknown';
  Object.assign(order, next);

  return clone(order);
}

/* -------------------------------------------------------------------------- */
/* Status transitions                                                          */
/* -------------------------------------------------------------------------- */

export async function setCustomOrderStatus(id, nextStatus, { actor } = {}) {
  await delay(120);
  if (actor?.role !== ROLES.OWNER && actor?.role !== ROLES.EMPLOYEE) {
    const err = new Error('Only the owner or an employee can change custom-order status.');
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }
  const target = String(nextStatus || '').toUpperCase();
  if (!CUSTOM_ORDER_STATUSES.includes(target)) {
    const err = new Error('Unknown status: ' + nextStatus);
    err.code = 'INVALID_STATUS';
    throw err;
  }

  const order = ORDERS.find((o) => o.id === id);
  if (!order) return null;

  const allowed = {
    PENDING: ['READY', 'CANCELLED'],
    READY: ['DELIVERED', 'CANCELLED'],
    DELIVERED: [],
    CANCELLED: [],
  };
  if (!allowed[order.status]?.includes(target)) {
    const err = new Error(`Cannot move order from ${order.status} to ${target}.`);
    err.code = 'INVALID_TRANSITION';
    throw err;
  }
  const paid = order.payments.reduce((sum, payment) => sum + payment.amount, 0);
  if (target === 'DELIVERED' && Math.abs(order.total - paid) > 0.0001) {
    const err = new Error('Order must be fully paid before delivery.');
    err.code = 'UNPAID_DELIVERY';
    throw err;
  }

  order.status = target;
  order.updatedAt = new Date().toISOString();
  order.updatedBy = actor?.username || 'unknown';
  order.statusHistory.push({ status: target, at: order.updatedAt, by: order.updatedBy });
  if (target === 'DELIVERED') order.deliveredAt = order.updatedAt;
  if (target === 'CANCELLED') order.cancelledAt = order.updatedAt;
  return clone(order);
}

/* -------------------------------------------------------------------------- */
/* Payments + paired cash_in                                                   */
/* -------------------------------------------------------------------------- */

export async function recordCustomOrderPayment(id, payment = {}, { actor } = {}) {
  await delay(160);
  const order = ORDERS.find((o) => o.id === id);
  if (!order) return null;

  if (order.status === 'CANCELLED' || order.status === 'DELIVERED') {
    const err = new Error('Cannot record payment on a closed order.');
    err.code = 'CLOSED_ORDER';
    throw err;
  }

  const amount = Number(payment.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error('Payment amount must be greater than zero.');
    err.code = 'INVALID_AMOUNT';
    throw err;
  }

  const paidSoFar = (order.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  if (paidSoFar + amount - order.total > 0.0001) {
    const err = new Error('Payment exceeds the order total.');
    err.code = 'OVERPAY';
    throw err;
  }
  const method = String(payment.method ?? 'CASH').trim().toUpperCase();
  if (method !== 'CASH') {
    const err = new Error('Only cash payments are accepted.');
    err.code = 'CASH_ONLY';
    throw err;
  }

  const now = new Date();
  const payId = 'pay-' + order.id + '-' + ((order.payments || []).length + 1);

  const createdBy = actor?.username || 'unknown';
  const createdByRole = actor?.role || null;

  const cashIn = _appendCashIn({
    amount,
    referenceType: 'CUSTOM_ORDER_PAYMENT',
    referenceId: payId,
    reason: 'Custom-order payment ' + order.code,
    createdBy,
    createdByRole,
    createdAt: now.toISOString(),
  });

  const paymentRow = {
    id: payId,
    amount,
    method: 'CASH',
    note: String(payment.note || '').trim(),
    createdBy,
    createdByRole,
    createdAt: now.toISOString(),
    cashInId: cashIn.id,
  };
  order.payments.push(paymentRow);

  order.updatedAt = now.toISOString();

  return actor?.role === ROLES.EMPLOYEE
    ? { order: clone(order), payment: { ...paymentRow } }
    : { order: clone(order), payment: { ...paymentRow }, cashIn };
}

export async function getCustomOrderPayments(id) {
  await delay(60);
  const order = ORDERS.find((o) => o.id === id);
  if (!order) return [];
  return (order.payments || []).slice().map((p) => ({ ...p }));
}
