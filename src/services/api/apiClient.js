const configuredBase = import.meta.env.VITE_API_BASE_URL;
const apiBase = (configuredBase || `${window.location.protocol}//${window.location.hostname}:4440`).replace(/\/$/, '');
let csrfToken = null;

export function setCsrfToken(value) {
  csrfToken = typeof value === 'string' ? value : null;
}

export function clearCsrfToken() {
  csrfToken = null;
}

export async function apiRequest(path, { method = 'GET', body, allowUnauthorized = false, raw = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && method !== 'HEAD' && csrfToken && path !== '/api/v1/auth/login') {
    headers['X-CSRF-Token'] = csrfToken;
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
  return raw ? result : result?.data;
}
