/**
 * purchaseService — Phase 9 mock.
 *
 * Owns the purchase ledger (orders placed with suppliers), their line
 * items, payment trail, and receipt upload (mock URL only).
 *
 * Per FRONTEND_PLAN.md §Phase 9:
 *   - Owner-only module
 *   - Single purchase can hold multiple line items (supplier orders
 *     typically span several fabrics / trims)
 *   - Supplier payments are SEPARATE from shop cash and never
 *     auto-create a CASH_OUT row in the cash ledger.
 *   - Receipt upload is an in-memory mock gallery of data URLs and metadata.
 *
 * Status lifecycle:
 *   DRAFT  → ORDERED   → RECEIVED
 *     ↘ CANCELLED (only with no payments)
 *
 * Status transitions are explicit (owner-driven). RECEIVED cannot be cancelled.
 *
 * Real backend will replace this file entirely.
 */
import { ROLES } from '../../constants/roles.js';
import { delay } from '../delay.js';
import { getSupplierById, getSuppliers } from '../suppliers/supplierService.js';
import { cashBusinessDate, cashDayStart } from '../../utils/cashDate.js';

/* -------------------------------------------------------------------------- */
/* Mock purchases                                                               */
/* -------------------------------------------------------------------------- */

const PURCHASES = [
  {
    id: 'pch-001',
    code: 'P-20250820-0001',
    supplierId: 'sup-001',
    supplierName: 'Aarong Fabrics Ltd.',
    orderedAt: '2025-08-20T10:15:00Z',
    expectedAt: '2025-08-28T00:00:00Z',
    receivedAt: '2025-08-27T14:00:00Z',
    status: 'RECEIVED',
    items: [
      {
        id: 'pch-001-i1',
        name: 'Navy cotton twill — 100m roll',
        qty: 4,
        unitPrice: 4200,
        lineTotal: 16800,
      },
      {
        id: 'pch-001-i2',
        name: 'White poplin — 60m roll',
        qty: 2,
        unitPrice: 3100,
        lineTotal: 6200,
      },
    ],
    total: 23000,
    paidTotal: 23000,
    notes: 'Full cash payment — cleared 2025-08-22.',
    payments: [
      {
        id: 'pay-pch-001-1',
        amount: 23000,
        method: 'CASH',
        note: 'Full prepayment',
        createdBy: 'owner',
        createdByRole: ROLES.OWNER,
        createdAt: '2025-08-22T11:00:00Z',
      },
    ],
    receiptUrl: null,
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    updatedBy: 'owner',
    updatedByRole: ROLES.OWNER,
    createdAt: '2025-08-20T10:15:00Z',
    updatedAt: '2025-08-27T14:00:00Z',
  },
  {
    id: 'pch-002',
    code: 'P-20250901-0001',
    supplierId: 'sup-002',
    supplierName: 'Bengal Buttons & Trims',
    orderedAt: '2025-09-01T09:30:00Z',
    expectedAt: '2025-09-04T00:00:00Z',
    receivedAt: null,
    status: 'ORDERED',
    items: [
      {
        id: 'pch-002-i1',
        name: 'Plastic shank buttons — 12mm',
        qty: 500,
        unitPrice: 4,
        lineTotal: 2000,
      },
      {
        id: 'pch-002-i2',
        name: 'YKK zippers — 20cm navy',
        qty: 120,
        unitPrice: 35,
        lineTotal: 4200,
      },
      {
        id: 'pch-002-i3',
        name: 'Interlining — roll',
        qty: 6,
        unitPrice: 380,
        lineTotal: 2280,
      },
    ],
    total: 8480,
    paidTotal: 2500,
    notes: 'Part payment on order, balance on delivery.',
    payments: [
      {
        id: 'pay-pch-002-1',
        amount: 2500,
        method: 'CASH',
        note: 'Advance',
        createdBy: 'owner',
        createdByRole: ROLES.OWNER,
        createdAt: '2025-09-01T16:00:00Z',
      },
    ],
    receiptUrl: null,
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    updatedBy: 'owner',
    updatedByRole: ROLES.OWNER,
    createdAt: '2025-09-01T09:30:00Z',
    updatedAt: '2025-09-01T16:00:00Z',
  },
  {
    id: 'pch-003',
    code: 'P-20250905-0001',
    supplierId: 'sup-003',
    supplierName: 'Deshi Dyeing Works',
    orderedAt: '2025-09-05T11:00:00Z',
    expectedAt: '2025-09-18T00:00:00Z',
    receivedAt: null,
    status: 'DRAFT',
    items: [
      {
        id: 'pch-003-i1',
        name: 'Dye batch — navy custom shade',
        qty: 80,
        unitPrice: 95,
        lineTotal: 7600,
      },
      {
        id: 'pch-003-i2',
        name: 'Dye batch — grey custom shade',
        qty: 60,
        unitPrice: 95,
        lineTotal: 5700,
      },
    ],
    total: 13300,
    paidTotal: 0,
    notes: 'Awaiting final shade approval from owner.',
    payments: [],
    receiptUrl: null,
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    updatedBy: 'owner',
    updatedByRole: ROLES.OWNER,
    createdAt: '2025-09-05T11:00:00Z',
    updatedAt: '2025-09-05T11:00:00Z',
  },
  {
    id: 'pch-004',
    code: 'P-20250908-0001',
    supplierId: 'sup-004',
    supplierName: 'Garments Packaging Co.',
    orderedAt: '2025-09-08T13:30:00Z',
    expectedAt: '2025-09-12T00:00:00Z',
    receivedAt: '2025-09-11T15:00:00Z',
    status: 'RECEIVED',
    items: [
      {
        id: 'pch-004-i1',
        name: 'Poly bags — branded 12x16',
        qty: 1000,
        unitPrice: 6,
        lineTotal: 6000,
      },
      {
        id: 'pch-004-i2',
        name: 'Hang tags — printed',
        qty: 500,
        unitPrice: 12,
        lineTotal: 6000,
      },
    ],
    total: 12000,
    paidTotal: 12000,
    notes: '',
    payments: [
      {
        id: 'pay-pch-004-1',
        amount: 12000,
        method: 'CASH',
        note: 'Wire transfer — cleared same-day',
        createdBy: 'owner',
        createdByRole: ROLES.OWNER,
        createdAt: '2025-09-09T10:00:00Z',
      },
    ],
    receiptUrl: null,
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    updatedBy: 'owner',
    updatedByRole: ROLES.OWNER,
    createdAt: '2025-09-08T13:30:00Z',
    updatedAt: '2025-09-11T15:00:00Z',
  },
];

export const PURCHASE_STATUSES = Object.freeze([
  'DRAFT',
  'ORDERED',
  'RECEIVED',
  'CANCELLED',
]);

const TERMINAL_STATUSES = new Set(['RECEIVED', 'CANCELLED']);

/* -------------------------------------------------------------------------- */
/* Helpers                                                                      */
/* -------------------------------------------------------------------------- */

function clone(p) {
  return {
    ...p,
    items: (p.items || []).map((it) => ({ ...it })),
    payments: (p.payments || []).map((pay) => ({ ...pay })),
    receipts: (p.receipts || []).map((receipt) => ({ ...receipt })),
  };
}

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function nextPurchaseCodeFor(date = new Date()) {
  const prefix = `P-${ymd(date)}-`;
  const sameDay = PURCHASES.filter((o) => o.code.startsWith(prefix));
  const seq = sameDay.length + 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

function requireRole({ actor } = {}, allowedRoles) {
  if (!actor || !allowedRoles.includes(actor.role)) {
    const err = new Error('Only an owner can perform this action.');
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }
}

function summarizeItems(items) {
  return (items || []).reduce((s, it) => {
    const lineTotal = Number(it.lineTotal || 0);
    return s + lineTotal;
  }, 0);
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                   */
/* -------------------------------------------------------------------------- */

const OWNER_ROLE = [ROLES.OWNER];

export async function listSuppliersForPurchase() {
  return (await getSuppliers())
    .filter((supplier) => supplier.isActive)
    .map((supplier) => ({ id: supplier.id, name: supplier.name }));
}

export async function getPurchases() {
  await delay(140);
  return PURCHASES.slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(clone);
}

export async function getPurchaseById(id) {
  await delay(80);
  const found = PURCHASES.find((p) => p.id === id);
  return found ? clone(found) : null;
}

export async function getPurchasesBySupplier(supplierId) {
  await delay(80);
  return PURCHASES.filter((p) => p.supplierId === supplierId)
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(clone);
}

export async function createPurchase(payload = {}, { actor } = {}) {
  requireRole({ actor }, OWNER_ROLE);
  await delay(180);

  const supplierId = String(payload.supplierId || '').trim();
  const supplierName = String(payload.supplierName || '').trim();
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (!supplierId) {
    const err = new Error('Select a supplier.');
    err.code = 'EMPTY_SUPPLIER';
    throw err;
  }

  const supplier = await getSupplierById(supplierId);
  if (!supplier || !supplier.isActive) {
    const err = new Error('Selected supplier could not be found.');
    err.code = 'SUPPLIER_NOT_FOUND';
    throw err;
  }

  if (items.length === 0) {
    const err = new Error('Add at least one line item.');
    err.code = 'NO_ITEMS';
    throw err;
  }

  const cleanedItems = items.map((it, i) => {
    const name = String(it.name || '').trim();
    const qty = Number(it.qty);
    const unitPrice = Number(it.unitPrice);
    if (!name) {
      const err = new Error(
        'Line item #' + (i + 1) + ' is missing a name.',
      );
      err.code = 'ITEM_EMPTY_NAME';
      throw err;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      const err = new Error(
        'Line item "' + name + '" needs a quantity greater than 0.',
      );
      err.code = 'ITEM_INVALID_QTY';
      throw err;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      const err = new Error(
        'Line item "' + name + '" needs a non-negative unit price.',
      );
      err.code = 'ITEM_INVALID_PRICE';
      throw err;
    }
    return {
      id: 'pch-tmp-i-' + String(i + 1).padStart(3, '0'),
      name,
      qty,
      unitPrice,
      lineTotal: qty * unitPrice,
    };
  });

  const total = summarizeItems(cleanedItems);
  const now = new Date();
  const purchaseDate = String(payload.purchaseDate || cashBusinessDate(now));
  let orderedAt;
  try {
    orderedAt = cashDayStart(purchaseDate).toISOString();
  } catch {
    const err = new Error('Enter a valid purchase date.');
    err.code = 'INVALID_PURCHASE_DATE';
    throw err;
  }
  const code = nextPurchaseCodeFor(now);
  const id = 'pch-' + String(PURCHASES.length + 1).padStart(3, '0');

  const createdBy = actor?.username || 'unknown';
  const createdByRole = actor?.role || ROLES.OWNER;

  const purchase = {
    id,
    code,
    supplierId,
    supplierName: supplierName || supplier.name,
    orderedAt,
    expectedAt: payload.expectedAt || null,
    receivedAt: null,
    status: 'DRAFT',
    items: cleanedItems,
    total,
    paidTotal: 0,
    notes: String(payload.notes || '').trim(),
    payments: [],
    receipts: [],
    createdBy,
    createdByRole,
    updatedBy: createdBy,
    updatedByRole: createdByRole,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  PURCHASES.push(purchase);
  return clone(purchase);
}

export async function recordPurchasePayment(
  purchaseId,
  payment = {},
  { actor } = {},
) {
  requireRole({ actor }, OWNER_ROLE);
  await delay(160);

  const idx = PURCHASES.findIndex((p) => p.id === purchaseId);
  if (idx === -1) {
    const err = new Error('Purchase not found.');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const purchase = PURCHASES[idx];
  if (purchase.status !== 'ORDERED' && purchase.status !== 'RECEIVED') {
    const err = new Error('Payments are allowed only after a purchase is ordered.');
    err.code = 'PAYMENT_STATUS';
    throw err;
  }

  if (String(payment.method || 'CASH').toUpperCase() !== 'CASH') {
    const err = new Error('Supplier payments must be cash.');
    err.code = 'CASH_ONLY';
    throw err;
  }

  const amount = Number(payment.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error('Payment amount must be greater than zero.');
    err.code = 'INVALID_AMOUNT';
    throw err;
  }
  const paidSoFar = (purchase.payments || []).reduce(
    (s, p) => s + Number(p.amount || 0),
    0,
  );
  if (paidSoFar + amount - purchase.total > 0.0001) {
    const err = new Error(
      `Payment exceeds the remaining balance (৳${(purchase.total - paidSoFar).toFixed(2)}).`,
    );
    err.code = 'OVERPAY';
    throw err;
  }

  const payId =
    'pay-' + purchase.id + '-' + ((purchase.payments || []).length + 1);
  const now = new Date();
  const createdBy = actor?.username || 'unknown';
  const createdByRole = actor?.role || ROLES.OWNER;

  const paymentRow = {
    id: payId,
    amount,
    method: 'CASH',
    note: String(payment.note || '').trim(),
    createdBy,
    createdByRole,
    createdAt: now.toISOString(),
  };
  purchase.payments.push(paymentRow);
  purchase.paidTotal = (purchase.payments || []).reduce(
    (s, p) => s + Number(p.amount || 0),
    0,
  );
  purchase.updatedBy = createdBy;
  purchase.updatedByRole = createdByRole;
  purchase.updatedAt = now.toISOString();

  PURCHASES[idx] = purchase;
  return { purchase: clone(purchase) };
}

export async function setPurchaseStatus(id, nextStatus, { actor } = {}) {
  requireRole({ actor }, OWNER_ROLE);
  await delay(120);
  const target = String(nextStatus || '').toUpperCase();
  if (!PURCHASE_STATUSES.includes(target)) {
    const err = new Error('Unknown status: ' + nextStatus);
    err.code = 'INVALID_STATUS';
    throw err;
  }
  const idx = PURCHASES.findIndex((p) => p.id === id);
  if (idx === -1) {
    const err = new Error('Purchase not found.');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const purchase = PURCHASES[idx];
  const transitions = {
    DRAFT: ['ORDERED', 'CANCELLED'],
    ORDERED: ['RECEIVED', 'CANCELLED'],
    RECEIVED: [],
    CANCELLED: [],
  };
  if (!transitions[purchase.status].includes(target)) {
    const err = new Error(`Cannot change ${purchase.status} to ${target}.`);
    err.code = 'INVALID_TRANSITION';
    throw err;
  }
  if (target === 'CANCELLED' && (purchase.payments || []).length > 0) {
    const err = new Error('A purchase with payments cannot be cancelled.');
    err.code = 'PAID_PURCHASE';
    throw err;
  }
  purchase.status = target;
  if (target === 'RECEIVED' && !purchase.receivedAt) {
    purchase.receivedAt = new Date().toISOString();
  }
  purchase.updatedBy = actor?.username || 'unknown';
  purchase.updatedByRole = actor?.role || ROLES.OWNER;
  purchase.updatedAt = new Date().toISOString();
  PURCHASES[idx] = purchase;
  return clone(purchase);
}

export async function updatePurchase(id, patch = {}, { actor } = {}) {
  requireRole({ actor }, OWNER_ROLE);
  await delay(120);
  const idx = PURCHASES.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const target = PURCHASES[idx];
  if (TERMINAL_STATUSES.has(target.status)) {
    const err = new Error(
      'Cannot edit a purchase that is received or cancelled.',
    );
    err.code = 'IMMUTABLE';
    throw err;
  }

  if (patch.notes !== undefined) {
    target.notes = String(patch.notes || '').trim();
  }
  if (patch.expectedAt !== undefined) {
    target.expectedAt = patch.expectedAt || null;
  }
  target.updatedBy = actor?.username || 'unknown';
  target.updatedByRole = actor?.role || ROLES.OWNER;
  target.updatedAt = new Date().toISOString();
  PURCHASES[idx] = target;
  return clone(target);
}

export async function attachPurchaseReceipt(purchaseId, proof, { actor } = {}) {
  requireRole({ actor }, OWNER_ROLE);
  await delay(80);
  const idx = PURCHASES.findIndex((p) => p.id === purchaseId);
  if (idx === -1) return null;
  const input = typeof proof === 'string' ? { dataUrl: proof, name: 'Receipt image', type: 'image/png', size: 0 } : proof || {};
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(input.type) || Number(input.size || 0) > 5 * 1024 * 1024 || !String(input.dataUrl || '').startsWith('data:image/')) {
    const err = new Error('Use a JPG, PNG or WebP image of 5 MB or less.');
    err.code = 'INVALID_RECEIPT';
    throw err;
  }
  if (input.paymentId && !(PURCHASES[idx].payments || []).some((pay) => pay.id === input.paymentId)) {
    const err = new Error('Select a payment from this purchase.');
    err.code = 'INVALID_PAYMENT_LINK';
    throw err;
  }
  const receipts = PURCHASES[idx].receipts || [];
  receipts.push({
    id: `receipt-${purchaseId}-${receipts.length + 1}`,
    purchaseId,
    paymentId: input.paymentId || null,
    name: String(input.name || 'Receipt image'),
    type: input.type,
    size: Number(input.size || 0),
    dataUrl: input.dataUrl,
    uploadedBy: actor?.username || 'unknown',
    uploadedAt: new Date().toISOString(),
  });
  PURCHASES[idx].receipts = receipts;
  PURCHASES[idx].updatedBy = actor?.username || 'unknown';
  PURCHASES[idx].updatedByRole = actor?.role || ROLES.OWNER;
  PURCHASES[idx].updatedAt = new Date().toISOString();
  return clone(PURCHASES[idx]);
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

export function _getPurchaseCount() {
  return PURCHASES.length;
}
