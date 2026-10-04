/**
 * supplierService — Phase 9 mock.
 *
 * Owns the supplier directory + supplier-side payment ledger.
 *
 * Per FRONTEND_PLAN.md §Phase 9:
 *   - Owner-only module
 *   - Supplier totals: Purchases / Paid / Due
 *   - Receipt image upload + preview (mock URL only — no real upload)
 *   - Supplier payments are SEPARATE from shop cash; they never
 *     auto-create a CASH_OUT row.
 *   - No automatic cash treatment here — owner records payments
 *     manually outside shop cash.
 *
 * Payments are allocated to purchases only. A physical cash payment needs
 * a separate, explicit Owner Cash Out when shop cash should change.
 *
 * Real backend will replace this file entirely.
 */
import { ROLES } from '../../constants/roles.js';
import { delay } from '../delay.js';

/* -------------------------------------------------------------------------- */
/* Mock suppliers                                                               */
/* -------------------------------------------------------------------------- */

const SUPPLIERS = [
  {
    id: 'sup-001',
    name: 'Aarong Fabrics Ltd.',
    contactPerson: 'Mohammad Rahman',
    phone: '+8801711000111',
    email: 'orders@aarong.example',
    address: 'Plot 14, Tejgaon Industrial Area, Dhaka',
    notes: 'Primary uniform fabric supplier — net 30 terms.',
    isActive: true,
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    updatedBy: 'owner',
    updatedByRole: ROLES.OWNER,
    createdAt: '2025-01-10T09:00:00Z',
    updatedAt: '2025-09-01T11:00:00Z',
  },
  {
    id: 'sup-002',
    name: 'Bengal Buttons & Trims',
    contactPerson: 'Shahana Akter',
    phone: '+8801722000222',
    email: 'sales@bengaltrims.example',
    address: '21 Islampur Road, Dhaka 1100',
    notes: 'Cash on delivery. Small orders only.',
    isActive: true,
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    updatedBy: 'owner',
    updatedByRole: ROLES.OWNER,
    createdAt: '2025-02-04T09:00:00Z',
    updatedAt: '2025-08-22T15:30:00Z',
  },
  {
    id: 'sup-003',
    name: 'Deshi Dyeing Works',
    contactPerson: 'Kamrul Islam',
    phone: '+8801733000333',
    email: 'kamrul@deshidye.example',
    address: 'BSCIC Estate, Tongi, Gazipur',
    notes: 'Bulk orders only. Lead time 10–14 days.',
    isActive: true,
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    updatedBy: 'owner',
    updatedByRole: ROLES.OWNER,
    createdAt: '2025-03-18T09:00:00Z',
    updatedAt: '2025-09-12T10:00:00Z',
  },
  {
    id: 'sup-004',
    name: 'Garments Packaging Co.',
    contactPerson: 'Rezaul Karim',
    phone: '+8801744000444',
    email: 'rezaul@gpack.example',
    address: 'Mouchak, Kaliakair, Gazipur',
    notes: 'Poly bags, tags, and cartons.',
    isActive: true,
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    updatedBy: 'owner',
    updatedByRole: ROLES.OWNER,
    createdAt: '2025-04-22T09:00:00Z',
    updatedAt: '2025-08-30T14:00:00Z',
  },
  {
    id: 'sup-005',
    name: 'Local Tailoring House',
    contactPerson: 'Abdul Malek',
    phone: '+8801755000555',
    email: '',
    address: 'Mirpur 10, Dhaka 1216',
    notes: 'Inactive — switched to in-house production 2025-08.',
    isActive: false,
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    updatedBy: 'owner',
    updatedByRole: ROLES.OWNER,
    createdAt: '2025-05-08T09:00:00Z',
    updatedAt: '2025-08-15T16:00:00Z',
  },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                      */
/* -------------------------------------------------------------------------- */

function cloneSupplier(s) {
  return { ...s, supplierCode: `SUP-${String(s.id).split('-')[1]}` };
}

function nowIso() {
  return new Date().toISOString();
}

function requireRole({ actor } = {}, allowedRoles) {
  if (!actor || !allowedRoles.includes(actor.role)) {
    const err = new Error('Only an owner can perform this action.');
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                   */
/* -------------------------------------------------------------------------- */

const OWNER_ROLE = [ROLES.OWNER];

export async function getSuppliers() {
  await delay(140);
  return SUPPLIERS.slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(cloneSupplier);
}

export async function getSupplierById(id) {
  await delay(80);
  const found = SUPPLIERS.find((s) => s.id === id);
  return found ? cloneSupplier(found) : null;
}

export async function searchSuppliers(query = '') {
  await delay(60);
  const q = String(query || '').trim().toLowerCase();
  if (!q) return SUPPLIERS.slice().map(cloneSupplier);
  return SUPPLIERS.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      (s.contactPerson || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q) ||
      `sup-${String(s.id).split('-')[1]}`.includes(q)
  ).map(cloneSupplier);
}

export async function createSupplier(payload = {}, { actor } = {}) {
  requireRole({ actor }, OWNER_ROLE);
  await delay(180);

  const name = String(payload.name || '').trim();
  const contactPerson = String(payload.contactPerson || '').trim();
  const phone = String(payload.phone || '').trim();
  const email = String(payload.email || '').trim();
  const address = String(payload.address || '').trim();
  const notes = String(payload.notes || '').trim();

  if (!name) {
    const err = new Error('Supplier name is required.');
    err.code = 'EMPTY_NAME';
    throw err;
  }
  if (
    SUPPLIERS.some(
      (s) => s.name.toLowerCase() === name.toLowerCase() && s.isActive,
    )
  ) {
    const err = new Error('An active supplier with this name already exists.');
    err.code = 'DUPLICATE_NAME';
    throw err;
  }
  if (!phone) {
    const err = new Error('A phone number is required.');
    err.code = 'EMPTY_PHONE';
    throw err;
  }
  if (phone.length > 32) {
    const err = new Error('Phone number must be 32 characters or fewer.');
    err.code = 'PHONE_TOO_LONG';
    throw err;
  }

  const id = 'sup-' + String(SUPPLIERS.length + 1).padStart(3, '0');
  const createdBy = actor?.username || 'unknown';
  const createdByRole = actor?.role || ROLES.OWNER;
  const supplier = {
    id,
    name,
    contactPerson,
    phone,
    email,
    address,
    notes,
    isActive: payload.isActive === false ? false : true,
    createdBy,
    createdByRole,
    updatedBy: createdBy,
    updatedByRole: createdByRole,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  SUPPLIERS.push(supplier);
  return cloneSupplier(supplier);
}

export async function updateSupplier(id, patch = {}, { actor } = {}) {
  requireRole({ actor }, OWNER_ROLE);
  await delay(140);
  const idx = SUPPLIERS.findIndex((s) => s.id === id);
  if (idx === -1) {
    const err = new Error('Supplier not found.');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const target = SUPPLIERS[idx];
  const next = { ...target };

  if (patch.name !== undefined) {
    const name = String(patch.name || '').trim();
    if (!name) {
      const err = new Error('Supplier name cannot be empty.');
      err.code = 'EMPTY_NAME';
      throw err;
    }
    next.name = name;
  }
  if (patch.contactPerson !== undefined) {
    next.contactPerson = String(patch.contactPerson || '').trim();
  }
  if (patch.phone !== undefined) {
    const phone = String(patch.phone || '').trim();
    if (!phone) {
      const err = new Error('Phone number cannot be empty.');
      err.code = 'EMPTY_PHONE';
      throw err;
    }
    next.phone = phone;
  }
  if (patch.email !== undefined) {
    next.email = String(patch.email || '').trim();
  }
  if (patch.address !== undefined) {
    next.address = String(patch.address || '').trim();
  }
  if (patch.notes !== undefined) {
    next.notes = String(patch.notes || '').trim();
  }
  if (patch.isActive !== undefined) {
    next.isActive = Boolean(patch.isActive);
  }

  next.updatedBy = actor?.username || 'unknown';
  next.updatedByRole = actor?.role || ROLES.OWNER;
  next.updatedAt = nowIso();
  SUPPLIERS[idx] = next;
  return cloneSupplier(next);
}

export async function setSupplierStatus(id, isActive, { actor } = {}) {
  requireRole({ actor }, OWNER_ROLE);
  return updateSupplier(id, { isActive: Boolean(isActive) }, { actor });
}

/**
 * Aggregate purchase totals per supplier.
 * Returned shape: { purchasesTotal, paidTotal, dueTotal, purchaseCount }.
 *
 * `purchases` is supplied by the caller (purchaseService) so this service
 * does not depend on purchaseService directly — keeps modules decoupled.
 */
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

/**
 * Flat list of all supplier-side payments (for the "all supplier payments"
 * view). These records never synthesize a shop Cash Out.
 *
 * Per FRONTEND_PLAN.md, supplier payments do NOT appear in shop cash —
 * they live on the supplier's record only.
 */
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
