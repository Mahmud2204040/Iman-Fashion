import { apiRequest } from '../api/apiClient.js';
import { deriveCurrentClass } from '../../utils/customer.js';

function normalizeCustomer(raw) {
  return {
    ...raw,
    isActive: raw.status === 'ACTIVE',
    address: raw.address ?? '',
    notes: raw.notes ?? '',
    createdBy: raw.createdById ?? '',
    updatedBy: raw.updatedById ?? '',
  };
}

function normalizeChild(raw) {
  const initialClass = String(raw.initialClass ?? '');
  const registeredDate = typeof raw.registeredDate === 'string'
    ? raw.registeredDate.slice(0, 10)
    : '';
  return {
    ...raw,
    initialClass,
    registeredDate,
    currentClass: deriveCurrentClass(initialClass, registeredDate),
  };
}

export async function peekNextCustomerCode() {
  return '';
}

export async function getCustomers({ page = 1, pageSize = 10, search = '' } = {}) {
  const params = new URLSearchParams();
  if (page) params.set('page', page);
  if (pageSize) params.set('pageSize', pageSize);
  if (search) params.set('search', search);

  const result = await apiRequest(`/api/v1/customers?${params.toString()}`, { raw: true });
  return {
    data: (result.data || []).map(normalizeCustomer),
    meta: result.meta || { page, pageSize, total: 0 }
  };
}

export async function getCustomerById(id) {
  try {
    const raw = await apiRequest(`/api/v1/customers/${encodeURIComponent(id)}`);
    if (!raw) return null;
    return normalizeCustomer(raw);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export async function createCustomer(payload = {}, _options = {}) {
  const children = Array.isArray(payload.children)
    ? payload.children.map((c) => ({
        name: String(c.name || '').trim(),
        initialClass: parseInt(String(c.initialClass || '0').replace(/\D/g, ''), 10) || 1,
        schoolName: String(c.schoolName || '').trim(),
        registeredDate: String(c.registeredDate || '').slice(0, 10),
      }))
    : undefined;

  const body = {
    name: String(payload.name || '').trim(),
    phone: String(payload.phone || '').trim(),
    ...(payload.address ? { address: String(payload.address).trim() } : {}),
    ...(payload.notes ? { notes: String(payload.notes).trim() } : {}),
    ...(children && children.length > 0 ? { children } : {}),
  };

  const raw = await apiRequest('/api/v1/customers', { method: 'POST', body });
  return normalizeCustomer(raw);
}

export async function updateCustomer(id, patch = {}, _options = {}) {
  const body = {};
  if (patch.name !== undefined) body.name = String(patch.name).trim();
  if (patch.phone !== undefined) body.phone = String(patch.phone).trim();
  if (patch.address !== undefined) body.address = String(patch.address).trim();
  if (patch.notes !== undefined) body.notes = String(patch.notes).trim();

  const raw = await apiRequest(`/api/v1/customers/${encodeURIComponent(id)}`, {
    method: 'PATCH', body,
  });
  return normalizeCustomer(raw);
}

export async function setCustomerStatus(id, isActive, _options = {}) {
  const raw = await apiRequest(`/api/v1/customers/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: { status: isActive ? 'ACTIVE' : 'INACTIVE' },
  });
  return normalizeCustomer(raw);
}

export async function getCustomerChildren(customerId) {
  const raw = await apiRequest(`/api/v1/customers/${encodeURIComponent(customerId)}`);
  return (raw.children || []).map(normalizeChild);
}

export async function addCustomerChild(customerId, payload = {}, _options = {}) {
  const body = {
    name: String(payload.name || '').trim(),
    initialClass: parseInt(String(payload.initialClass || '0').replace(/\D/g, ''), 10) || 1,
    schoolName: String(payload.schoolName || '').trim(),
    registeredDate: String(payload.registeredDate || '').slice(0, 10),
  };
  const raw = await apiRequest(`/api/v1/customers/${encodeURIComponent(customerId)}/children`, {
    method: 'POST', body,
  });
  return normalizeChild(raw);
}

export async function updateCustomerChild(_customerId, childId, patch = {}, _options = {}) {
  const body = {};
  if (patch.name !== undefined) body.name = String(patch.name).trim();
  if (patch.schoolName !== undefined) body.schoolName = String(patch.schoolName).trim();
  if (patch.initialClass !== undefined) {
    body.initialClass = parseInt(String(patch.initialClass).replace(/\D/g, ''), 10) || 1;
  }
  if (patch.registeredDate !== undefined) {
    body.registeredDate = String(patch.registeredDate).slice(0, 10);
  }

  const raw = await apiRequest(`/api/v1/children/${encodeURIComponent(childId)}`, {
    method: 'PATCH', body,
  });
  return normalizeChild(raw);
}

export async function getCustomerSalesHistory(customerId) {
  const rows = await apiRequest(`/api/v1/customers/${encodeURIComponent(customerId)}/sales`);
  return (rows || []).map((sale) => ({
    id: sale.id,
    salesCode: sale.salesCode,
    total: sale.total,
    createdAt: sale.createdAt,
    itemCount: Array.isArray(sale.items)
      ? sale.items.reduce((sum, item) => sum + Number(item.qty || 0), 0)
      : 0,
  }));
}

export async function getCustomerCustomOrders(customerId) {
  try {
    const { getCustomOrders } = await import('../customOrders/customOrderService.js');
    return (await getCustomOrders())
      .filter((order) => order.customerId === customerId)
      .map((order) => {
        const paid = (order.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
        return {
          id: order.id, code: order.code, title: order.productName,
          total: order.total, status: order.status,
          due: order.status === 'CANCELLED' ? 0 : Math.max(0, Number(order.total || 0) - paid),
          cancelledUnpaid: order.status === 'CANCELLED' ? Math.max(0, Number(order.total || 0) - paid) : 0,
          createdAt: order.createdAt,
        };
      });
  } catch {
    return [];
  }
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

export async function getCustomerBundle(customerId) {
  let raw;
  try {
    raw = await apiRequest(`/api/v1/customers/${encodeURIComponent(customerId)}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
  if (!raw) return null;
  const customer = normalizeCustomer(raw);
  const children = (raw.children || []).map(normalizeChild);
  const errors = {};
  let sales = [];
  let customOrders = [];
  let dueSummary = { customerId, openSales: 0, openCustomOrders: [], totalDue: 0, currency: 'BDT' };
  try {
    [sales, customOrders, dueSummary] = await Promise.all([
      getCustomerSalesHistory(customerId),
      getCustomerCustomOrders(customerId),
      getCustomerDueSummary(customerId),
    ]);
  } catch (err) {
    errors.bundle = err?.message || 'Could not load customer tabs.';
  }
  return { customer, children, sales, customOrders, dueSummary, errors };
}
