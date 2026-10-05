import { STORAGE_KEYS } from '../../constants/storage.js';
import { apiRequest, clearCsrfToken, setCsrfToken } from '../api/apiClient.js';

function clearLegacyMockSession() {
  window.localStorage.removeItem(STORAGE_KEYS.SESSION);
  window.sessionStorage.removeItem(STORAGE_KEYS.SESSION);
}

export async function login({ username, password, rememberMe = false }) {
  if (!username?.trim()) {
    const error = new Error('Username is required.');
    error.code = 'EMPTY_USERNAME';
    throw error;
  }
  if (!password) {
    const error = new Error('Password is required.');
    error.code = 'EMPTY_PASSWORD';
    throw error;
  }
  const data = await apiRequest('/api/v1/auth/login', {
    method: 'POST', body: { username: username.trim(), password, rememberMe }, allowUnauthorized: true,
  });
  clearLegacyMockSession();
  setCsrfToken(data.csrfToken);
  return data.user;
}

export async function getCurrentUser() {
  clearLegacyMockSession();
  try {
    const data = await apiRequest('/api/v1/auth/me', { allowUnauthorized: true });
    setCsrfToken(data.csrfToken);
    return data.user;
  } catch (error) {
    clearCsrfToken();
    if (error.status === 401) return null;
    throw error;
  }
}

export async function logout() {
  try {
    await apiRequest('/api/v1/auth/logout', { method: 'POST' });
  } catch (error) {
    if (error.status !== 401) throw error;
  }
  clearCsrfToken();
  clearLegacyMockSession();
}
