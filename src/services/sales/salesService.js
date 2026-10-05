import { apiRequest } from '../api/apiClient.js';
import { createCustomer as createSharedCustomer, getCustomers, getCustomerById } from '../customers/customerService.js';
import { _getSaleProducts, getProductById as getProductFromCatalogue } from '../products/productService.js';

let cachedCustomerMap = null;
let lastCustomerFetchTime = 0;

async function getCustomerMap() {
  const now = Date.now();
  if (!cachedCustomerMap || now - lastCustomerFetchTime > 30000) {
    try {
      const customers = await getCustomers();
      cachedCustomerMap = new Map(customers.map((c) => [c.id, c.name]));
      lastCustomerFetchTime = now;
    } catch {
      if (!cachedCustomerMap) cachedCustomerMap = new Map();
    }
  }
  return cachedCustomerMap;
}

function normalizeSaleItem(item) {
  const quantity = item.quantity ?? item.qty ?? 0;
  const sellingPrice = item.sellingPrice != null ? Number(item.sellingPrice) : (item.price != null ? Number(item.price) : 0);
  const lineTotal = item.lineTotal != null ? Number(item.lineTotal) : quantity * sellingPrice;
  const purchaseCostAtSale = item.purchaseCostAtSale != null ? Number(item.purchaseCostAtSale) : null;

  return {
    id: item.id || '',
    productId: item.productId,
    productName: item.productNameAtSale || item.productName || '',
    productNameAtSale: item.productNameAtSale || item.productName || '',
    sku: item.sku || '',
    qty: quantity,
    quantity,
    price: sellingPrice,
    sellingPrice,
    lineTotal,
    purchaseCostAtSale,
  };
}

function normalizeSale(raw, customerMap = new Map()) {
  const totalAmount = raw.totalAmount != null ? Number(raw.totalAmount) : (raw.total != null ? Number(raw.total) : 0);
  const saleDate = raw.saleDate || raw.createdAt || new Date().toISOString();
  const customerName = raw.customerName || (raw.customerId ? customerMap.get(raw.customerId) : '') || '';

  return {
    ...raw,
    total: totalAmount,
    totalAmount,
    createdAt: saleDate,
    saleDate,
    customerName,
    createdBy: raw.createdById || raw.createdBy || '',
    cashInId: raw.cashInId || null,
    items: (raw.items || []).map(normalizeSaleItem),
  };
}

export function generateSalesCode(_date = new Date()) {
  return '';
}

export async function searchCustomers(query = '') {
  const customers = await getCustomers(query);
  return customers.filter((customer) => customer.isActive);
}

export async function createCustomer(payload = {}, options = {}) {
  const created = await createSharedCustomer(payload, options);
  if (cachedCustomerMap && created?.id) {
    cachedCustomerMap.set(created.id, created.name);
  }
  return created;
}

export async function searchProducts(query = '') {
  return _getSaleProducts(query);
}

export async function getProductById(productId) {
  return getProductFromCatalogue(productId);
}

export async function getSales(_options = {}) {
  const customerMap = await getCustomerMap();
  const result = await apiRequest('/api/v1/sales?pageSize=100', { raw: true });
  let rows = result.data;
  if (result.meta && result.meta.total > rows.length) {
    let page = 2;
    while (rows.length < result.meta.total) {
      const next = await apiRequest(`/api/v1/sales?page=${page}&pageSize=100`, { raw: true });
      rows = rows.concat(next.data);
      if (next.data.length === 0) break;
      page += 1;
    }
  }
  return rows.map((sale) => normalizeSale(sale, customerMap));
}

export async function getSaleById(id, _options = {}) {
  try {
    const raw = await apiRequest(`/api/v1/sales/${encodeURIComponent(id)}`);
    if (!raw) return null;
    let customerName = '';
    if (raw.customerId) {
      try {
        const cust = await getCustomerById(raw.customerId);
        if (cust) customerName = cust.name;
      } catch {
        // fallback
      }
    }
    const customerMap = new Map();
    if (raw.customerId && customerName) customerMap.set(raw.customerId, customerName);
    return normalizeSale({ ...raw, customerName }, customerMap);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export async function searchSalesByCode(code = '', _options = {}) {
  const q = String(code || '').trim();
  if (!q) return [];
  const customerMap = await getCustomerMap();
  const result = await apiRequest(`/api/v1/sales?search=${encodeURIComponent(q)}&pageSize=100`, { raw: true });
  return (result.data || []).map((sale) => normalizeSale(sale, customerMap));
}

export async function completeSale(payload, _options = {}) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const customer = payload?.customer || null;
  const customerId = customer?.id || payload?.customerId;

  if (!customerId) {
    const err = new Error('Select or create a customer before completing the sale.');
    err.code = 'CUSTOMER_REQUIRED';
    throw err;
  }

  if (items.length === 0) {
    const err = new Error('Add at least one item before completing the sale.');
    err.code = 'EMPTY_CART';
    throw err;
  }

  const apiItems = items.map((item) => ({
    productId: item.productId,
    quantity: parseInt(String(item.qty ?? item.quantity ?? 1), 10),
    sellingPrice: String(item.price ?? item.sellingPrice ?? '0'),
  }));

  const body = {
    customerId,
    items: apiItems,
    ...(payload.notes ? { notes: String(payload.notes).trim() } : {}),
  };

  const raw = await apiRequest('/api/v1/sales', {
    method: 'POST',
    body,
    idempotencyKey: payload?.idempotencyKey,
  });

  const customerMap = new Map();
  if (customer?.name) {
    customerMap.set(customerId, customer.name);
  }
  const sale = normalizeSale(raw, customerMap);

  return {
    sale,
    cashIn: null,
  };
}

export function _getRecentCashIn() {
  return [];
}
