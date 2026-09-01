/**
 * salesService — Phase 5 mock.
 *
 * Owns:
 *   - Customer lookup for the sale flow (search + quick-create)
 *   - Product search (read-only; stock adjustments land in Phase 8)
 *   - Sales code generation (S-YYYYMMDD-NNNN)
 *   - Completing a sale — creates the sale row AND a matching CASH_IN row,
 *     mirroring the backend contract from DATABASE_PLAN.md
 *
 * The module is intentionally self-contained and deterministic:
 *   - In-memory customer + product catalogues
 *   - A small append-only log of completed sales for the list page
 *   - Same `delay()` helper as the rest of the mock layer
 *
 * Real backend will replace this file entirely. No business rules
 * beyond those documented in FRONTEND_PLAN.md are introduced here.
 */
import { delay } from '../delay.js';
import { ROLES } from '../../constants/roles.js';
import { _appendCashIn } from '../cash/cashService.js';

/* -------------------------------------------------------------------------- */
/* Mock catalogues                                                              */
/* -------------------------------------------------------------------------- */

const CUSTOMERS = [
  {
    id: 'cust-001',
    name: 'Anika Tabassum',
    phone: '01711-200104',
    address: 'House 12, Road 7, Banani, Dhaka',
    isActive: true,
    createdAt: '2024-06-12T09:00:00Z',
  },
  {
    id: 'cust-002',
    name: 'Tahmid Hossain',
    phone: '01815-771234',
    address: 'Flat 3B, Lalmatia, Dhaka',
    isActive: true,
    createdAt: '2024-09-04T10:30:00Z',
  },
  {
    id: 'cust-003',
    name: 'Mst. Rafa',
    phone: '01933-445566',
    address: 'Sector 7, Uttara, Dhaka',
    isActive: true,
    createdAt: '2025-01-22T14:15:00Z',
  },
  {
    id: 'cust-004',
    name: 'Sabbir Ahmed',
    phone: '01678-901234',
    address: 'Mirpur 10, Dhaka',
    isActive: true,
    createdAt: '2025-03-08T11:45:00Z',
  },
  {
    id: 'cust-005',
    name: 'Nusrat Jahan',
    phone: '01722-556677',
    address: 'Mohammadpur, Dhaka',
    isActive: true,
    createdAt: '2025-04-19T16:00:00Z',
  },
];

const PRODUCTS = [
  {
    id: 'prod-001',
    name: 'Cotton salwar kameez',
    sku: 'NI-SK-001',
    price: 1_650,
    stock: 24,
    category: 'ready',
  },
  {
    id: 'prod-002',
    name: 'Linen shirt',
    sku: 'NI-LS-014',
    price: 950,
    stock: 41,
    category: 'ready',
  },
  {
    id: 'prod-003',
    name: 'Tailored trouser',
    sku: 'NI-TT-007',
    price: 1_250,
    stock: 18,
    category: 'ready',
  },
  {
    id: 'prod-004',
    name: 'Embroidered kurti',
    sku: 'NI-EK-022',
    price: 1_100,
    stock: 33,
    category: 'ready',
  },
  {
    id: 'prod-005',
    name: 'School uniform set',
    sku: 'NI-SU-003',
    price: 1_800,
    stock: 12,
    category: 'uniform',
  },
  {
    id: 'prod-006',
    name: 'Panjabi (cotton)',
    sku: 'NI-PJ-005',
    price: 1_450,
    stock: 27,
    category: 'ready',
  },
  {
    id: 'prod-007',
    name: 'Palazzo (printed)',
    sku: 'NI-PL-009',
    price: 850,
    stock: 19,
    category: 'ready',
  },
  {
    id: 'prod-008',
    name: 'Three-piece (georgette)',
    sku: 'NI-3P-018',
    price: 2_350,
    stock: 8,
    category: 'ready',
  },
];

/* -------------------------------------------------------------------------- */
/* Append-only sale log                                                          */
/* -------------------------------------------------------------------------- */

let nextCustomerSeq = CUSTOMERS.length;

const SALES_LOG = [
  {
    id: 'sale-001',
    salesCode: 'S-20250901-0014',
    customerId: 'cust-001',
    customerName: 'Anika Tabassum',
    items: [
      { productId: 'prod-001', productName: 'Cotton salwar kameez', qty: 1, price: 1_650 },
      { productId: 'prod-002', productName: 'Linen shirt', qty: 1, price: 0 },
    ],
    total: 1_650,
    status: 'COMPLETED',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2026-09-01T11:24:00Z',
    cashInId: 'cashin-001',
  },
  {
    id: 'sale-002',
    salesCode: 'S-20250901-0013',
    customerId: null,
    customerName: 'Walk-in',
    items: [
      { productId: 'prod-002', productName: 'Linen shirt', qty: 1, price: 720 },
    ],
    total: 720,
    status: 'COMPLETED',
    createdBy: 'employee',
    createdByRole: ROLES.EMPLOYEE,
    createdAt: '2026-09-01T10:11:00Z',
    cashInId: 'cashin-002',
  },
  {
    id: 'sale-003',
    salesCode: 'S-20250901-0012',
    customerId: 'cust-004',
    customerName: 'Sabbir Ahmed',
    items: [
      { productId: 'prod-003', productName: 'Tailored trouser', qty: 1, price: 1_240 },
      { productId: 'prod-002', productName: 'Linen shirt', qty: 1, price: 0 },
    ],
    total: 1_240,
    status: 'COMPLETED',
    createdBy: 'employee',
    createdByRole: ROLES.EMPLOYEE,
    createdAt: '2026-09-01T09:02:00Z',
    cashInId: 'cashin-003',
  },
  {
    id: 'sale-004',
    salesCode: 'S-20250831-0009',
    customerId: 'cust-002',
    customerName: 'Tahmid Hossain',
    items: [
      { productId: 'prod-006', productName: 'Panjabi (cotton)', qty: 1, price: 1_450 },
      { productId: 'prod-007', productName: 'Palazzo (printed)', qty: 1, price: 850 },
    ],
    total: 2_300,
    status: 'COMPLETED',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2026-08-31T18:42:00Z',
    cashInId: 'cashin-004',
  },
  {
    id: 'sale-005',
    salesCode: 'S-20250831-0008',
    customerId: 'cust-005',
    customerName: 'Nusrat Jahan',
    items: [
      { productId: 'prod-008', productName: 'Three-piece (georgette)', qty: 1, price: 2_350 },
    ],
    total: 2_350,
    status: 'COMPLETED',
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    createdAt: '2026-08-31T15:10:00Z',
    cashInId: 'cashin-005',
  },
];

/* -------------------------------------------------------------------------- */
/* Sales code generator                                                          */
/* -------------------------------------------------------------------------- */

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Generate the next sales code for the given date.
 * Shape: S-YYYYMMDD-NNNN (per FRONTEND_PLAN.md Q1).
 */
function nextSalesCodeFor(date = new Date()) {
  const prefix = `S-${ymd(date)}-`;
  const sameDay = SALES_LOG.filter((s) => s.salesCode.startsWith(prefix));
  const seq = sameDay.length + 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

export function generateSalesCode(date = new Date()) {
  return nextSalesCodeFor(date);
}

/* -------------------------------------------------------------------------- */
/* Customer lookup + creation                                                    */
/* -------------------------------------------------------------------------- */

export async function searchCustomers(query = '') {
  await delay(120);
  const q = String(query || '').trim().toLowerCase();
  if (!q) return CUSTOMERS.slice(0, 5).map((c) => ({ ...c }));
  return CUSTOMERS.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q),
  ).map((c) => ({ ...c }));
}

export async function createCustomer(payload = {}) {
  await delay(120);
  const name = String(payload.name || '').trim();
  const phone = String(payload.phone || '').trim();
  if (!name) {
    const err = new Error('Customer name is required.');
    err.code = 'EMPTY_NAME';
    throw err;
  }
  if (name.length < 2) {
    const err = new Error('Customer name is too short.');
    err.code = 'NAME_TOO_SHORT';
    throw err;
  }
  nextCustomerSeq += 1;
  const id = `cust-${String(nextCustomerSeq).padStart(3, '0')}`;
  const created = {
    id,
    name,
    phone,
    address: String(payload.address || '').trim(),
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  CUSTOMERS.push(created);
  return { ...created };
}

/* -------------------------------------------------------------------------- */
/* Product search                                                                */
/* -------------------------------------------------------------------------- */

export async function searchProducts(query = '') {
  await delay(120);
  const q = String(query || '').trim().toLowerCase();
  if (!q) return PRODUCTS.slice(0, 8).map((p) => ({ ...p }));
  return PRODUCTS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q),
  ).map((p) => ({ ...p }));
}

export async function getProductById(productId) {
  await delay(40);
  const found = PRODUCTS.find((p) => p.id === productId);
  if (!found) return null;
  return { ...found };
}

/* -------------------------------------------------------------------------- */
/* Sale list / detail                                                            */
/* -------------------------------------------------------------------------- */

export async function getSales() {
  await delay(150);
  return SALES_LOG.slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((s) => ({ ...s, items: s.items.map((i) => ({ ...i })) }));
}

export async function getSaleById(id) {
  await delay(80);
  const found = SALES_LOG.find((s) => s.id === id);
  if (!found) return null;
  return {
    ...found,
    items: found.items.map((i) => ({ ...i })),
  };
}

export async function searchSalesByCode(code) {
  await delay(80);
  const q = String(code || '').trim().toLowerCase();
  if (!q) return [];
  return SALES_LOG.filter((s) =>
    s.salesCode.toLowerCase().includes(q),
  ).map((s) => ({ ...s }));
}

/* -------------------------------------------------------------------------- */
/* Complete a sale                                                               */
/* -------------------------------------------------------------------------- */

let cashInSeq = 5;

export async function completeSale(payload, { actor } = {}) {
  await delay(200);

  const items = Array.isArray(payload?.items) ? payload.items : [];
  const customer = payload?.customer || null;

  if (items.length === 0) {
    const err = new Error('Add at least one item before completing the sale.');
    err.code = 'EMPTY_CART';
    throw err;
  }

  for (const [index, item] of items.entries()) {
    const qty = Number(item.qty);
    if (!Number.isFinite(qty) || qty < 1) {
      const err = new Error(
        `Item ${index + 1}: quantity must be at least 1.`,
      );
      err.code = 'INVALID_QTY';
      throw err;
    }
    const price = Number(item.price);
    if (!Number.isFinite(price) || price < 0) {
      const err = new Error(
        `Item ${index + 1}: price must be a non-negative number.`,
      );
      err.code = 'INVALID_PRICE';
      throw err;
    }
  }

  const total = items.reduce(
    (sum, item) => sum + Number(item.qty) * Number(item.price),
    0,
  );

  const now = new Date();
  const salesCode = nextSalesCodeFor(now);
  const saleId = `sale-${String(SALES_LOG.length + 1).padStart(3, '0')}`;
  cashInSeq += 1;
  const cashInId = `cashin-${String(cashInSeq).padStart(3, '0')}`;

  const createdBy = actor?.username || 'unknown';
  const createdByRole = actor?.role || null;

  const sale = {
    id: saleId,
    salesCode,
    customerId: customer?.id || null,
    customerName: customer?.name || 'Walk-in',
    items: items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      qty: Number(i.qty),
      price: Number(i.price),
    })),
    total,
    status: 'COMPLETED',
    createdBy,
    createdByRole,
    createdAt: now.toISOString(),
    cashInId,
  };

  const cashInLocal = {
    id: cashInId,
    type: 'CASH_IN',
    amount: total,
    referenceType: 'SALE',
    referenceId: saleId,
    reason: `Sale ${salesCode}`,
    createdBy,
    createdByRole,
    createdAt: now.toISOString(),
  };

  SALES_LOG.push(sale);

  // Mirror into the shared shop-cash ledger so getCurrentCash() reflects
  // real inflow.
  const cashIn = _appendCashIn({
    amount: cashInLocal.amount,
    referenceType: cashInLocal.referenceType,
    referenceId: cashInLocal.referenceId,
    reason: cashInLocal.reason,
    createdBy: cashInLocal.createdBy,
    createdByRole: cashInLocal.createdByRole,
    createdAt: cashInLocal.createdAt,
  });

  return { sale, cashIn };
}

export function _getRecentCashIn() {
  return SALES_LOG.map((s) => ({
    id: s.cashInId,
    type: 'CASH_IN',
    amount: s.total,
    referenceType: 'SALE',
    referenceId: s.id,
    reason: `Sale ${s.salesCode}`,
    createdBy: s.createdBy,
    createdByRole: s.createdByRole,
    createdAt: s.createdAt,
  }));
}
