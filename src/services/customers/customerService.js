/**
 * customerService — Phase 6 mock.
 *
 * Owns the customer catalogue and per-customer tab data. Implements
 * the Phase 6 contract from FRONTEND_PLAN.md:
 *
 *   - Profile (id, name, phone, address, status, audit, derived class)
 *   - Sales History (recent sales for this customer)
 *   - Custom Orders (recent custom orders for this customer)
 *   - Due Summary (running balance / open dues)
 *   - Children with derived current class from initial_class +
 *     years_since(created_at)
 *   - No delete — status toggle (isActive)
 *   - Audit columns: created_by / updated_by
 *
 * The due summary uses a flat "paid vs due" model: each sale / custom
 * order contributes an entry. The frontend doesn't model payment
 * recording here (that lives in Phase 7 / 10). For now, due_summary
 * surfaces the open items so the UI can render a clear picture.
 *
 * Real backend will replace this file entirely.
 */
import { ROLES } from '../../constants/roles.js';
import { deriveCurrentClass } from '../../utils/customer.js';
import { delay } from '../delay.js';

/* -------------------------------------------------------------------------- */
/* Mock catalogues                                                              */
/* -------------------------------------------------------------------------- */

const CUSTOMERS = [
  {
    id: 'cust-001',
    name: 'Anika Tabassum',
    phone: '01711-200104',
    address: 'House 12, Road 7, Banani, Dhaka',
    initialClass: 'A',
    isActive: true,
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    updatedBy: 'owner',
    updatedByRole: ROLES.OWNER,
    createdAt: '2024-06-12T09:00:00Z',
    updatedAt: '2025-08-21T14:00:00Z',
  },
  {
    id: 'cust-002',
    name: 'Tahmid Hossain',
    phone: '01815-771234',
    address: 'Flat 3B, Lalmatia, Dhaka',
    initialClass: 'B',
    isActive: true,
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    updatedBy: 'employee',
    updatedByRole: ROLES.EMPLOYEE,
    createdAt: '2024-09-04T10:30:00Z',
    updatedAt: '2025-09-02T09:30:00Z',
  },
  {
    id: 'cust-003',
    name: 'Mst. Rafa',
    phone: '01933-445566',
    address: 'Sector 7, Uttara, Dhaka',
    initialClass: 'A',
    isActive: true,
    createdBy: 'employee',
    createdByRole: ROLES.EMPLOYEE,
    updatedBy: 'employee',
    updatedByRole: ROLES.EMPLOYEE,
    createdAt: '2025-01-22T14:15:00Z',
    updatedAt: '2025-08-30T11:15:00Z',
  },
  {
    id: 'cust-004',
    name: 'Sabbir Ahmed',
    phone: '01678-901234',
    address: 'Mirpur 10, Dhaka',
    initialClass: 'C',
    isActive: true,
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    updatedBy: 'owner',
    updatedByRole: ROLES.OWNER,
    createdAt: '2025-03-08T11:45:00Z',
    updatedAt: '2025-08-28T16:00:00Z',
  },
  {
    id: 'cust-005',
    name: 'Nusrat Jahan',
    phone: '01755-321098',
    address: 'Gulshan 2, Dhaka',
    initialClass: 'A',
    isActive: false, // toggled inactive
    createdBy: 'owner',
    createdByRole: ROLES.OWNER,
    updatedBy: 'owner',
    updatedByRole: ROLES.OWNER,
    createdAt: '2024-11-19T13:00:00Z',
    updatedAt: '2025-09-01T10:00:00Z',
  },
  {
    id: 'cust-006',
    name: 'Riyad Karim',
    phone: '01515-909090',
    address: 'Dhanmondi 15, Dhaka',
    initialClass: 'B',
    isActive: true,
    createdBy: 'employee',
    createdByRole: ROLES.EMPLOYEE,
    updatedBy: 'employee',
    updatedByRole: ROLES.EMPLOYEE,
    createdAt: '2025-04-05T08:30:00Z',
    updatedAt: '2025-09-04T12:00:00Z',
  },
];

/* Children of each customer (school uniform programme example). */
const CHILDREN = [
  {
    id: 'kid-001',
    customerId: 'cust-001',
    name: 'Sara Tabassum',
    initialClass: '3',
    createdAt: '2024-06-12T09:05:00Z',
  },
  {
    id: 'kid-002',
    customerId: 'cust-001',
    name: 'Adnan Tabassum',
    initialClass: '1',
    createdAt: '2025-01-10T09:05:00Z',
  },
  {
    id: 'kid-003',
    customerId: 'cust-002',
    name: 'Tasnim Hossain',
    initialClass: '5',
    createdAt: '2024-09-04T10:35:00Z',
  },
  {
    id: 'kid-004',
    customerId: 'cust-003',
    name: 'Aariz Rafa',
    initialClass: '2',
    createdAt: '2025-01-22T14:20:00Z',
  },
];

/* Linked sales — per-customer summary (subset of salesService.SALES_LOG). */
const SALES_BY_CUSTOMER = {
  'cust-001': [
    {
      id: 'sale-101',
      salesCode: 'S-20250905-0007',
      total: 2350,
      createdAt: '2025-09-05T11:20:00Z',
      itemCount: 2,
    },
  ],
  'cust-002': [
    {
      id: 'sale-102',
      salesCode: 'S-20250831-0009',
      total: 2300,
      createdAt: '2025-08-31T18:42:00Z',
      itemCount: 2,
    },
  ],
  'cust-003': [
    {
      id: 'sale-103',
      salesCode: 'S-20250908-0002',
      total: 1850,
      createdAt: '2025-09-08T10:00:00Z',
      itemCount: 1,
    },
  ],
  'cust-004': [
    {
      id: 'sale-104',
      salesCode: 'S-20250901-0012',
      total: 1240,
      createdAt: '2025-09-01T09:02:00Z',
      itemCount: 2,
    },
  ],
  'cust-005': [
    {
      id: 'sale-105',
      salesCode: 'S-20250831-0008',
      total: 2350,
      createdAt: '2025-08-31T15:10:00Z',
      itemCount: 1,
    },
  ],
  'cust-006': [],
};

/* Linked custom orders (Phase 7 shape preview). */
const CUSTOM_ORDERS_BY_CUSTOMER = {
  'cust-001': [
    {
      id: 'co-201',
      code: 'CO-20250910-0001',
      title: 'Three-piece (georgette) — custom fit',
      total: 4200,
      status: 'IN_PROGRESS',
      due: 1200,
      createdAt: '2025-09-10T14:30:00Z',
    },
  ],
  'cust-002': [],
  'cust-003': [
    {
      id: 'co-202',
      code: 'CO-20250909-0001',
      title: 'Panjabi (cotton) — embroidered',
      total: 1850,
      status: 'READY',
      due: 0,
      createdAt: '2025-09-09T09:15:00Z',
    },
  ],
  'cust-004': [],
  'cust-005': [
    {
      id: 'co-203',
      code: 'CO-20250907-0001',
      title: 'Two-piece (silk)',
      total: 5800,
      status: 'DELIVERED',
      due: 800,
      createdAt: '2025-09-07T16:45:00Z',
    },
  ],
  'cust-006': [],
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                      */
/* -------------------------------------------------------------------------- */

function decorateCustomer(c, now = new Date()) {
  return {
    ...c,
    currentClass: deriveCurrentClass(c.initialClass, c.createdAt, now),
  };
}

function decorateChild(kid, now = new Date()) {
  return {
    ...kid,
    currentClass: deriveCurrentClass(kid.initialClass, kid.createdAt, now),
  };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                   */
/* -------------------------------------------------------------------------- */

export async function getCustomers(query = '') {
  await delay(140);
  const q = String(query || '').trim().toLowerCase();
  const all = CUSTOMERS.map((c) => decorateCustomer(c));
  if (!q) return all;
  return all.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.address || '').toLowerCase().includes(q),
  );
}

export async function getCustomerById(id) {
  await delay(80);
  const found = CUSTOMERS.find((c) => c.id === id);
  if (!found) return null;
  return decorateCustomer(found);
}

export async function createCustomer(payload = {}, { actor } = {}) {
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
  const id = `cust-${String(CUSTOMERS.length + 1).padStart(3, '0')}`;
  const now = new Date().toISOString();
  const created = {
    id,
    name,
    phone,
    address: String(payload.address || '').trim(),
    initialClass: String(payload.initialClass || '').trim(),
    isActive: true,
    createdBy: actor?.username || 'unknown',
    createdByRole: actor?.role || null,
    updatedBy: actor?.username || 'unknown',
    updatedByRole: actor?.role || null,
    createdAt: now,
    updatedAt: now,
  };
  CUSTOMERS.push(created);
  return decorateCustomer(created);
}

export async function updateCustomer(id, patch = {}, { actor } = {}) {
  await delay(120);
  const idx = CUSTOMERS.findIndex((c) => c.id === id);
  if (idx === -1) {
    const err = new Error(`Customer ${id} not found.`);
    err.code = 'NOT_FOUND';
    throw err;
  }
  const before = CUSTOMERS[idx];
  const next = {
    ...before,
    ...patch,
    id: before.id, // id is immutable
    updatedBy: actor?.username || 'unknown',
    updatedByRole: actor?.role || null,
    updatedAt: new Date().toISOString(),
  };
  CUSTOMERS[idx] = next;
  return decorateCustomer(next);
}

/**
 * Status toggle (no delete, per Phase 6 contract).
 */
export async function setCustomerStatus(id, isActive, { actor } = {}) {
  return updateCustomer(id, { isActive: Boolean(isActive) }, { actor });
}

export async function getCustomerChildren(customerId) {
  await delay(80);
  return CHILDREN.filter((k) => k.customerId === customerId).map((k) =>
    decorateChild(k),
  );
}

export async function addCustomerChild(customerId, payload = {}) {
  await delay(80);
  const name = String(payload.name || '').trim();
  const initialClass = String(payload.initialClass || '').trim();
  if (!name) {
    const err = new Error('Child name is required.');
    err.code = 'EMPTY_NAME';
    throw err;
  }
  const id = `kid-${String(CHILDREN.length + 1).padStart(3, '0')}`;
  const created = {
    id,
    customerId,
    name,
    initialClass,
    createdAt: new Date().toISOString(),
  };
  CHILDREN.push(created);
  return decorateChild(created);
}

export async function getCustomerSalesHistory(customerId) {
  await delay(80);
  return (SALES_BY_CUSTOMER[customerId] || []).slice();
}

export async function getCustomerCustomOrders(customerId) {
  await delay(80);
  return (CUSTOM_ORDERS_BY_CUSTOMER[customerId] || []).slice();
}

export async function getCustomerDueSummary(customerId) {
  await delay(80);
  const sales = SALES_BY_CUSTOMER[customerId] || [];
  const customOrders = CUSTOM_ORDERS_BY_CUSTOMER[customerId] || [];
  const openSales = sales.length; // all sales count as cleared in this mock
  const openCustomOrders = customOrders.filter((co) => co.due > 0);
  const totalDue = openCustomOrders.reduce((sum, co) => sum + co.due, 0);
  return {
    customerId,
    openSales,
    openCustomOrders,
    totalDue,
    currency: 'BDT',
  };
}

/**
 * Bulk tab data — single round-trip helper used by CustomerDetailPage.
 * Returns null for the customer if id is unknown. Throws nothing; on
 * per-tab failure the field is null and a sibling `errors` map records it.
 */
export async function getCustomerBundle(customerId) {
  await delay(180);
  const customer = await getCustomerById(customerId);
  if (!customer) return null;
  const errors = {};
  let profileExtras = {};
  try {
    const [children, sales, customOrders, dueSummary] = await Promise.all([
      getCustomerChildren(customerId),
      getCustomerSalesHistory(customerId),
      getCustomerCustomOrders(customerId),
      getCustomerDueSummary(customerId),
    ]);
    profileExtras = { children, sales, customOrders, dueSummary };
  } catch (err) {
    errors.bundle = err?.message || 'Could not load customer tabs.';
  }
  return { customer, ...profileExtras, errors };
}