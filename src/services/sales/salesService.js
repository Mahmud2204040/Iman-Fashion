/**
 * salesService — Phase 5 mock.
 *
 * Owns:
 *   - Customer lookup for the sale flow (delegates to customerService)
 *   - Product search and sale stock deduction through canonical productService
 *   - Sales code generation (S-YYYYMMDD-NNNN)
 *   - Completing a sale — creates the sale row AND a matching CASH_IN row,
 *     mirroring the backend contract from DATABASE_PLAN.md
 *
 * The module is intentionally self-contained and deterministic:
 *   - Shared customer/product catalogues
 *   - A small append-only log of completed sales for the list page
 *   - Same `delay()` helper as the rest of the mock layer
 *
 * Real backend will replace this file entirely. No business rules
 * beyond those documented in FRONTEND_PLAN.md are introduced here.
 */
import { delay } from '../delay.js';
import { ROLES } from '../../constants/roles.js';
import { _appendCashIn } from '../cash/cashService.js';
import { createCustomer as createSharedCustomer, getCustomerById, getCustomers } from '../customers/customerService.js';
import { _commitSaleStock, _getSaleProducts, _prepareSaleLines } from '../products/productService.js';

/* -------------------------------------------------------------------------- */
/* Mock catalogues                                                              */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* Append-only sale log                                                          */
/* -------------------------------------------------------------------------- */

const SALES_LOG = [
  {
    id: 'sale-001',
    salesCode: 'S-20260901-0014',
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
    salesCode: 'S-20260901-0013',
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
    salesCode: 'S-20260901-0012',
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
    salesCode: 'S-20260831-0009',
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
    salesCode: 'S-20260831-0008',
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
  const customers = await getCustomers(query);
  return customers.filter((customer) => customer.isActive);
}

export async function createCustomer(payload = {}, options = {}) {
  return createSharedCustomer(payload, options);
}

/* -------------------------------------------------------------------------- */
/* Product search                                                                */
/* -------------------------------------------------------------------------- */

export async function searchProducts(query = '') {
  await delay(120);
  return _getSaleProducts(query);
}

export async function getProductById(productId) {
  await delay(40);
  return _getSaleProducts().find((product) => product.id === productId) || null;
}

/* -------------------------------------------------------------------------- */
/* Sale list / detail                                                            */
/* -------------------------------------------------------------------------- */

function cloneSale(sale, { actor } = {}) {
  return {
    ...sale,
    items: sale.items.map((item) => {
      const line = { ...item };
      if (actor?.role === ROLES.EMPLOYEE) delete line.purchaseCostAtSale;
      else if (line.purchaseCostAtSale === undefined) line.purchaseCostAtSale = null;
      return line;
    }),
  };
}

export async function getSales(options = {}) {
  await delay(150);
  return SALES_LOG.slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((sale) => cloneSale(sale, options));
}

export async function getSaleById(id, options = {}) {
  await delay(80);
  const found = SALES_LOG.find((s) => s.id === id);
  if (!found) return null;
  return cloneSale(found, options);
}

export async function searchSalesByCode(code, options = {}) {
  await delay(80);
  const q = String(code || '').trim().toLowerCase();
  if (!q) return [];
  return SALES_LOG.filter((s) =>
    s.salesCode.toLowerCase().includes(q),
  ).map((sale) => cloneSale(sale, options));
}

/* -------------------------------------------------------------------------- */
/* Complete a sale                                                               */
/* -------------------------------------------------------------------------- */

const completedByKey = new Map();

export async function completeSale(payload, { actor } = {}) {
  await delay(200);
  const idempotencyKey = String(payload?.idempotencyKey || '').trim();
  if (idempotencyKey && completedByKey.has(idempotencyKey)) {
    const previous = completedByKey.get(idempotencyKey);
    return {
      sale: cloneSale(previous.sale, { actor }),
      cashIn: actor?.role === ROLES.EMPLOYEE ? null : { ...previous.cashIn },
    };
  }

  const items = Array.isArray(payload?.items) ? payload.items : [];
  const customer = payload?.customer || null;

  if (!customer?.id) {
    const err = new Error('Select or create a customer before completing the sale.');
    err.code = 'CUSTOMER_REQUIRED';
    throw err;
  }
  const canonicalCustomer = await getCustomerById(customer.id);
  if (!canonicalCustomer || !canonicalCustomer.isActive) {
    const err = new Error('Select an active customer.');
    err.code = 'CUSTOMER_UNAVAILABLE';
    throw err;
  }

  if (items.length === 0) {
    const err = new Error('Add at least one item before completing the sale.');
    err.code = 'EMPTY_CART';
    throw err;
  }

  const saleLines = _prepareSaleLines(items);
  const total = saleLines.reduce((sum, line) => sum + line.qty * line.price, 0);

  const now = new Date();
  const salesCode = nextSalesCodeFor(now);
  const saleId = `sale-${String(SALES_LOG.length + 1).padStart(3, '0')}`;

  const createdBy = actor?.username || 'unknown';
  const createdByRole = actor?.role || null;

  const sale = {
    id: saleId,
    salesCode,
    customerId: canonicalCustomer.id,
    customerName: canonicalCustomer.name,
    items: saleLines,
    total,
    status: 'COMPLETED',
    createdBy,
    createdByRole,
    createdAt: now.toISOString(),
    cashInId: null,
  };
  const cashIn = _appendCashIn({
    amount: total, referenceType: 'SALE', referenceId: saleId,
    reason: `Sale ${salesCode}`, createdBy, createdByRole,
    createdAt: now.toISOString(),
  });

  _commitSaleStock(saleLines, saleId, salesCode, actor, now.toISOString());
  sale.cashInId = cashIn.id;
  SALES_LOG.push(sale);
  if (idempotencyKey) completedByKey.set(idempotencyKey, { sale, cashIn });

  return { sale: cloneSale(sale, { actor }), cashIn: actor?.role === ROLES.EMPLOYEE ? null : cashIn };
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
