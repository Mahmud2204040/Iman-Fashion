/**
 * customOrderService — Phase 7 mock.
 *
 * Owns the custom-orders workflow:
 *   - List + detail
 *   - Create custom order (single product + qty per FRONTEND_PLAN.md §7)
 *   - Status transitions (PENDING → IN_PROGRESS → READY → DELIVERED, plus CANCELLED)
 *   - Record payment — creates a paired CASH_IN row with
 *     `referenceType: CUSTOM_ORDER_PAYMENT`, mirroring DATABASE_PLAN.md's
 *     `cash_transactions` contract.
 *
 * In-memory + deterministic. Real backend will replace this file entirely.
 * No business rules beyond those documented in FRONTEND_PLAN.md are
 * introduced here.
 *
 * Open questions carried in (not invented):
 *   - Q3 Custom-order cancel cash treatment — UI does NOT auto-reverse cash;
 *     cancellation is a status change only.
 */
import { delay } from '../delay.js';
import { ROLES } from '../../constants/roles.js';
import { _appendCashIn } from '../cash/cashService.js';

/* -------------------------------------------------------------------------- */
/* Custom order statuses                                                       */
/* -------------------------------------------------------------------------- */

export const CUSTOM_ORDER_STATUSES = Object.freeze([
  'PENDING',
  'IN_PROGRESS',
  'READY',
  'DELIVERED',
  'CANCELLED',
]);

const TERMINAL_STATUSES = new Set(['DELIVERED', 'CANCELLED']);

/* -------------------------------------------------------------------------- */
/* Seed catalogue                                                              */
/* -------------------------------------------------------------------------- */

const CUSTOMERS = [
  { id: 'cust-001', name: 'Anika Tabassum' },
  { id: 'cust-002', name: 'Tahmid Hossain' },
  { id: 'cust-003', name: 'Mst. Rafa' },
  { id: 'cust-004', name: 'Sabbir Ahmed' },
  { id: 'cust-005', name: 'Nusrat Jahan' },
];

const ORDERS = [
  {
    id: 'co-001',
    code: 'CO-20250901-0003',
    customerId: 'cust-001',
    customerName: 'Anika Tabassum',
    productName: 'Embroidered three-piece (georgette)',
    description: 'Custom embroidery pattern, navy base, size 38',
    qty: 1,
    unitPrice: 3400,
    total: 3400,
    status: 'IN_PROGRESS',
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
  },
  {
    id: 'co-002',
    code: 'CO-20250830-0002',
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
  },
  {
    id: 'co-003',
    code: 'CO-20250825-0001',
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
  await delay(80);
  return CUSTOMERS.slice().map((c) => ({ ...c }));
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
  const unitPrice = Number(payload.unitPrice);

  if (!customerId) {
    const err = new Error('Select a customer for this custom order.');
    err.code = 'EMPTY_CUSTOMER';
    throw err;
  }

  const customer = CUSTOMERS.find((c) => c.id === customerId);
  if (!customer) {
    const err = new Error('Selected customer could not be found.');
    err.code = 'CUSTOMER_NOT_FOUND';
    throw err;
  }

  if (!productName) {
    const err = new Error('Product name is required.');
    err.code = 'EMPTY_PRODUCT';
    throw err;
  }

  if (!Number.isFinite(qty) || qty < 1) {
    const err = new Error('Quantity must be at least 1.');
    err.code = 'INVALID_QTY';
    throw err;
  }

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    const err = new Error('Unit price must be a non-negative number.');
    err.code = 'INVALID_PRICE';
    throw err;
  }

  const total = qty * unitPrice;
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
    dueDate: payload.dueDate || null,
    notes,
    payments: [],
    createdBy,
    createdByRole,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  ORDERS.push(order);
  return clone(order);
}

/* -------------------------------------------------------------------------- */
/* Update metadata (notes, dueDate, description, qty/price while PENDING)      */
/* -------------------------------------------------------------------------- */

export async function updateCustomOrder(id, patch = {}) {
  await delay(120);
  const order = ORDERS.find((o) => o.id === id);
  if (!order) return null;
  if (TERMINAL_STATUSES.has(order.status)) {
    const err = new Error('Cannot edit a completed or cancelled order.');
    err.code = 'IMMUTABLE';
    throw err;
  }

  if (patch.description !== undefined) {
    order.description = String(patch.description || '').trim();
  }
  if (patch.notes !== undefined) {
    order.notes = String(patch.notes || '').trim();
  }
  if (patch.dueDate !== undefined) {
    order.dueDate = patch.dueDate || null;
  }
  if (patch.qty !== undefined) {
    const q = Number(patch.qty);
    if (!Number.isFinite(q) || q < 1) {
      const err = new Error('Quantity must be at least 1.');
      err.code = 'INVALID_QTY';
      throw err;
    }
    order.qty = q;
  }
  if (patch.unitPrice !== undefined) {
    const p = Number(patch.unitPrice);
    if (!Number.isFinite(p) || p < 0) {
      const err = new Error('Unit price must be a non-negative number.');
      err.code = 'INVALID_PRICE';
      throw err;
    }
    order.unitPrice = p;
  }

  order.total = order.qty * order.unitPrice;
  order.updatedAt = new Date().toISOString();

  return clone(order);
}

/* -------------------------------------------------------------------------- */
/* Status transitions                                                          */
/* -------------------------------------------------------------------------- */

export async function setCustomOrderStatus(id, nextStatus) {
  await delay(120);
  const target = String(nextStatus || '').toUpperCase();
  if (!CUSTOM_ORDER_STATUSES.includes(target)) {
    const err = new Error('Unknown status: ' + nextStatus);
    err.code = 'INVALID_STATUS';
    throw err;
  }

  const order = ORDERS.find((o) => o.id === id);
  if (!order) return null;

  order.status = target;
  order.updatedAt = new Date().toISOString();
  return clone(order);
}

/* -------------------------------------------------------------------------- */
/* Payments + paired cash_in                                                   */
/* -------------------------------------------------------------------------- */

let cashInSeq = 100;

export async function recordCustomOrderPayment(id, payment = {}, { actor } = {}) {
  await delay(160);
  const order = ORDERS.find((o) => o.id === id);
  if (!order) return null;

  if (order.status === 'CANCELLED') {
    const err = new Error('Cannot record payment on a cancelled order.');
    err.code = 'CANCELLED';
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

  const now = new Date();
  cashInSeq += 1;
  const cashInId = 'cashin-co-' + String(cashInSeq).padStart(3, '0');
  const payId = 'pay-' + order.id + '-' + ((order.payments || []).length + 1);

  const createdBy = actor?.username || 'unknown';
  const createdByRole = actor?.role || null;

  const paymentRow = {
    id: payId,
    amount,
    method: String(payment.method || 'CASH').toUpperCase(),
    note: String(payment.note || '').trim(),
    createdBy,
    createdByRole,
    createdAt: now.toISOString(),
    cashInId,
  };
  order.payments.push(paymentRow);

  const cashInLocal = {
    id: cashInId,
    type: 'CASH_IN',
    amount,
    referenceType: 'CUSTOM_ORDER_PAYMENT',
    referenceId: order.id,
    reason: 'Custom-order payment ' + order.code,
    createdBy,
    createdByRole,
    createdAt: now.toISOString(),
  };

  // Mirror into shared shop-cash ledger so getCurrentCash() reflects inflow.
  const cashIn = _appendCashIn({
    amount: cashInLocal.amount,
    referenceType: cashInLocal.referenceType,
    referenceId: cashInLocal.referenceId,
    reason: cashInLocal.reason,
    createdBy: cashInLocal.createdBy,
    createdByRole: cashInLocal.createdByRole,
    createdAt: cashInLocal.createdAt,
  });

  // Auto-advance status when fully paid and still pending/in-progress.
  const totalPaid = (order.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  if (
    Math.abs(totalPaid - order.total) < 0.0001 &&
    (order.status === 'PENDING' || order.status === 'IN_PROGRESS')
  ) {
    order.status = 'READY';
  }
  order.updatedAt = now.toISOString();

  return { order: clone(order), cashIn };
}

export async function getCustomOrderPayments(id) {
  await delay(60);
  const order = ORDERS.find((o) => o.id === id);
  if (!order) return [];
  return (order.payments || []).slice().map((p) => ({ ...p }));
}
