import { apiRequest } from '../api/apiClient.js';

function normalizeProduct(raw) {
  return {
    ...raw,
    sku: raw.productCode || '',
    stock: raw.stockQuantity ?? 0,
    price: raw.purchasePrice != null ? Number(raw.purchasePrice) : null,
    purchasePrice: raw.purchasePrice != null ? Number(raw.purchasePrice) : null,
    isActive: raw.status === 'ACTIVE',
    category: '',
    description: raw.notes || '',
    reorderLevel: 0,
    createdBy: raw.createdById || '',
    updatedBy: raw.updatedById || '',
  };
}

function normalizeStockEntry(raw) {
  return {
    id: raw.id || '',
    productId: raw.productId || '',
    delta: raw.quantityChange ?? 0,
    reason: raw.reason || '',
    note: raw.reason || '',
    sourceType: raw.sourceType || '',
    sourceId: raw.sourceId || '',
    createdBy: raw.actorId || '',
    createdAt: raw.at || raw.createdAt || '',
  };
}

export async function getProducts() {
  const result = await apiRequest('/api/v1/products?pageSize=100', { raw: true });
  let rows = result.data;
  if (result.meta.total > rows.length) {
    let page = 2;
    while (rows.length < result.meta.total) {
      const next = await apiRequest(`/api/v1/products?page=${page}&pageSize=100`, { raw: true });
      rows = rows.concat(next.data);
      if (next.data.length === 0) break;
      page += 1;
    }
  }
  return rows.map(normalizeProduct);
}

export async function getProductById(id) {
  try {
    const raw = await apiRequest(`/api/v1/products/${encodeURIComponent(id)}`);
    if (!raw) return null;
    return normalizeProduct(raw);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export async function searchProducts(query = '') {
  const q = String(query || '').trim();
  const params = q ? `?search=${encodeURIComponent(q)}&pageSize=100` : '?pageSize=100';
  const result = await apiRequest(`/api/v1/products${params}`, { raw: true });
  return result.data.map(normalizeProduct);
}

export async function createProduct(payload = {}, _options = {}) {
  const body = {
    name: String(payload.name || '').trim(),
  };
  if (payload.purchasePrice != null && payload.purchasePrice !== '') {
    body.purchasePrice = Number(payload.purchasePrice);
  }
  if (payload.stock != null && Number(payload.stock) > 0) {
    body.openingStock = Number(payload.stock);
  }
  if (payload.description) {
    body.notes = String(payload.description).trim();
  }
  if (payload.isActive === false) {
    body.status = 'INACTIVE';
  }

  const raw = await apiRequest('/api/v1/products', { method: 'POST', body });
  return normalizeProduct(raw);
}

export async function updateProduct(id, patch = {}, _options = {}) {
  const body = {};
  if (patch.name !== undefined) body.name = String(patch.name).trim();
  if (patch.purchasePrice !== undefined) {
    body.purchasePrice = patch.purchasePrice === null || patch.purchasePrice === ''
      ? null
      : Number(patch.purchasePrice);
  }
  if (patch.description !== undefined) {
    body.notes = String(patch.description || '').trim();
  }
  if (patch.isActive !== undefined) {
    body.status = patch.isActive ? 'ACTIVE' : 'INACTIVE';
  }

  const raw = await apiRequest(`/api/v1/products/${encodeURIComponent(id)}`, {
    method: 'PATCH', body,
  });
  return normalizeProduct(raw);
}

export async function adjustStock(productId, adjustment = {}, _options = {}) {
  const body = {
    quantityChange: Number(adjustment.delta),
    reason: String(adjustment.reason || '').trim(),
  };

  const raw = await apiRequest(`/api/v1/products/${encodeURIComponent(productId)}/adjustments`, {
    method: 'POST', body,
  });

  const product = await getProductById(productId);
  return { product, entry: normalizeStockEntry(raw) };
}

export async function getStockHistory(productId) {
  const rows = await apiRequest(`/api/v1/products/${encodeURIComponent(productId)}/stock-history`);
  return (rows || []).map(normalizeStockEntry);
}

export function _getLedger() {
  return [];
}

export async function _getSaleProducts(query = '') {
  const q = String(query || '').trim();
  const params = q ? `?search=${encodeURIComponent(q)}` : '';
  const rows = await apiRequest(`/api/v1/catalog/products${params}`);
  return (rows || []).map((p) => ({
    id: p.id,
    name: p.name,
    stock: p.stockQuantity ?? 0,
    sku: p.productCode || '',
  }));
}

export function _prepareSaleLines() {
  return [];
}

export function _commitSaleStock() {}
