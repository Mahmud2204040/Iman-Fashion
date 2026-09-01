/**
 * productService — Phase 8 mock.
 *
 * Owns the product catalogue and stock ledger. Per FRONTEND_PLAN.md
 * (Phase 8 — Products & Stock):
 *
 *   - Owner-only module
 *   - Stock shown as a plain number — no color bands / thresholds
 *   - Stock adjustment form:
 *       Quantity Change (+ / -) + Reason (required, free text)
 *   - The only structured reason shortcut is `OPENING_STOCK`
 *   - No predefined reason enum
 *   - No purchase_price gating on this page (the "profit" report will
 *     surface purchase price once the relevant data is captured)
 *
 * Real backend will replace this file entirely.
 */
import { ROLES } from '../../constants/roles.js';
import { delay } from '../delay.js';

/* -------------------------------------------------------------------------- */
/* Mock products                                                                */
/* -------------------------------------------------------------------------- */

const PRODUCTS = [
  {
    id: 'prd-001',
    sku: 'UNI-S3-NAVY',
    name: 'School uniform — Navy (Class 3)',
    category: 'Uniforms',
    description: 'Navy blue school uniform set: tunic + hijab + trousers.',
    price: 1850,
    purchasePrice: null,
    stock: 24,
    reorderLevel: 0,
    isActive: true,
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    updatedBy: 'owner',
    updatedByRole: ROLES.OWNER,
    createdAt: '2025-03-10T09:30:00Z',
    updatedAt: '2025-09-12T11:00:00Z',
  },
  {
    id: 'prd-002',
    sku: 'UNI-S5-NAVY',
    name: 'School uniform — Navy (Class 5)',
    category: 'Uniforms',
    description: 'Navy blue school uniform set for Class 5.',
    price: 2100,
    purchasePrice: null,
    stock: 18,
    reorderLevel: 0,
    isActive: true,
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    updatedBy: 'owner',
    updatedByRole: ROLES.OWNER,
    createdAt: '2025-03-12T09:30:00Z',
    updatedAt: '2025-09-10T10:00:00Z',
  },
  {
    id: 'prd-003',
    sku: 'HIJAB-PREMIUM',
    name: 'Premium hijab — stone grey',
    category: 'Hijabs',
    description: 'Stone grey premium hijab with anti-slip lining.',
    price: 650,
    purchasePrice: null,
    stock: 36,
    reorderLevel: 0,
    isActive: true,
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    updatedBy: 'owner',
    updatedByRole: ROLES.OWNER,
    createdAt: '2025-04-02T09:30:00Z',
    updatedAt: '2025-09-08T16:00:00Z',
  },
  {
    id: 'prd-004',
    sku: 'BLOUSE-WHITE',
    name: 'White blouse — formal',
    category: 'Blouses',
    description: 'Long-sleeve formal white blouse.',
    price: 980,
    purchasePrice: null,
    stock: 14,
    reorderLevel: 0,
    isActive: true,
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    updatedBy: 'owner',
    updatedByRole: ROLES.OWNER,
    createdAt: '2025-05-20T09:30:00Z',
    updatedAt: '2025-09-04T12:00:00Z',
  },
  {
    id: 'prd-005',
    sku: 'DRESS-SPRING',
    name: 'Spring dress — floral',
    category: 'Dresses',
    description: 'Light floral spring dress with pleated hem.',
    price: 1450,
    purchasePrice: null,
    stock: 7,
    reorderLevel: 0,
    isActive: true,
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    updatedBy: 'owner',
    updatedByRole: ROLES.OWNER,
    createdAt: '2025-06-04T09:30:00Z',
    updatedAt: '2025-09-02T09:00:00Z',
  },
];

/* Stock ledger — append-only history. Each entry rolled into stock total. */
const STOCK_LEDGER = [
  {
    id: 'sl-001',
    productId: 'prd-001',
    delta: 24,
    reason: 'OPENING_STOCK',
    note: 'Initial shelf count',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2025-03-10T09:30:00Z',
  },
  {
    id: 'sl-002',
    productId: 'prd-002',
    delta: 20,
    reason: 'OPENING_STOCK',
    note: 'Initial shelf count',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2025-03-12T09:30:00Z',
  },
  {
    id: 'sl-003',
    productId: 'prd-003',
    delta: 40,
    reason: 'OPENING_STOCK',
    note: 'Initial shelf count',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2025-04-02T09:30:00Z',
  },
  {
    id: 'sl-004',
    productId: 'prd-004',
    delta: 15,
    reason: 'OPENING_STOCK',
    note: 'Initial shelf count',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2025-05-20T09:30:00Z',
  },
  {
    id: 'sl-005',
    productId: 'prd-005',
    delta: 10,
    reason: 'OPENING_STOCK',
    note: 'Initial shelf count',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2025-06-04T09:30:00Z',
  },
  {
    id: 'sl-006',
    productId: 'prd-001',
    delta: -1,
    reason: 'Damaged in shop',
    note: 'Torn sleeve found during morning check',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2025-09-01T10:00:00Z',
  },
  {
    id: 'sl-007',
    productId: 'prd-002',
    delta: -2,
    reason: 'Sold to retail customer',
    note: 'Walk-in customer 2025-09-04',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2025-09-04T15:00:00Z',
  },
  {
    id: 'sl-008',
    productId: 'prd-003',
    delta: -4,
    reason: 'Sold to retail customers',
    note: 'Multiple walk-in sales 2025-09-05-08',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2025-09-08T16:00:00Z',
  },
  {
    id: 'sl-009',
    productId: 'prd-004',
    delta: -1,
    reason: 'Reserved for custom order',
    note: 'Custom order cust-002 children',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2025-09-04T12:00:00Z',
  },
  {
    id: 'sl-010',
    productId: 'prd-005',
    delta: -3,
    reason: 'Sold to retail customer',
    note: 'Bulk order 2025-09-02',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2025-09-02T09:00:00Z',
  },
  {
    id: 'sl-011',
    productId: 'prd-001',
    delta: 1,
    reason: 'Returned from custom order (cancelled)',
    note: 'Returned from cancelled custom order 2025-09-10',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2025-09-10T10:00:00Z',
  },
  {
    id: 'sl-012',
    productId: 'prd-001',
    delta: -2,
    reason: 'Sold to retail customer',
    note: 'Walk-in sales 2025-09-11',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2025-09-11T17:00:00Z',
  },
  {
    id: 'sl-013',
    productId: 'prd-002',
    delta: 1,
    reason: 'Returned / exchange',
    note: 'Wrong size returned by cust-002',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2025-09-09T14:00:00Z',
  },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                      */
/* -------------------------------------------------------------------------- */

function cloneProduct(p) {
  return { ...p, tags: [...(p.tags || [])] };
}

function cloneLedger(r) {
  return { ...r };
}

function ledgerCount(productId) {
  return STOCK_LEDGER
    .filter((r) => r.productId === productId)
    .reduce((sum, r) => sum + Number(r.delta || 0), 0);
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

export async function getProducts() {
  await delay(150);
  return PRODUCTS.map(cloneProduct).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export async function getProductById(id) {
  await delay(120);
  const found = PRODUCTS.find((p) => p.id === id);
  return found ? cloneProduct(found) : null;
}

export async function searchProducts(query = '') {
  await delay(80);
  const q = String(query || '').trim().toLowerCase();
  if (!q) return PRODUCTS.map(cloneProduct);
  return PRODUCTS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q),
  ).map(cloneProduct);
}

export async function createProduct(payload = {}, { actor } = {}) {
  requireRole({ actor }, OWNER_ROLE);
  await delay(180);
  const name = String(payload.name || '').trim();
  const sku = String(payload.sku || '').trim();
  const price = Number(payload.price);
  const stock = payload.stock === undefined ? 0 : Number(payload.stock);

  if (!name) {
    const err = new Error('Product name is required.');
    err.code = 'EMPTY_NAME';
    throw err;
  }
  if (!sku) {
    const err = new Error('SKU is required.');
    err.code = 'EMPTY_SKU';
    throw err;
  }
  if (sku.length > 32) {
    const err = new Error('SKU must be 32 characters or fewer.');
    err.code = 'SKU_TOO_LONG';
    throw err;
  }
  if (PRODUCTS.some((p) => p.sku.toLowerCase() === sku.toLowerCase())) {
    const err = new Error('A product with this SKU already exists.');
    err.code = 'DUPLICATE_SKU';
    throw err;
  }
  if (!Number.isFinite(price) || price <= 0) {
    const err = new Error('Price must be a positive number.');
    err.code = 'INVALID_PRICE';
    throw err;
  }
  if (
    payload.purchasePrice !== undefined &&
    payload.purchasePrice !== null &&
    payload.purchasePrice !== ''
  ) {
    const pp = Number(payload.purchasePrice);
    if (!Number.isFinite(pp) || pp < 0) {
      const err = new Error('Purchase price must be 0 or a positive number.');
      err.code = 'INVALID_PURCHASE_PRICE';
      throw err;
    }
  }
  if (!Number.isFinite(stock) || stock < 0) {
    const err = new Error('Stock must be 0 or a positive number.');
    err.code = 'INVALID_STOCK';
    throw err;
  }

  const id = 'prd-' + String(PRODUCTS.length + 1).padStart(3, '0');
  const product = {
    id,
    sku,
    name,
    category: String(payload.category || '').trim() || 'Uncategorized',
    description: String(payload.description || '').trim(),
    price,
    purchasePrice:
      payload.purchasePrice === undefined || payload.purchasePrice === null || payload.purchasePrice === ''
        ? null
        : Number(payload.purchasePrice),
    stock,
    reorderLevel: Number(payload.reorderLevel) || 0,
    isActive: payload.isActive === false ? false : true,
    createdBy: actor?.username || 'unknown',
    createdByRole: actor?.role || ROLES.OWNER,
    updatedBy: actor?.username || 'unknown',
    updatedByRole: actor?.role || ROLES.OWNER,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  PRODUCTS.unshift(product);

  if (stock !== 0) {
    STOCK_LEDGER.unshift({
      id: 'sl-' + String(STOCK_LEDGER.length + 1).padStart(3, '0'),
      productId: id,
      delta: stock,
      reason: 'OPENING_STOCK',
      note: 'Opening stock at creation',
      createdBy: actor?.username || 'unknown',
      createdByRole: actor?.role || ROLES.OWNER,
      createdAt: nowIso(),
    });
  }

  return cloneProduct(product);
}

export async function updateProduct(id, patch = {}, { actor } = {}) {
  requireRole({ actor }, OWNER_ROLE);
  await delay(160);
  const idx = PRODUCTS.findIndex((p) => p.id === id);
  if (idx === -1) {
    const err = new Error('Product not found.');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const target = PRODUCTS[idx];
  const next = { ...target };

  if (patch.name !== undefined) {
    const name = String(patch.name || '').trim();
    if (!name) {
      const err = new Error('Product name cannot be empty.');
      err.code = 'EMPTY_NAME';
      throw err;
    }
    next.name = name;
  }
  if (patch.sku !== undefined) {
    const sku = String(patch.sku || '').trim();
    if (!sku) {
      const err = new Error('SKU cannot be empty.');
      err.code = 'EMPTY_SKU';
      throw err;
    }
    if (
      PRODUCTS.some(
        (p) => p.id !== id && p.sku.toLowerCase() === sku.toLowerCase(),
      )
    ) {
      const err = new Error('A product with this SKU already exists.');
      err.code = 'DUPLICATE_SKU';
      throw err;
    }
    next.sku = sku;
  }
  if (patch.category !== undefined) {
    next.category = String(patch.category || '').trim() || 'Uncategorized';
  }
  if (patch.description !== undefined) {
    next.description = String(patch.description || '').trim();
  }
  if (patch.price !== undefined) {
    const price = Number(patch.price);
    if (!Number.isFinite(price) || price <= 0) {
      const err = new Error('Price must be a positive number.');
      err.code = 'INVALID_PRICE';
      throw err;
    }
    next.price = price;
  }
  if (patch.purchasePrice !== undefined) {
    if (patch.purchasePrice === null || patch.purchasePrice === '') {
      next.purchasePrice = null;
    } else {
      const pp = Number(patch.purchasePrice);
      if (!Number.isFinite(pp) || pp < 0) {
        const err = new Error('Purchase price must be 0 or a positive number.');
        err.code = 'INVALID_PURCHASE_PRICE';
        throw err;
      }
      next.purchasePrice = pp;
    }
  }
  if (patch.reorderLevel !== undefined) {
    const rl = Number(patch.reorderLevel);
    if (!Number.isFinite(rl) || rl < 0) {
      const err = new Error('Reorder level must be 0 or a positive number.');
      err.code = 'INVALID_REORDER';
      throw err;
    }
    next.reorderLevel = rl;
  }
  if (patch.isActive !== undefined) {
    next.isActive = Boolean(patch.isActive);
  }

  next.updatedBy = actor?.username || 'unknown';
  next.updatedByRole = actor?.role || ROLES.OWNER;
  next.updatedAt = nowIso();
  PRODUCTS[idx] = next;
  return cloneProduct(next);
}

export async function adjustStock(productId, adjustment = {}, { actor } = {}) {
  requireRole({ actor }, OWNER_ROLE);
  await delay(160);
  const idx = PRODUCTS.findIndex((p) => p.id === productId);
  if (idx === -1) {
    const err = new Error('Product not found.');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const delta = Number(adjustment.delta);
  const reason = String(adjustment.reason || '').trim();
  const note = String(adjustment.note || '').trim();

  if (!Number.isFinite(delta) || delta === 0) {
    const err = new Error('Quantity change must be a non-zero number (+ / -).');
    err.code = 'INVALID_DELTA';
    throw err;
  }
  if (delta < -1000 || delta > 1000) {
    const err = new Error('Quantity change must be between -1000 and +1000.');
    err.code = 'DELTA_OUT_OF_RANGE';
    throw err;
  }
  if (!reason) {
    const err = new Error('A reason is required for every stock adjustment.');
    err.code = 'EMPTY_REASON';
    throw err;
  }
  if (reason.length > 120) {
    const err = new Error('Reason must be 120 characters or fewer.');
    err.code = 'REASON_TOO_LONG';
    throw err;
  }

  const current = PRODUCTS[idx];
  const currentStock = ledgerCount(current.id);
  if (currentStock + delta < 0) {
    const err = new Error(
      `Adjustment would drive stock negative (current ${currentStock}, change ${delta}).`,
    );
    err.code = 'NEGATIVE_STOCK';
    throw err;
  }

  STOCK_LEDGER.unshift({
    id: 'sl-' + String(STOCK_LEDGER.length + 1).padStart(3, '0'),
    productId: current.id,
    delta,
    reason,
    note,
    createdBy: actor?.username || 'unknown',
    createdByRole: actor?.role || ROLES.OWNER,
    createdAt: nowIso(),
  });

  current.stock = currentStock + delta;
  current.updatedBy = actor?.username || 'unknown';
  current.updatedByRole = actor?.role || ROLES.OWNER;
  current.updatedAt = nowIso();
  PRODUCTS[idx] = current;

  return { product: cloneProduct(current), entry: cloneLedger(STOCK_LEDGER[0]) };
}

export async function getStockHistory(productId) {
  await delay(120);
  return STOCK_LEDGER.filter((r) => r.productId === productId)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(cloneLedger);
}

/** Test/admin helper — full pre-POST state. Not exported in index. */
export function _getLedger() {
  return STOCK_LEDGER.map(cloneLedger);
}
