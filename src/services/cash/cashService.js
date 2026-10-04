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
 * Ledger row types:
 *   - CASH_IN   — referenceType ∈ SALE / CUSTOM_ORDER_PAYMENT / MANUAL
 *   - CASH_OUT  — referenceType ∈ MANUAL
 *   - OPENING — one initial seed (zero allowed)
 *   - CASH_ADJUSTMENT — signed reconciliation correction
 *
 * Real backend will replace this file entirely.
 */
import { delay } from '../delay.js';
import { ROLES } from '../../constants/roles.js';
import { cashBusinessDate, cashDayStart, cashDateRange } from '../../utils/cashDate.js';

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
  { id: 'cashin-001', amount: 1650, reason: 'Sale S-20260901-0014', createdBy: 'owner',        createdByRole: ROLES.OWNER,    createdAt: '2026-09-01T11:24:00Z' },
  { id: 'cashin-002', amount: 720,  reason: 'Sale S-20260901-0013', createdBy: 'employee',     createdByRole: ROLES.EMPLOYEE, createdAt: '2026-09-01T10:11:00Z' },
  { id: 'cashin-003', amount: 1240, reason: 'Sale S-20260901-0012', createdBy: 'employee',     createdByRole: ROLES.EMPLOYEE, createdAt: '2026-09-01T09:02:00Z' },
  { id: 'cashin-004', amount: 2300, reason: 'Sale S-20260831-0009', createdBy: 'owner',        createdByRole: ROLES.OWNER,    createdAt: '2026-08-31T18:42:00Z' },
  { id: 'cashin-005', amount: 2350, reason: 'Sale S-20260831-0008', createdBy: 'owner',        createdByRole: ROLES.OWNER,    createdAt: '2026-08-31T15:10:00Z' },
  // Mirror of seed custom-order payments (customOrderService.js seed).
  { id: 'cashin-co-001', amount: 1500, reason: 'Custom-order payment CO-20260901-0003', createdBy: 'owner', createdByRole: ROLES.OWNER, createdAt: '2026-09-01T11:30:00Z' },
  { id: 'cashin-co-002', amount: 3900, reason: 'Custom-order payment CO-20260830-0002', createdBy: 'owner', createdByRole: ROLES.OWNER, createdAt: '2026-08-30T14:20:00Z' },
];
for (const seed of SEED_CASH_IN) {
  if (LEDGER.some((r) => r.id === seed.id)) continue;
  LEDGER.push({
    id: seed.id,
    type: 'CASH_IN',
    amount: seed.amount,
    referenceType: seed.id.startsWith('cashin-co-') ? 'CUSTOM_ORDER_PAYMENT' : 'SALE',
    referenceId: seed.id.startsWith('cashin-co-')
      ? `pay-co-${seed.id.slice('cashin-co-'.length).padStart(3, '0')}`
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
for (const row of LEDGER) row.sessionDate = toDateOnly(row.createdAt);

const RECONCILIATIONS = [];
const COUNT_REQUESTS = new Map();

function sumCash(rows) {
  return rows.reduce((sum, row) => sum + Math.round(row.amount * 100) * (row.type === 'CASH_OUT' ? -1 : 1), 0) / 100;
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function manualTime(date) {
  if (!date) return nowIso();
  const start = cashDayStart(date);
  if (date > cashBusinessDate()) fail('FUTURE_DATE', 'Cash movements cannot be future dated.');
  const initial = LEDGER.find((row) => row.type === 'OPENING');
  if (initial && start < new Date(initial.createdAt)) fail('BEFORE_OPENING', 'Cash movement cannot precede initial setup.');
  return date === cashBusinessDate() ? nowIso() : start.toISOString();
}

function decorateCount(row) {
  const superseded = RECONCILIATIONS.some((entry) => entry.supersedesId === row.id);
  const stale = row.businessDate !== cashBusinessDate() || row.ledgerSequenceAtCount !== LEDGER.length || RECONCILIATIONS.at(-1)?.id !== row.id;
  return {
    ...row,
    status: row.adjustmentTransactionId ? 'ADJUSTED' : superseded ? 'SUPERSEDED' : row.difference === 0 ? 'MATCHED' : 'UNAPPLIED',
    canAdjust: row.difference !== 0 && !row.adjustmentTransactionId && !stale && !superseded,
    stale: !row.adjustmentTransactionId && stale,
  };
}

export async function setInitialCash(payload = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(100);
  if (LEDGER.some((row) => row.type === 'OPENING')) fail('ALREADY_INITIALIZED', 'Initial opening is already recorded. Use reconciliation for corrections.');
  const amount = normaliseAmount(payload.amount);
  if (amount === null || amount < 0) fail('INVALID_AMOUNT', 'Opening cash must be zero or greater.');
  const earliest = LEDGER.length ? LEDGER.reduce((first, row) => row.createdAt < first ? row.createdAt : first, LEDGER[0].createdAt) : nowIso();
  const date = payload.date || cashBusinessDate(earliest);
  const createdAt = cashDayStart(date).toISOString();
  if (createdAt > earliest || date > cashBusinessDate()) fail('INVALID_OPENING_DATE', 'Initial opening must be on or before the first cash movement.');
  const row = {
    id: nextId(), type: 'OPENING', amount, referenceType: 'INITIAL_SETUP', referenceId: null,
    reason: String(payload.reason || 'Initial shop cash').trim(), createdBy: actor.username,
    createdByRole: actor.role, createdAt, recordedAt: nowIso(), sessionDate: date,
  };
  LEDGER.push(row);
  return cloneRow(row);
}

export async function getCashReconciliations(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(60);
  return RECONCILIATIONS.filter((row) => !filters.businessDate || row.businessDate === filters.businessDate)
    .slice().reverse().map(decorateCount);
}

export async function saveCashReconciliation(payload = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(120);
  const physicalCash = normaliseAmount(payload.physicalCash);
  if (physicalCash === null || physicalCash < 0) fail('INVALID_AMOUNT', 'Physical cash must be zero or greater.');
  const notes = String(payload.notes || '').trim();
  const requestKey = payload.idempotencyKey ? `${actor.username}:${payload.idempotencyKey}` : null;
  const fingerprint = JSON.stringify([physicalCash, notes]);
  if (requestKey && COUNT_REQUESTS.has(requestKey)) {
    const previous = COUNT_REQUESTS.get(requestKey);
    if (previous.fingerprint !== fingerprint) fail('IDEMPOTENCY_CONFLICT', 'This count request was already used with different values.');
    return decorateCount(RECONCILIATIONS.find((row) => row.id === previous.id));
  }
  if (!LEDGER.some((row) => row.type === 'OPENING')) fail('SETUP_REQUIRED', 'Record initial opening cash before reconciliation.');
  if (payload.ledgerVersion !== undefined && payload.ledgerVersion !== LEDGER.length) fail('STALE_COUNT', 'Cash changed while counting. Refresh and count again.');
  const countedAt = nowIso();
  const expectedCash = getCurrentCash();
  const businessDate = cashBusinessDate(countedAt);
  const previous = RECONCILIATIONS.filter((row) => row.businessDate === businessDate).at(-1);
  const row = {
    id: `recon-${RECONCILIATIONS.length + 1}`, businessDate, countedAt, expectedCash, physicalCash,
    difference: Math.round((physicalCash - expectedCash) * 100) / 100,
    ledgerSequenceAtCount: LEDGER.length, notes, reconciledBy: actor.username,
    createdAt: countedAt, adjustmentTransactionId: null, supersedesId: previous?.id || null,
  };
  RECONCILIATIONS.push(row);
  if (requestKey) COUNT_REQUESTS.set(requestKey, { id: row.id, fingerprint });
  return decorateCount(row);
}

export async function applyCashReconciliation(id, payload = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(120);
  if (payload.confirmed !== true) fail('CONFIRMATION_REQUIRED', 'Confirm the cash adjustment first.');
  const reason = validReason(payload.reason);
  if (!reason) fail('EMPTY_REASON', 'An adjustment reason is required (at least 3 characters).');
  const row = RECONCILIATIONS.find((entry) => entry.id === id);
  if (!row) fail('NOT_FOUND', 'Reconciliation not found.');
  if (row.adjustmentTransactionId) {
    const adjustment = LEDGER.find((entry) => entry.id === row.adjustmentTransactionId);
    if (adjustment.reason !== reason) fail('ALREADY_ADJUSTED', 'This reconciliation already has an adjustment.');
    return { reconciliation: decorateCount(row), adjustment: cloneRow(adjustment) };
  }
  if (row.difference === 0) fail('ALREADY_MATCHED', 'Cash matches; no adjustment is needed.');
  if (!decorateCount(row).canAdjust) fail('STALE_COUNT', 'Cash or the count changed. Save a fresh reconciliation before adjusting.');
  const createdAt = nowIso();
  const adjustment = {
    id: nextId(), type: 'CASH_ADJUSTMENT', amount: row.difference,
    referenceType: 'RECONCILIATION', referenceId: row.id, reason,
    createdBy: actor.username, createdByRole: actor.role, createdAt, sessionDate: cashBusinessDate(createdAt),
  };
  // No awaits between related writes: one synchronous mock transaction.
  LEDGER.push(adjustment);
  row.adjustmentTransactionId = adjustment.id;
  return { reconciliation: decorateCount(row), adjustment: cloneRow(adjustment) };
}

export function getCashPeriodSummary(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  const [start, end] = cashDateRange(filters);
  const prior = LEDGER.filter((row) => new Date(row.createdAt) < start);
  const rows = LEDGER.filter((row) => new Date(row.createdAt) >= start && new Date(row.createdAt) <= end);
  const opening = sumCash(prior);
  const total = (type) => sumCash(rows.filter((row) => row.type === type));
  return {
    opening, initialOpening: total('OPENING'), cashIn: total('CASH_IN'), cashOut: Math.abs(total('CASH_OUT')),
    adjustments: total('CASH_ADJUSTMENT'), expected: Math.round((opening + sumCash(rows)) * 100) / 100,
    from: cashBusinessDate(start), to: cashBusinessDate(end), rows: rows.map(cloneRow),
  };
}

export async function getCashSnapshot({ actor } = {}) {
  requireOwner({ actor });
  await delay(80);
  const earliest = LEDGER.length ? LEDGER.reduce((first, row) => row.createdAt < first ? row.createdAt : first, LEDGER[0].createdAt) : nowIso();
  return {
    ...getCashPeriodSummary({}, { actor }), currentCash: getCurrentCash(), ledgerVersion: LEDGER.length,
    initialized: LEDGER.some((row) => row.type === 'OPENING'), suggestedOpeningDate: cashBusinessDate(earliest),
    entries: LEDGER.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(cloneRow),
    reconciliations: RECONCILIATIONS.slice().reverse().map(decorateCount),
  };
}

function nextId() {
  nextSeq += 1;
  return 'cash-' + String(nextSeq).padStart(4, '0');
}

function nowIso() {
  return new Date().toISOString();
}

function toDateOnly(value) {
  return cashBusinessDate(value);
}

function requireOwner({ actor } = {}) {
  if (!actor || !OWNER_ROLE.includes(actor.role)) {
    const err = new Error('Only an owner can manage cash.');
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }
}

function normaliseAmount(value) {
  if ((typeof value === 'string' && !value.trim()) || value === null || value === undefined || typeof value === 'boolean') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isSafeInteger(Math.round(n * 100))) return null;
  return Math.round(n * 100) / 100;
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
  INITIAL_SETUP: 'Initial opening',
  RECONCILIATION: 'Reconciliation',
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
 * Current shop cash: initial opening + cash in - cash out + signed adjustments.
 */
export function getCurrentCash() {
  return sumCash(LEDGER);
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
  const createdAt = manualTime(payload.date);
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
  const createdAt = manualTime(payload.date);
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
