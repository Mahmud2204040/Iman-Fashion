/**
 * customerService — Phase 6 mock.
 *
 * Owns the customer catalogue and per-customer tab data. Implements
 * the Phase 6 contract from FRONTEND_PLAN.md and aligns to the
 * DATABASE_PLAN.md schema (§8 customers, §9 children):
 *
 *   - Profile: customer_code (CUS-000001), name, phone, address,
 *     notes, status (active/inactive), audit timestamps
 *   - Sales History (recent sales for this customer)
 *   - Custom Orders (recent custom orders for this customer)
 *   - Due Summary (running balance / open dues)
 *   - Children (school uniform programme): name, initial class,
 *     school_name, registered_date, with derived
 *     current class from initial_class + years_since(registered_date)
 *   - No delete — status toggle (isActive)
 *
 * Note: "class" is a child-level concept (school uniform programme),
 * NOT a customer-level field. Customers do not have a class.
 *
 * The due summary uses a flat "paid vs due" model: each sale / custom
 * order contributes an entry. The frontend doesn't model payment
 * recording here (that lives in Phase 7 / 10). For now, due_summary
 * surfaces the open items so the UI can render a clear picture.
 *
 * Real backend will replace this file entirely.
 */
import { ROLES } from '../../constants/roles.js';
import { deriveCurrentClass, shopDate } from '../../utils/customer.js';
import { delay } from '../delay.js';

/* -------------------------------------------------------------------------- */
/* Customer-code helpers                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Format a numeric sequence as a customer code, e.g. 1 -> "CUS-000001".
 * The DATABASE_PLAN.md contract is CUS-NNNNNN (6-digit zero-padded).
 */
function formatCustomerCode(n) {
  return `CUS-${String(n).padStart(6, '0')}`;
}

/**
 * Compute the next customer code by scanning existing customers and
 * picking max(numeric suffix) + 1. Falls back to 1 for an empty list.
 */
function nextCustomerCode() {
  let max = 0;
  for (const c of CUSTOMERS) {
    const m = String(c.customerCode || '').match(/^CUS-(\d+)$/);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return formatCustomerCode(max + 1);
}

/**
 * Read-only preview of the next customer code (e.g. for the create form).
 * Safe to call repeatedly — does NOT consume a slot.
 */
export function peekNextCustomerCode() {
  return nextCustomerCode();
}

/* -------------------------------------------------------------------------- */
/* Mock catalogues                                                              */
/* -------------------------------------------------------------------------- */

const CUSTOMERS = [
  {
    id: 'cust-001',
    customerCode: 'CUS-000001',
    name: 'Anika Tabassum',
    phone: '01711-200104',
    address: 'House 12, Road 7, Banani, Dhaka',
    notes: 'Prefers Banani branch pickup. Mother of two school kids. Sara needs a long-sleeve white shirt.',
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
    customerCode: 'CUS-000002',
    name: 'Tahmid Hossain',
    phone: '01815-771234',
    address: 'Flat 3B, Lalmatia, Dhaka',
    notes: 'Tasnim prefers cotton blend; sensitive to polyester.',
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
    customerCode: 'CUS-000003',
    name: 'Mst. Rafa',
    phone: '01933-445566',
    address: 'Sector 7, Uttara, Dhaka',
    notes: 'Allergic to certain dyes — confirm before dye jobs.',
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
    customerCode: 'CUS-000004',
    name: 'Sabbir Ahmed',
    phone: '01678-901234',
    address: 'Mirpur 10, Dhaka',
    notes: 'Buys in bulk before Eid. Offer 5% discount on 3+ items.',
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
    customerCode: 'CUS-000005',
    name: 'Nusrat Jahan',
    phone: '01755-321098',
    address: 'Gulshan 2, Dhaka',
    notes: 'Account paused at her request — pending address change.',
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
    customerCode: 'CUS-000006',
    name: 'Riyad Karim',
    phone: '01515-909090',
    address: 'Dhanmondi 15, Dhaka',
    notes: '',
    isActive: true,
    createdBy: 'employee',
    createdByRole: ROLES.EMPLOYEE,
    updatedBy: 'employee',
    updatedByRole: ROLES.EMPLOYEE,
    createdAt: '2025-04-05T08:30:00Z',
    updatedAt: '2025-09-04T12:00:00Z',
  },
];

/* Children of each customer (school uniform programme example).
 * Schema per DATABASE_PLAN.md §9:
 *   id, customer_id, name, initial_class, school_name, registered_date.
 * The derived `currentClass` is computed at read time. */
const CHILDREN = [
  {
    id: 'kid-001',
    customerId: 'cust-001',
    name: 'Sara Tabassum',
    initialClass: '3',
    schoolName: 'Dhaka International School',
    registeredDate: '2024-06-12',
    createdBy: 'owner', createdByRole: ROLES.OWNER,
    updatedBy: 'owner', updatedByRole: ROLES.OWNER,
    createdAt: '2024-06-12T09:05:00Z',
    updatedAt: '2024-06-12T09:05:00Z',
  },
  {
    id: 'kid-002',
    customerId: 'cust-001',
    name: 'Adnan Tabassum',
    initialClass: '1',
    schoolName: 'Dhaka International School',
    registeredDate: '2025-01-10',
    createdBy: 'owner', createdByRole: ROLES.OWNER,
    updatedBy: 'owner', updatedByRole: ROLES.OWNER,
    createdAt: '2025-01-10T09:05:00Z',
    updatedAt: '2025-01-10T09:05:00Z',
  },
  {
    id: 'kid-003',
    customerId: 'cust-002',
    name: 'Tasnim Hossain',
    initialClass: '5',
    schoolName: 'Lalmatia Girls School',
    registeredDate: '2024-09-04',
    createdBy: 'owner', createdByRole: ROLES.OWNER,
    updatedBy: 'owner', updatedByRole: ROLES.OWNER,
    createdAt: '2024-09-04T10:35:00Z',
    updatedAt: '2024-09-04T10:35:00Z',
  },
  {
    id: 'kid-004',
    customerId: 'cust-003',
    name: 'Aariz Rafa',
    initialClass: '2',
    schoolName: 'Uttara Model School',
    registeredDate: '2025-01-22',
    createdBy: 'employee', createdByRole: ROLES.EMPLOYEE,
    updatedBy: 'employee', updatedByRole: ROLES.EMPLOYEE,
    createdAt: '2025-01-22T14:20:00Z',
    updatedAt: '2025-01-22T14:20:00Z',
  },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                      */
/* -------------------------------------------------------------------------- */

function decorateCustomer(c) {
  // Customers themselves do not have a class — class is a child-level
  // concept (school uniform programme). Return the row untouched.
  return { ...c };
}

function decorateChild(kid, now = new Date()) {
  // The "current class" of a child is derived from initial_class plus
  // the completed calendar years elapsed since registered_date only.
  return {
    ...kid,
    currentClass: deriveCurrentClass(kid.initialClass, kid.registeredDate, now),
  };
}

function validateChild(payload, index) {
  const name = String(payload?.name || '').trim();
  const initialClass = String(payload?.initialClass || '').trim();
  const schoolName = String(payload?.schoolName || '').trim();
  const registeredDate = String(payload?.registeredDate || '').trim() || shopDate();
  if (!name) {
    const error = new Error(`Child #${index}: name is required. Fill the row or remove it.`);
    error.code = 'CHILD_EMPTY_NAME';
    throw error;
  }
  if (!initialClass || !schoolName) {
    const error = new Error(`Child #${index}: initial class and school are required.`);
    error.code = 'CHILD_REQUIRED_FIELDS';
    throw error;
  }
  const parsed = new Date(`${registeredDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(registeredDate) ||
      Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== registeredDate) {
    const error = new Error(`Child #${index}: registered date is invalid.`);
    error.code = 'CHILD_INVALID_DATE';
    throw error;
  }
  return { name, initialClass, schoolName, registeredDate };
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
      c.customerCode.toLowerCase().includes(q) ||
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
  if (!phone) {
    const err = new Error('Customer phone is required.');
    err.code = 'EMPTY_PHONE';
    throw err;
  }

  // Optional inline children (Phase 4b atomic create-with-children).
  // Validate every child up-front so we never persist a partial batch:
  // if any child is invalid, the whole customer creation is rejected.
  const rawChildren = Array.isArray(payload.children) ? payload.children : [];
  const validatedChildren = rawChildren.map((child, index) => validateChild(child, index + 1));

  const id = `cust-${String(CUSTOMERS.length + 1).padStart(3, '0')}`;
  const customerCode = nextCustomerCode();
  const now = new Date().toISOString();
  const created = {
    id,
    customerCode,
    name,
    phone,
    address: String(payload.address || '').trim(),
    notes: String(payload.notes || '').trim(),
    isActive: true,
    createdBy: actor?.username || 'unknown',
    createdByRole: actor?.role || null,
    updatedBy: actor?.username || 'unknown',
    updatedByRole: actor?.role || null,
    createdAt: now,
    updatedAt: now,
  };
  CUSTOMERS.push(created);

  // Persist the inline children now that the parent id exists. The
  // CHILDREN.push happens inside this single delay() call so the entire
  // create is atomic from the consumer's point of view.
  for (const k of validatedChildren) {
    const kidId = `kid-${String(CHILDREN.length + 1).padStart(3, '0')}`;
    CHILDREN.push({
      id: kidId,
      customerId: id,
      name: k.name,
      initialClass: k.initialClass,
      schoolName: k.schoolName,
      registeredDate: k.registeredDate,
      createdBy: actor?.username || 'unknown',
      createdByRole: actor?.role || null,
      updatedBy: actor?.username || 'unknown',
      updatedByRole: actor?.role || null,
      createdAt: now,
      updatedAt: now,
    });
  }

  return decorateCustomer(created);
}

export async function updateCustomer(id, patch = {}, { actor } = {}) {
  await delay(120);
  if (actor?.role !== ROLES.OWNER && actor?.role !== ROLES.EMPLOYEE) {
    const err = new Error('Customer access required.'); err.code = 'FORBIDDEN_ROLE'; throw err;
  }
  if (patch.isActive !== undefined && actor.role !== ROLES.OWNER) {
    const err = new Error('Only an owner can change customer status.'); err.code = 'FORBIDDEN_ROLE'; throw err;
  }
  const idx = CUSTOMERS.findIndex((c) => c.id === id);
  if (idx === -1) {
    const err = new Error(`Customer ${id} not found.`);
    err.code = 'NOT_FOUND';
    throw err;
  }
  const before = CUSTOMERS[idx];
  const next = {
    ...before,
    name: patch.name === undefined ? before.name : String(patch.name || '').trim(),
    phone: patch.phone === undefined ? before.phone : String(patch.phone || '').trim(),
    address: patch.address === undefined ? before.address : String(patch.address || '').trim(),
    notes: patch.notes === undefined ? before.notes : String(patch.notes || '').trim(),
    isActive: patch.isActive === undefined ? before.isActive : Boolean(patch.isActive),
    id: before.id, // id is immutable
    updatedBy: actor?.username || 'unknown',
    updatedByRole: actor?.role || null,
    updatedAt: new Date().toISOString(),
  };
  if (!next.name || !next.phone) {
    const err = new Error('Customer name and phone are required.'); err.code = 'INVALID_CUSTOMER'; throw err;
  }
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

export async function addCustomerChild(customerId, payload = {}, { actor } = {}) {
  await delay(80);
  if (!CUSTOMERS.some((customer) => customer.id === customerId)) {
    const err = new Error(`Customer ${customerId} not found.`);
    err.code = 'NOT_FOUND';
    throw err;
  }
  const child = validateChild(payload, 1);
  const id = `kid-${String(CHILDREN.length + 1).padStart(3, '0')}`;
  const now = new Date().toISOString();
  const created = {
    id,
    customerId,
    ...child,
    createdBy: actor?.username || 'unknown',
    createdByRole: actor?.role || null,
    updatedBy: actor?.username || 'unknown',
    updatedByRole: actor?.role || null,
    createdAt: now,
    updatedAt: now,
  };
  CHILDREN.push(created);
  return decorateChild(created);
}

export async function updateCustomerChild(customerId, childId, patch = {}, { actor } = {}) {
  await delay(80);
  if (actor?.role !== ROLES.OWNER && actor?.role !== ROLES.EMPLOYEE) {
    const err = new Error('Customer access required.'); err.code = 'FORBIDDEN_ROLE'; throw err;
  }
  const index = CHILDREN.findIndex((child) => child.id === childId && child.customerId === customerId);
  if (index < 0) {
    const err = new Error('Child not found.'); err.code = 'NOT_FOUND'; throw err;
  }
  const validated = validateChild({ ...CHILDREN[index], ...patch }, 1);
  CHILDREN[index] = { ...CHILDREN[index], ...validated, updatedBy: actor.username, updatedByRole: actor.role, updatedAt: new Date().toISOString() };
  return decorateChild(CHILDREN[index]);
}

export async function getCustomerSalesHistory(customerId) {
  const { getSales } = await import('../sales/salesService.js');
  return (await getSales())
    .filter((sale) => sale.customerId === customerId)
    .map((sale) => ({
      id: sale.id,
      salesCode: sale.salesCode,
      total: sale.total,
      createdAt: sale.createdAt,
      itemCount: sale.items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
    }));
}

export async function getCustomerCustomOrders(customerId) {
  const { getCustomOrders } = await import('../customOrders/customOrderService.js');
  return (await getCustomOrders())
    .filter((order) => order.customerId === customerId)
    .map((order) => {
      const paid = (order.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      return {
        id: order.id, code: order.code, title: order.productName,
        total: order.total, status: order.status,
        due: order.status === 'CANCELLED' ? 0 : Math.max(0, Number(order.total || 0) - paid),
        cancelledUnpaid: order.status === 'CANCELLED' ? Math.max(0, Number(order.total || 0) - paid) : 0,
        createdAt: order.createdAt,
      };
    });
}

export async function getCustomerDueSummary(customerId) {
  const customOrders = await getCustomerCustomOrders(customerId);
  const openCustomOrders = customOrders.filter((co) => co.status !== 'CANCELLED' && co.due > 0);
  const totalDue = openCustomOrders.reduce((sum, co) => sum + co.due, 0);
  return {
    customerId,
    openSales: 0,
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
