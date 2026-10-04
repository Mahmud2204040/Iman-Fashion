// src/services/rawMaterials/rawMaterialService.js
// Phase 10 — raw materials mock service.
//
// Per FRONTEND_PLAN.md §10 and REQUIREMENTS.md §52-55:
//   - record-keeping only, no production tracking
//   - completely separate from finished products
//   - no unit column required
//
// Fields (REQUIREMENTS §54):
//   item_name (required), quantity (required), description (optional),
//   date (required), purchase_cost (optional). Raw materials have no notes field.
// Audit: created_by / created_at / updated_at.
//
// Owner-only writes; list is also owner-only because the route is gated.
import { delay } from '../delay.js';
import { ROLES } from '../../constants/roles.js';

const OWNER_ROLE = [ROLES.OWNER];

const RAW_MATERIALS = [
  {
    id: 'rm-001',
    itemName: 'White cotton fabric',
    quantity: 120,
    description: 'Bleached cotton, 60-inch width, for school uniforms.',
    date: '2026-08-15',
    purchaseCost: 28800,
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2026-08-15T10:00:00Z',
    updatedAt: '2026-08-15T10:00:00Z',
  },
  {
    id: 'rm-002',
    itemName: 'Navy buttons (12mm)',
    quantity: 600,
    description: 'Pack of 100 pieces.',
    date: '2026-08-20',
    purchaseCost: 1800,
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2026-08-20T14:00:00Z',
    updatedAt: '2026-08-20T14:00:00Z',
  },
  {
    id: 'rm-003',
    itemName: 'Polyester thread cones',
    quantity: 24,
    description: 'White + assorted colours.',
    date: '2026-09-02',
    purchaseCost: 3600,
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2026-09-02T09:30:00Z',
    updatedAt: '2026-09-02T09:30:00Z',
  },
];

function nowIso() {
  return new Date().toISOString();
}

function requireOwner({ actor } = {}) {
  if (!actor || !OWNER_ROLE.includes(actor.role)) {
    const err = new Error('Only an owner can manage raw materials.');
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }
}

function normaliseQuantity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  // SPEC does not allow zero — quantity must be present and usable.
  if (n <= 0) return null;
  return n;
}

function normaliseCost(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function normaliseDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  // YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function getRawMaterials() {
  await delay(140);
  return RAW_MATERIALS.slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((r) => ({ ...r }));
}

export async function createRawMaterial(payload = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(160);

  const itemName = String(payload.itemName || '').trim();
  if (!itemName) {
    const err = new Error('Item name is required.');
    err.code = 'EMPTY_NAME';
    throw err;
  }
  if (itemName.length < 2) {
    const err = new Error('Item name must be at least 2 characters.');
    err.code = 'NAME_TOO_SHORT';
    throw err;
  }

  const quantity = normaliseQuantity(payload.quantity);
  if (quantity === null) {
    const err = new Error('Quantity must be a positive number.');
    err.code = 'INVALID_QTY';
    throw err;
  }

  const date = normaliseDate(payload.date);
  if (!date) {
    const err = new Error('Date is required.');
    err.code = 'EMPTY_DATE';
    throw err;
  }

  const description = String(payload.description || '').trim();

  const purchaseCost = normaliseCost(payload.purchaseCost);
  if (payload.purchaseCost !== undefined && payload.purchaseCost !== '' && purchaseCost === null) {
    const err = new Error('Purchase cost must be a non-negative number.');
    err.code = 'INVALID_COST';
    throw err;
  }

  const createdBy = actor?.username || 'unknown';
  const createdByRole = actor?.role || ROLES.OWNER;

  const id = 'rm-' + String(RAW_MATERIALS.length + 1).padStart(3, '0');
  const record = {
    id,
    itemName,
    quantity,
    description,
    date,
    purchaseCost: purchaseCost == null ? null : purchaseCost,
    createdBy,
    createdByRole,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  RAW_MATERIALS.push(record);
  return { ...record };
}

export async function updateRawMaterial(id, patch = {}, { actor } = {}) {
  requireOwner({ actor });
  await delay(160);

  const idx = RAW_MATERIALS.findIndex((r) => r.id === id);
  if (idx === -1) {
    const err = new Error('Raw material not found.');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const next = { ...RAW_MATERIALS[idx] };

  if (patch.itemName !== undefined) {
    const v = String(patch.itemName || '').trim();
    if (!v) {
      const err = new Error('Item name cannot be empty.');
      err.code = 'EMPTY_NAME';
      throw err;
    }
    next.itemName = v;
  }
  if (patch.quantity !== undefined) {
    const v = normaliseQuantity(patch.quantity);
    if (v === null) {
      const err = new Error('Quantity must be a positive number.');
      err.code = 'INVALID_QTY';
      throw err;
    }
    next.quantity = v;
  }
  if (patch.date !== undefined) {
    const v = normaliseDate(patch.date);
    if (!v) {
      const err = new Error('Date is required.');
      err.code = 'EMPTY_DATE';
      throw err;
    }
    next.date = v;
  }
  if (patch.description !== undefined) {
    next.description = String(patch.description || '').trim();
  }
  if (patch.purchaseCost !== undefined) {
    const v = normaliseCost(patch.purchaseCost);
    if (patch.purchaseCost !== '' && patch.purchaseCost !== null && v === null) {
      const err = new Error('Purchase cost must be a non-negative number.');
      err.code = 'INVALID_COST';
      throw err;
    }
    next.purchaseCost = v == null ? null : v;
  }

  next.updatedAt = nowIso();
  RAW_MATERIALS[idx] = next;
  return { ...next };
}
