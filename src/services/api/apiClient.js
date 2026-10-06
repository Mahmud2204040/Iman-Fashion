import { getL2Cache, setL2Cache } from '../../cache/l2Cache.js';

const configuredBase = import.meta.env.VITE_API_BASE_URL;
const apiBase = (configuredBase || `${window.location.protocol}//${window.location.hostname}:4440`).replace(/\/$/, '');
let csrfToken = null;

export function setCsrfToken(value) {
  csrfToken = typeof value === 'string' ? value : null;
}

export function clearCsrfToken() {
  csrfToken = null;
}

function generateKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function apiRequest(path, {
  method = 'GET',
  body,
  allowUnauthorized = false,
  raw = false,
  headers: customHeaders = {},
  idempotencyKey,
  cacheMode = 'default',
  onCacheMeta,
} = {}) {
  const headers = { ...customHeaders };
  if (body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (method !== 'GET' && method !== 'HEAD' && csrfToken && path !== '/api/v1/auth/login') {
    headers['X-CSRF-Token'] = csrfToken;
  }
  if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
    const key = idempotencyKey || headers['Idempotency-Key'] || generateKey();
    headers['Idempotency-Key'] = key;
  }
  
  if (cacheMode === 'bypass') {
    headers['X-Cache-Bypass'] = '1';
  }

  // Check L2 cache for eligible GET requests
  const isCacheableGet = method === 'GET' && cacheMode === 'default' && !path.startsWith('/api/v1/auth/');
  const cacheKey = isCacheableGet ? `${apiBase}${path}` : null;

  if (isCacheableGet && !navigator.onLine) {
    const cachedRecord = await getL2Cache(cacheKey);
    if (cachedRecord) {
      if (onCacheMeta) onCacheMeta({ source: 'L2', offline: true, fetchedAt: cachedRecord.timestamp });
      return raw ? cachedRecord.data : cachedRecord.data?.data;
    }
  }

  if (!navigator.onLine && method !== 'GET' && method !== 'HEAD') {
    const error = new Error('You are offline. Changes cannot be saved.');
    error.code = 'OFFLINE_READ_ONLY';
    throw error;
  }

  let response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      method,
      headers,
      credentials: 'include',
      cache: 'no-store',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    const error = new Error('Cannot connect to the API. Start the backend and try again.');
    error.code = 'API_UNAVAILABLE';
    throw error;
  }

  let result;
  try { result = await response.json(); }
  catch { result = null; }
  
  if (!response.ok) {
    const error = new Error(result?.error?.message || 'Request failed. Please try again.');
    error.code = result?.error?.code || `HTTP_${response.status}`;
    error.status = response.status;
    if (response.status === 401 && !allowUnauthorized) {
      clearCsrfToken();
      window.dispatchEvent(new Event('ni-fashion:session-expired'));
    }
    throw error;
  }

  // Write successful GETs to L2 Cache
  if (isCacheableGet && result) {
    setL2Cache(cacheKey, result);
  }

  if (onCacheMeta) onCacheMeta({ source: 'network', fetchedAt: Date.now() });

  return raw ? result : result?.data;
}
