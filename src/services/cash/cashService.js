/**
 * cashService — Phase 12 mock.
 *
 * Owns the shop-cash ledger (cash_transactions in DATABASE_PLAN.md §37).
 *
 * Critical invariants (PROJECT_RULES §D9 + REQUIREMENTS §60/§67):
 *   - SUPPLIER payments NEVER appear in shop cash.
 *   - EXPENSES NEVER auto-create cash transactions.
 *   - Owner-only writes (reads are owner-only too — the route is gated).
 *
 * Transaction shape (DATABASE_PLAN §37):
 *   {
 *     id, type, amount, referenceType, referenceId,
 *     reason, createdBy, createdByRole, createdAt, sessionDate
 *   }
 *
 * Two row types only:
 *   - CASH_IN   — referenceType ∈ SALE / CUSTOM_ORDER_PAYMENT / MANUAL
 *   - CASH_OUT  — referenceType ∈ MANUAL
 *
 * Real backend will replace this file entirely.
 */
import { delay } from '../delay.js';
import { ROLES } from '../../constants/roles.js';

const OWNER_ROLE = [ROLES.OWNER];

/* -------------------------------------------------------------------------- */
/* Append-only ledger                                                            */
/* -------------------------------------------------------------------------- */

const LEDGER = [
  // A handful of manual cash events from prior days.
  {
    id: 'cash-0001',
    type: 'CASH_IN',
    amount: 5000,
    referenceType: 'MANUAL',
    referenceId: null,
    reason: 'Top-up cash from bank',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2026-08-31T20:05:00Z',
    sessionDate: '2026-08-31',
  },
  {
    id: 'cash-0002',
    type: 'CASH_OUT',
    amount: 1200,
    referenceType: 'MANUAL',
    referenceId: null,
    reason: 'Petty cash — cleaning supplies',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2026-08-31T20:10:00Z',
    sessionDate: '2026-08-31',
  },
];

let nextSeq = LEDGER.length;

/* Mirror seed sales (Phase 5) and seed custom-order payments (Phase 7) so
 * getCurrentCash() is consistent from first render. These match exactly the
 * rows those modules reference via their `cashInId`/cashIn row shape.
 */
const SEED_CASH_IN = [
  // Mirror of seed sales (salesService.js seed log).
  { id: 'cashin-001', amount: 1650, reason: 'Sale S-20250901-0014', createdBy: 'owner',        createdByRole: ROLES.OWNER,    createdAt: '2026-09-01T11:24:00Z' },
  { id: 'cashin-002', amount: 720,  reason: 'Sale S-20250901-0013', createdBy: 'employee',     createdByRole: ROLES.EMPLOYEE, createdAt: '2026-09-01T10:11:00Z' },
  { id: 'cashin-003', amount: 1240, reason: 'Sale S-20250901-0012', createdBy: 'employee',     createdByRole: ROLES.EMPLOYEE, createdAt: '2026-09-01T09:02:00Z' },
  { id: 'cashin-004', amount: 2300, reason: 'Sale S-20250831-0009', createdBy: 'owner',        createdByRole: ROLES.OWNER,    createdAt: '2026-08-31T18:42:00Z' },
  { id: 'cashin-005', amount: 2350, reason: 'Sale S-20250831-0008', createdBy: 'owner',        createdByRole: ROLES.OWNER,    createdAt: '2026-08-31T15:10:00Z' },
  // Mirror of seed custom-order payments (customOrderService.js seed).
  { id: 'cashin-co-001', amount: 1500, reason: 'Custom-order payment CO-20250901-0003', createdBy: 'owner', createdByRole: ROLES.OWNER, createdAt: '2026-09-01T11:30:00Z' },
  { id: 'cashin-co-002', amount: 3900, reason: 'Custom-order payment CO-20250830-0002', createdBy: 'owner', createdByRole: ROLES.OWNER, createdAt: '2026-08-30T14:20:00Z' },
];
for (const seed of SEED_CASH_IN) {
  if (LEDGER.some((r) => r.id === seed.id)) continue;
  LEDGER.push({
    id: seed.id,
    type: 'CASH_IN',
    amount: seed.amount,
    referenceType: seed.id.startsWith('cashin-co-') ? 'CUSTOM_ORDER_PAYMENT' : 'SALE',
    referenceId: seed.id.startsWith('cashin-co-')
      ? `co-${seed.id.slice('cashin-co-'.length).padStart(3, '0')}`
      : seed.id.replace('cashin-', 'sale-'),
    reason: seed.reason,
    createdBy: seed.createdBy,
    createdByRole: seed.createdByRole,
    createdAt: seed.createdAt,
    sessionDate: toDateOnly(seed.createdAt),
  });
  nextSeq = Math.max(
    nextSeq,
    Number(seed.id.replace(/\D/g, '')) || nextSeq,
  );
}
nextSeq = LEDGER.length;

function nextId() {
  nextSeq += 1;
  return 'cash-' + String(nextSeq).padStart(4, '0');
}

function nowIso() {
  return new Date().toISOString();
}

function toDateOnly(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    // accept 'YYYY-MM-DD' or ISO
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

function requireOwner({ actor } = {}) {
  if (!actor || !OWNER_ROLE.includes(actor.role)) {
    const err = new Error('Only an owner can manage cash.');
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }
}

function normaliseAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function validReason(reason) {
  const v = String(reason || '').trim();
  if (!v) return null;
  if (v.length < 3) return null;
  return v;
}

function cloneRow(row) {
  return { ...row };
}

/**
 * Public kind labels for UI display. Keep in sync with reference types
 * documented in DATABASE_PLAN §38-39, §41.
 */
export const CASH_REFERENCE_LABELS = Object.freeze({
  SALE: 'Sale',
  CUSTOM_ORDER_PAYMENT: 'Custom order payment',
  MANUAL: 'Manual cash',
});

/* -------------------------------------------------------------------------- */
/* Reads                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * All shop-cash rows, newest first. Excludes supplier payments (defensive —
 * they are never inserted here).
 */
export async function getCashEntries(_filters = {}) {
  await delay(120);
  return LEDGER.slice()
    .filter((row) => {
      // Defensive filter — these rows are never inserted here, but if
      // they ever leak in via a future module they must not surface.
      if (row.referenceType === 'SUPPLIER_PAYMENT') return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(cloneRow);
}

/**
 * Current shop-cash balance: sum of all CASH_IN rows minus all CASH_OUT rows.
 */
export function getCurrentCash() {
  return LEDGER.reduce((acc, row) => {
    const amt = Number(row.amount || 0);
    if (row.type === 'CASH_IN') return acc + amt;
    if (row.type === 'CASH_OUT') return acc - amt;
    return acc;
  }, 0);
}

/* -------------------------------------------------------------------------- */
/* Writes — all owner-only                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Add a manual cash-in. Mirrors DATABASE_PLAN §39 referenceType MANUAL.
 */
export async function addCashIn(payload = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(160);

  const amount = normaliseAmount(payload.amount);
  if (amount === null || amount <= 0) {
    const err = new Error('Cash-in amount must be greater than zero.');
    err.code = 'INVALID_AMOUNT';
    throw err;
  }
  const reason = validReason(payload.reason);
  if (!reason) {
    const err = new Error('Please provide a reason (at least 3 characters).');
    err.code = 'EMPTY_REASON';
    throw err;
  }

  const createdBy = actor?.username || 'unknown';
  const createdByRole = actor?.role || ROLES.OWNER;
  const createdAt = nowIso();
  const sessionDate = toDateOnly(createdAt);

  const row = {
    id: nextId(),
    type: 'CASH_IN',
    amount,
    referenceType: 'MANUAL',
    referenceId: null,
    reason,
    createdBy,
    createdByRole,
    createdAt,
    sessionDate,
  };
  LEDGER.push(row);
  return cloneRow(row);
}

/**
 * Remove cash. Mirrors DATABASE_PLAN §41 (reason mandatory, length ≥ 3).
 */
export async function addCashOut(payload = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(160);

  const amount = normaliseAmount(payload.amount);
  if (amount === null || amount <= 0) {
    const err = new Error('Cash-out amount must be greater than zero.');
    err.code = 'INVALID_AMOUNT';
    throw err;
  }
  const reason = validReason(payload.reason);
  if (!reason) {
    const err = new Error('Reason is required (at least 3 characters).');
    err.code = 'EMPTY_REASON';
    throw err;
  }

  const createdBy = actor?.username || 'unknown';
  const createdByRole = actor?.role || ROLES.OWNER;
  const createdAt = nowIso();
  const sessionDate = toDateOnly(createdAt);

  const row = {
    id: nextId(),
    type: 'CASH_OUT',
    amount,
    referenceType: 'MANUAL',
    referenceId: null,
    reason,
    createdBy,
    createdByRole,
    createdAt,
    sessionDate,
  };
  LEDGER.push(row);
  return cloneRow(row);
}

/* -------------------------------------------------------------------------- */
/* Direct ledger accessors — used by sibling services (sales, customOrders)    */
/* -------------------------------------------------------------------------- */

/**
 * Append a CASH_IN row from a non-cash module (e.g. sales, customOrders).
 * Exported so `salesService.completeSale` and
 * `customOrderService.recordCustomOrderPayment` can write into the same
 * ledger without depending on user-facing helpers.
 *
 * Returns the inserted row.
 */
export function _appendCashIn({
  amount,
  referenceType,
  referenceId,
  reason,
  createdBy,
  createdByRole,
  createdAt,
  sessionDate,
}) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Cash-in amount must be greater than zero.');
  }
  const rt = String(referenceType || '').trim();
  if (!rt) {
    throw new Error('referenceType is required for cash-in rows.');
  }
  const rs = String(reason || '').trim();
  if (rs.length < 3) {
    throw new Error('Reason is required (at least 3 characters).');
  }
  const row = {
    id: nextId(),
    type: 'CASH_IN',
    amount: n,
    referenceType: rt,
    referenceId: referenceId || null,
    reason: rs,
    createdBy: createdBy || 'unknown',
    createdByRole: createdByRole || ROLES.OWNER,
    createdAt: createdAt || nowIso(),
    sessionDate: sessionDate || toDateOnly(createdAt || nowIso()),
  };
  LEDGER.push(row);
  return cloneRow(row);
}
