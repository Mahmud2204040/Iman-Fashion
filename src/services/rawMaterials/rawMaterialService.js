import { apiRequest } from '../api/apiClient.js';
import { ROLES } from '../../constants/roles.js';

const OWNER_ROLE = [ROLES.OWNER];

function requireOwner({ actor } = {}) {
  if (!actor || !OWNER_ROLE.includes(actor.role)) {
    const err = new Error('Only an owner can manage raw materials.');
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }
}

function normalizeRawMaterial(raw) {
  return {
    ...raw,
    quantity: Number(raw.quantity),
    purchaseCost: raw.purchaseCost !== null ? Number(raw.purchaseCost) : null,
    date: raw.date ? raw.date.slice(0, 10) : '',
    createdBy: raw.createdById || '',
    createdByRole: ROLES.OWNER,
  };
}

export async function getRawMaterials() {
  const result = await apiRequest('/api/v1/raw-materials?pageSize=100', { raw: true });
  let rows = result.data || [];
  if (result.meta && result.meta.total > rows.length) {
    let page = 2;
    while (rows.length < result.meta.total) {
      const next = await apiRequest(`/api/v1/raw-materials?page=${page}&pageSize=100`, { raw: true });
      rows = rows.concat(next.data || []);
      if (!next.data || next.data.length === 0) break;
      page += 1;
    }
  }
  return rows.map(normalizeRawMaterial);
}

export async function createRawMaterial(payload = {}, { actor } = {}) {
  requireOwner({ actor });

  const body = {
    itemName: String(payload.itemName || '').trim(),
    quantity: String(payload.quantity),
    date: payload.date ? payload.date.slice(0, 10) : '',
  };

  if (payload.description) {
    body.description = String(payload.description).trim();
  }

  if (payload.purchaseCost !== undefined && payload.purchaseCost !== null && payload.purchaseCost !== '') {
    body.purchaseCost = String(payload.purchaseCost);
  }

  const raw = await apiRequest('/api/v1/raw-materials', {
    method: 'POST',
    body,
    idempotencyKey: payload.idempotencyKey,
  });

  return normalizeRawMaterial(raw);
}

export async function updateRawMaterial(id, patch = {}, { actor } = {}) {
  requireOwner({ actor });

  const body = {};

  if (patch.itemName !== undefined) {
    body.itemName = String(patch.itemName || '').trim();
  }
  if (patch.quantity !== undefined) {
    body.quantity = String(patch.quantity);
  }
  if (patch.date !== undefined) {
    body.date = patch.date ? patch.date.slice(0, 10) : '';
  }
  if (patch.description !== undefined) {
    body.description = String(patch.description || '').trim();
  }
  if (patch.purchaseCost !== undefined) {
    body.purchaseCost = patch.purchaseCost !== null && patch.purchaseCost !== '' ? String(patch.purchaseCost) : null;
  }

  const raw = await apiRequest(`/api/v1/raw-materials/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
  });

  return normalizeRawMaterial(raw);
}
