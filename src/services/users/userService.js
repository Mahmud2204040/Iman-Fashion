import { ROLES } from '../../constants/roles.js';
import { MOCK_USERS } from '../../mock/users.js';
import { MOCK_PASSWORD } from '../../mock/users.js';

const KEY = 'ni-fashion.mock-accounts';
const CREDENTIAL_KEY = 'ni-fashion.mock-credential-hashes.v1';
const HASH_ITERATIONS = 120000;
const defaults = MOCK_USERS.map((row) => ({ username: row.username, role: row.role, isActive: true }));
let memoryAccounts = defaults;

function read() {
  if (typeof window === 'undefined') return memoryAccounts.map((row) => ({ ...row }));
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    if (Array.isArray(saved)) {
      const employees = saved.filter((row) => row && row.role === ROLES.EMPLOYEE && typeof row.username === 'string')
        .map((row) => ({ username: row.username, role: ROLES.EMPLOYEE, isActive: row.isActive !== false }));
      // A saved employee list is authoritative. Re-seeding here would revive
      // the built-in username after the owner renames that demo account.
      return [defaults[0], ...employees];
    }
  } catch { /* Corrupt demo data falls back to fixtures. */ }
  return defaults.map((row) => ({ ...row }));
}

function write(accounts) {
  memoryAccounts = accounts;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(KEY, JSON.stringify(accounts.filter((row) => row.role === ROLES.EMPLOYEE)));
  }
}

function requireOwner(actor) {
  if (actor?.role !== ROLES.OWNER) {
    const error = new Error('Owner access required.');
    error.code = 'FORBIDDEN_ROLE';
    throw error;
  }
}

function readCredentials() {
  if (typeof window === 'undefined') return Object.create(null);
  try {
    const saved = JSON.parse(window.localStorage.getItem(CREDENTIAL_KEY) || '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return Object.create(null);
    const records = Object.create(null);
    for (const [username, credential] of Object.entries(saved)) records[username] = credential;
    return records;
  } catch { return Object.create(null); }
}

function writeCredentials(credentials) {
  window.localStorage.setItem(CREDENTIAL_KEY, JSON.stringify(credentials));
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  if (typeof hex !== 'string' || !/^(?:[a-f\d]{2})+$/i.test(hex)) return null;
  return Uint8Array.from(hex.match(/.{2}/g), (pair) => Number.parseInt(pair, 16));
}

async function derivePassword(password, salt) {
  const key = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: HASH_ITERATIONS, hash: 'SHA-256' }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    const error = new Error('Password must be 8–128 characters.');
    error.code = 'INVALID_PASSWORD';
    throw error;
  }
}

async function makeCredential(password) {
  validatePassword(password);
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return { salt: bytesToHex(salt), hash: await derivePassword(password, salt) };
}

export function findAccount(username) {
  return read().find((row) => row.username.toLowerCase() === String(username || '').trim().toLowerCase()) || null;
}

export async function verifyAccountPassword(username, password) {
  const account = findAccount(username);
  if (!account || !account.isActive) return false;
  const credential = readCredentials()[account.username.toLowerCase()];
  if (!credential) return password === MOCK_PASSWORD;
  const salt = hexToBytes(credential.salt);
  if (!salt || typeof credential.hash !== 'string') return false;
  const candidate = await derivePassword(password, salt);
  return candidate === credential.hash;
}

export function hasCustomPassword(username) {
  const account = findAccount(username);
  return Boolean(account && readCredentials()[account.username.toLowerCase()]);
}

export async function setOwnPassword(currentPassword, nextPassword, { actor } = {}) {
  const account = findAccount(actor?.username);
  if (!account || account.role !== actor?.role || !(await verifyAccountPassword(account.username, currentPassword))) {
    const error = new Error('Current password is incorrect.');
    error.code = 'INVALID_CURRENT_PASSWORD';
    throw error;
  }
  const credential = await makeCredential(nextPassword);
  writeCredentials({ ...readCredentials(), [account.username.toLowerCase()]: credential });
}

export async function setEmployeePassword(username, nextPassword, { actor } = {}) {
  requireOwner(actor);
  const employee = read().find((row) => row.role === ROLES.EMPLOYEE && row.username.toLowerCase() === String(username || '').toLowerCase());
  if (!employee) {
    const error = new Error('Employee account not found.');
    error.code = 'NOT_FOUND';
    throw error;
  }
  const credential = await makeCredential(nextPassword);
  writeCredentials({ ...readCredentials(), [employee.username.toLowerCase()]: credential });
}

export async function getEmployees({ actor } = {}) {
  requireOwner(actor);
  return read().filter((row) => row.role === ROLES.EMPLOYEE);
}

export async function createEmployee(payload = {}, { actor } = {}) {
  requireOwner(actor);
  const username = String(payload.username || '').trim();
  if (!/^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(username)) {
    const error = new Error('Username must be 3–32 letters, numbers, dots, underscores or hyphens.');
    error.code = 'INVALID_USERNAME';
    throw error;
  }
  const accounts = read();
  if (accounts.some((row) => row.username.toLowerCase() === username.toLowerCase())) {
    const error = new Error('This username already exists.');
    error.code = 'DUPLICATE_USERNAME';
    throw error;
  }
  const credential = await makeCredential(payload.password);
  const created = { username, role: ROLES.EMPLOYEE, isActive: true };
  const previousCredentials = readCredentials();
  writeCredentials({ ...previousCredentials, [username.toLowerCase()]: credential });
  try { write([...accounts, created]); }
  catch (error) { writeCredentials(previousCredentials); throw error; }
  return created;
}

export async function updateEmployee(username, patch = {}, { actor } = {}) {
  requireOwner(actor);
  const accounts = read();
  const index = accounts.findIndex((row) => row.role === ROLES.EMPLOYEE && row.username.toLowerCase() === String(username || '').toLowerCase());
  if (index < 0) {
    const error = new Error('Employee account not found.');
    error.code = 'NOT_FOUND';
    throw error;
  }
  const next = { ...accounts[index] };
  if (patch.username !== undefined) {
    const proposed = String(patch.username).trim();
    if (!/^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(proposed) || accounts.some((row, position) => position !== index && row.username.toLowerCase() === proposed.toLowerCase())) {
      const error = new Error('Enter a unique username of 3–32 valid characters.');
      error.code = 'INVALID_USERNAME';
      throw error;
    }
    next.username = proposed;
  }
  if (patch.isActive !== undefined) next.isActive = Boolean(patch.isActive);
  accounts[index] = next;
  if (next.username.toLowerCase() !== String(username).toLowerCase()) {
    const previousCredentials = readCredentials();
    const credentials = { ...previousCredentials };
    const previousKey = String(username).toLowerCase();
    if (credentials[previousKey]) {
      credentials[next.username.toLowerCase()] = credentials[previousKey];
      delete credentials[previousKey];
      writeCredentials(credentials);
      try { write(accounts); }
      catch (error) { writeCredentials(previousCredentials); throw error; }
      return next;
    }
  }
  write(accounts);
  return next;
}
