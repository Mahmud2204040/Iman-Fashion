import { apiRequest } from '../api/apiClient.js';
import { ROLES } from '../../constants/roles.js';
import { cashBusinessDate, cashDateRange } from '../../utils/cashDate.js';

const OWNER_ROLE = [ROLES.OWNER];

function requireOwner({ actor } = {}) {
  if (!actor || !OWNER_ROLE.includes(actor.role)) {
    const err = new Error('Only an owner can manage cash.');
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }
}

export const CASH_REFERENCE_LABELS = Object.freeze({
  SALE: 'Sale',
  CUSTOM_ORDER_PAYMENT: 'Custom order payment',
  MANUAL: 'Manual cash',
  INITIAL_SETUP: 'Initial opening',
  RECONCILIATION: 'Reconciliation',
});

function normalizeCashEntry(raw) {
  // raw properties: id, transactionType, amount, referenceType, referenceId, reason, occurredAt, createdById
  // Note: ledgerSequence is also returned from the API
  return {
    id: raw.id,
    type: raw.transactionType, // matches 'CASH_IN', 'CASH_OUT', 'OPENING', 'CASH_ADJUSTMENT'
    amount: Number(raw.amount || 0),
    referenceType: raw.referenceType,
    referenceId: raw.referenceId,
    reason: raw.reason || '',
    createdBy: raw.createdById || '',
    createdByRole: ROLES.OWNER, // Mostly owner does this or we ignore role in UI
    createdAt: raw.occurredAt || raw.createdAt,
    sessionDate: raw.occurredAt ? cashBusinessDate(raw.occurredAt) : cashBusinessDate(raw.createdAt),
    ledgerSequence: raw.ledgerSequence ? Number(raw.ledgerSequence) : undefined,
  };
}

export async function getCashEntries(_filters = {}) {
  const result = await apiRequest('/api/v1/cash/transactions?pageSize=100', { raw: true });
  let rows = result.data || [];
  if (result.meta && result.meta.total > rows.length) {
    let page = 2;
    while (rows.length < result.meta.total && page <= 5) { // Just get heavily used recent ones, or all
      const next = await apiRequest(`/api/v1/cash/transactions?page=${page}&pageSize=100`, { raw: true });
      rows = rows.concat(next.data || []);
      if (!next.data || next.data.length === 0) break;
      page += 1;
    }
  }
  return rows.map(normalizeCashEntry);
}

export async function getCurrentCash() {
  const summary = await apiRequest('/api/v1/cash/summary');
  return Number(summary?.expectedCash || 0);
}

export async function setInitialCash(payload = {}, { actor } = {}) {
  requireOwner({ actor });
  const amount = Number(payload.amount);
  const body = {
    amount: String(amount),
    reason: String(payload.reason || 'Initial shop cash').trim() || 'Initial shop cash',
  };
  const raw = await apiRequest('/api/v1/cash/opening', {
    method: 'POST',
    body,
    idempotencyKey: payload.idempotencyKey,
  });
  return normalizeCashEntry(raw);
}

export async function addCashIn(payload = {}, { actor } = {}) {
  requireOwner({ actor });
  const amount = Number(payload.amount);
  const body = {
    amount: String(amount),
    reason: String(payload.reason || '').trim(),
    ...(payload.date ? { date: payload.date } : {})
  };
  const raw = await apiRequest('/api/v1/cash/in', {
    method: 'POST',
    body,
    idempotencyKey: payload.idempotencyKey,
  });
  return normalizeCashEntry(raw);
}

export async function addCashOut(payload = {}, { actor } = {}) {
  requireOwner({ actor });
  const amount = Number(payload.amount);
  const body = {
    amount: String(amount),
    reason: String(payload.reason || '').trim(),
    ...(payload.date ? { date: payload.date } : {})
  };
  const raw = await apiRequest('/api/v1/cash/out', {
    method: 'POST',
    body,
    idempotencyKey: payload.idempotencyKey,
  });
  return normalizeCashEntry(raw);
}

export async function getCashReconciliations(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  // The backend might not support `businessDate` filtering on GET, so we filter it locally.
  const rows = await apiRequest('/api/v1/cash/reconciliations');
  let result = (rows || []).map(r => ({
    id: r.id,
    businessDate: r.businessDate,
    countedAt: r.countedAt,
    expectedCash: Number(r.expectedCash),
    physicalCash: Number(r.physicalCash),
    difference: Number(r.physicalCash) - Number(r.expectedCash),
    ledgerSequenceAtCount: Number(r.ledgerSequenceAtCount),
    notes: r.notes || '',
    reconciledBy: r.reconciledById || '',
    createdAt: r.countedAt,
    adjustmentTransactionId: r.adjustmentTransactionId || null,
    supersedesId: r.supersedesId || null,
    status: r.status || (r.adjustmentTransactionId ? 'ADJUSTED' : (r.supersedesId ? 'SUPERSEDED' : (Number(r.physicalCash) === Number(r.expectedCash) ? 'MATCHED' : 'UNAPPLIED'))),
    canAdjust: Boolean(r.canAdjust),
    stale: Boolean(r.stale),
  }));

  if (filters.businessDate) {
    result = result.filter((r) => r.businessDate === filters.businessDate);
  }
  return result;
}

export async function saveCashReconciliation(payload = {}, { actor } = {}) {
  requireOwner({ actor });
  const body = {
    physicalCash: String(Number(payload.physicalCash)),
    notes: String(payload.notes || '').trim(),
    ...(payload.ledgerVersion !== undefined ? { ledgerVersion: payload.ledgerVersion } : {})
  };

  const raw = await apiRequest('/api/v1/cash/reconciliations', {
    method: 'POST',
    body,
    idempotencyKey: payload.idempotencyKey,
  });
  return {
    ...raw,
    expectedCash: Number(raw.expectedCash),
    physicalCash: Number(raw.physicalCash),
    difference: Number(raw.physicalCash) - Number(raw.expectedCash),
  };
}

export async function applyCashReconciliation(id, payload = {}, { actor } = {}) {
  requireOwner({ actor });
  const body = {
    confirmed: payload.confirmed === true,
    reason: String(payload.reason || '').trim(),
  };

  const raw = await apiRequest(`/api/v1/cash/reconciliations/${encodeURIComponent(id)}/adjustment`, {
    method: 'POST',
    body,
  });
  // Assuming backend returns { reconciliation, adjustment } or similar
  return raw;
}

// These functions aggregate local data, similar to the mock
export async function getCashPeriodSummary(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  const [start, end] = cashDateRange(filters);
  // Warning: in real app, fetching ALL rows to do this might be heavy.
  // Assuming getCashEntries handles enough data or backend provides an endpoint.
  // For now, doing local aggregation over fetched entries
  const allRows = await getCashEntries();
  const prior = allRows.filter((row) => new Date(row.createdAt) < start);
  const rows = allRows.filter((row) => new Date(row.createdAt) >= start && new Date(row.createdAt) <= end);

  const sumCash = (arr) => arr.reduce((sum, row) => sum + Math.round(row.amount * 100) * (row.type === 'CASH_OUT' ? -1 : 1), 0) / 100;

  const opening = sumCash(prior);
  const total = (type) => sumCash(rows.filter((row) => row.type === type));

  return {
    opening,
    initialOpening: total('OPENING'),
    cashIn: total('CASH_IN'),
    cashOut: Math.abs(total('CASH_OUT')),
    adjustments: total('CASH_ADJUSTMENT'),
    expected: Math.round((opening + sumCash(rows)) * 100) / 100,
    from: cashBusinessDate(start),
    to: cashBusinessDate(end),
    rows,
  };
}

export async function getCashSnapshot({ actor } = {}) {
  requireOwner({ actor });
  const entries = await getCashEntries();
  const summary = await getCashPeriodSummary({}, { actor });
  const reconciliations = await getCashReconciliations({}, { actor });

  const earliest = entries.length ? entries[entries.length - 1].createdAt : new Date().toISOString();

  return {
    ...summary,
    currentCash: await getCurrentCash(),
    ledgerVersion: entries.length > 0 ? entries[0].ledgerSequence : 0,
    initialized: entries.some((row) => row.type === 'OPENING'),
    suggestedOpeningDate: cashBusinessDate(earliest),
    entries,
    reconciliations,
  };
}

export function _appendCashIn() {
  // Stub for backwards compatibility, no longer needed since server handles atomic transacitons.
  return { id: '' };
}
