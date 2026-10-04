/**
 * authService — Phase 3, frontend-only mock.
 *
 * Responsibilities:
 *   - Validate built-in demo credentials or locally configured demo passwords.
 *   - Simulate async behavior with `delay`.
 *   - Persist / restore / clear the session blob in either localStorage
 *     (remember-me ON) or sessionStorage (remember-me OFF).
 *
 * The service NEVER exposes the password to callers. It returns a public
 * mock user shape `{ username, role, isMock }`.
 *
 * Locally configured demo passwords are verified by userService. This is
 * not a substitute for server-side authentication or authorization.
 */

import { ROLES } from '../../constants/roles.js';
import { STORAGE_KEYS, STORAGE_KIND } from '../../constants/storage.js';
import { findAccount, verifyAccountPassword } from '../users/userService.js';
import { delay } from '../delay.js';

/* -------------------------------------------------------------------------- */
/* Storage abstraction                                                         */
/* -------------------------------------------------------------------------- */

function pickStorage(kind) {
  if (kind === STORAGE_KIND.LOCAL) return window.localStorage;
  if (kind === STORAGE_KIND.SESSION) return window.sessionStorage;
  // Defensive default — should never happen because the UI always picks.
  return window.sessionStorage;
}

function readSession() {
  const raw =
    window.localStorage.getItem(STORAGE_KEYS.SESSION) ??
    window.sessionStorage.getItem(STORAGE_KEYS.SESSION);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Lightweight shape guard — never trust raw JSON from storage.
    if (
      parsed &&
      typeof parsed.username === 'string' &&
      (parsed.role === ROLES.OWNER || parsed.role === ROLES.EMPLOYEE) &&
      parsed.isMock === true
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeSession(user, kind) {
  // Clear both first so a previous "remember-me" choice never lingers.
  window.localStorage.removeItem(STORAGE_KEYS.SESSION);
  window.sessionStorage.removeItem(STORAGE_KEYS.SESSION);

  const target = pickStorage(kind);
  target.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
}

function clearSession() {
  window.localStorage.removeItem(STORAGE_KEYS.SESSION);
  window.sessionStorage.removeItem(STORAGE_KEYS.SESSION);
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Authenticate against the current local demo accounts.
 *
 * @param {{ username: string, password: string, rememberMe?: boolean }} credentials
 * @returns {Promise<{ username: string, role: 'OWNER'|'EMPLOYEE', isMock: true }>}
 * @throws {{ code: 'EMPTY_USERNAME' | 'EMPTY_PASSWORD' | 'INVALID_CREDENTIALS', message: string }}
 */
export async function login({ username, password, rememberMe = false }) {
  await delay();

  const u = (username ?? '').trim();
  const p = password ?? '';

  if (!u) {
    const err = new Error('Username is required.');
    err.code = 'EMPTY_USERNAME';
    throw err;
  }
  if (!p) {
    const err = new Error('Password is required.');
    err.code = 'EMPTY_PASSWORD';
    throw err;
  }

  const match = findAccount(u);
  // Deliberately do NOT reveal whether username or password was wrong.
  if (!match || !match.isActive || !(await verifyAccountPassword(u, p))) {
    const err = new Error('Invalid username or password.');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const user = {
    username: match.username,
    role: match.role,
    isMock: true,
  };

  writeSession(user, rememberMe ? STORAGE_KIND.LOCAL : STORAGE_KIND.SESSION);
  return user;
}

/**
 * Clear the session blob from both storages.
 * Idempotent — safe to call even when not authenticated.
 */
export async function logout() {
  await delay(50);
  clearSession();
}

/**
 * Restore the current session, if any. Used by AuthProvider on mount.
 *
 * @returns {Promise<{ username, role, isMock } | null>}
 */
export async function getCurrentUser() {
  await delay(50);
  const session = readSession();
  if (!session) return null;
  const account = findAccount(session.username);
  if (!account || !account.isActive || account.role !== session.role) {
    clearSession();
    return null;
  }
  return session;
}
