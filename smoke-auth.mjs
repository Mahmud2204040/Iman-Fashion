// smoke-auth.mjs
//
// Node-side test for the auth service. Mirrors the real browser flow
// against a stubbed `window` so we can verify that:
//   - owner / 1234 → user object with role OWNER
//   - employee / 1234 → user object with role EMPLOYEE
//   - wrong password → INVALID_CREDENTIALS error
//   - empty fields → EMPTY_USERNAME / EMPTY_PASSWORD
//   - getCurrentUser restores from sessionStorage when rememberMe=false
//   - getCurrentUser restores from localStorage when rememberMe=true
//
// If this passes AND `npm run lint` AND `npm run build` AND the
// LoginPage render-prop fix is in place, the /login route is safe to
// open in a browser.

import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function loadModule(relPath, ctx) {
  let src = readFileSync(path.join(here, relPath), 'utf8');
  // Strip import statements — we use globals instead.
  src = src.replace(/import\s+[^;]+?from\s+["'][^"']+["'];?/g, '');
  // Strip exports — turn `export async function foo` into `async function foo`.
  src = src.replace(/export\s+default\s+/g, '');
  src = src.replace(/export\s+async\s+function\s+([A-Za-z0-9_]+)/g, 'async function $1');
  src = src.replace(/export\s+function\s+([A-Za-z0-9_]+)/g, 'function $1');
  src = src.replace(/export\s+const\s+([A-Za-z0-9_]+)/g, 'const $1');
  return src;
}

const makeStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => { m.clear(); },
  };
};
const localStore = makeStorage();
const sessionStore = makeStorage();

const ctx = vm.createContext({
  console,
  setTimeout, clearTimeout,
  Promise,
  Error,
  crypto: webcrypto,
  TextEncoder,
  window: { localStorage: localStore, sessionStorage: sessionStore },
  JSON, Math, Date, Object,
});

// Load order matches dependencies.
const modules = [
  'src/constants/roles.js',
  'src/constants/storage.js',
  'src/mock/users.js',
  'src/services/delay.js',
  'src/services/users/userService.js',
  'src/services/auth/authService.js',
];
for (const m of modules) vm.runInContext(loadModule(m, ctx), ctx, { filename: m });

const { login, logout, getCurrentUser, createEmployee, updateEmployee, getEmployees, setOwnPassword, setEmployeePassword } = ctx;

// ---- Test helpers ----
let pass = 0;
let fail = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log('OK  ', name);
    pass++;
  } catch (e) {
    console.error('FAIL', name, '-', e.message);
    fail++;
  }
}

function expect(cond, msg) { if (!cond) throw new Error(msg); }

// ---- Tests ----
await test('owner / 1234 → role OWNER', async () => {
  const u = await login({ username: 'owner', password: '1234', rememberMe: true });
  expect(u.username === 'owner', `expected username=owner, got ${u.username}`);
  expect(u.role === 'OWNER', `expected role=OWNER, got ${u.role}`);
});

await test('owner invalid → INVALID_CREDENTIALS', async () => {
  let threw = false;
  try { await login({ username: 'owner', password: 'wrong', rememberMe: false }); }
  catch (e) { threw = true; expect(e.code === 'INVALID_CREDENTIALS', `wrong code: ${e.code}`); }
  expect(threw, 'expected login to throw');
});

await test('empty username → EMPTY_USERNAME', async () => {
  let code = null;
  try { await login({ username: '', password: '1234', rememberMe: false }); }
  catch (e) { code = e.code; }
  expect(code === 'EMPTY_USERNAME', `expected EMPTY_USERNAME, got ${code}`);
});

await test('empty password → EMPTY_PASSWORD', async () => {
  let code = null;
  try { await login({ username: 'owner', password: '', rememberMe: false }); }
  catch (e) { code = e.code; }
  expect(code === 'EMPTY_PASSWORD', `expected EMPTY_PASSWORD, got ${code}`);
});

await test('rememberMe ON → restores from localStorage', async () => {
  await logout();
  ctx.window.localStorage.clear();
  ctx.window.sessionStorage.clear();
  await login({ username: 'employee', password: '1234', rememberMe: true });
  const localVal = ctx.window.localStorage.getItem('ni-fashion.session');
  expect(localVal && localVal.includes('employee'), 'expected employee in localStorage');
  const u = await getCurrentUser();
  expect(u && u.role === 'EMPLOYEE', `expected EMPLOYEE, got ${u && u.role}`);
});

await test('rememberMe OFF → restores from sessionStorage only', async () => {
  await logout();
  ctx.window.localStorage.clear();
  ctx.window.sessionStorage.clear();
  await login({ username: 'employee', password: '1234', rememberMe: false });
  const localVal = ctx.window.localStorage.getItem('ni-fashion.session');
  const sessionVal = ctx.window.sessionStorage.getItem('ni-fashion.session');
  expect(localVal === null,
      `expected localStorage empty, got: ${localVal}`);
  expect(sessionVal && sessionVal.includes('employee'), 'expected employee in sessionStorage');
  const u = await getCurrentUser();
  expect(u && u.role === 'EMPLOYEE', `expected EMPLOYEE, got ${u && u.role}`);
});

await test('logout clears both stores', async () => {
  await login({ username: 'owner', password: '1234', rememberMe: true });
  await logout();
  const u = await getCurrentUser();
  expect(u === null, `expected null after logout, got ${JSON.stringify(u)}`);
});

await test('tampered JSON in storage → null (defensive)', async () => {
  await logout();
  ctx.window.localStorage.clear();
  ctx.window.localStorage.setItem('ni-fashion.session', '{not-json');
  const u = await getCurrentUser();
  expect(u === null, 'expected null for tampered storage');
});

await test('owner creates an employee with its own password', async () => {
  const actor = { role: 'OWNER' };
  const created = await createEmployee({ username: 'qa.employee', password: 'test-pass-2026' }, { actor });
  expect(created.isActive && created.role === 'EMPLOYEE', 'new employee should be active');
  const saved = ctx.window.localStorage.getItem('ni-fashion.mock-accounts');
  const credentials = ctx.window.localStorage.getItem('ni-fashion.mock-credential-hashes.v1');
  expect(saved?.includes('qa.employee') && !saved.includes('test-pass-2026'), 'store metadata, never a password');
  expect(credentials?.includes('qa.employee') && !credentials.includes('test-pass-2026'), 'store only a password verifier');
  const signedIn = await login({ username: 'qa.employee', password: 'test-pass-2026' });
  expect(signedIn.role === 'EMPLOYEE', 'new account should sign in');
});

await test('owner can reset an employee password', async () => {
  await setEmployeePassword('qa.employee', 'new-pass-2026', { actor: { role: 'OWNER' } });
  let oldRejected = false;
  try { await login({ username: 'qa.employee', password: 'test-pass-2026' }); } catch { oldRejected = true; }
  expect(oldRejected, 'old password must stop working');
  expect((await login({ username: 'qa.employee', password: 'new-pass-2026' })).role === 'EMPLOYEE', 'new password must work');
});

await test('inactive employee cannot sign in or restore an existing session', async () => {
  await updateEmployee('qa.employee', { isActive: false }, { actor: { role: 'OWNER' } });
  expect(await getCurrentUser() === null, 'inactive account session must be invalidated');
  let code;
  try { await login({ username: 'qa.employee', password: '1234' }); } catch (error) { code = error.code; }
  expect(code === 'INVALID_CREDENTIALS', `expected invalid credentials, got ${code}`);
});

await test('renaming built-in employee does not re-create old username', async () => {
  const actor = { role: 'OWNER' };
  await updateEmployee('employee', { username: 'sales.team' }, { actor });
  const names = (await getEmployees({ actor })).map((row) => row.username);
  expect(names.includes('sales.team') && !names.includes('employee'), 'old username must not revive');
});

await test('owner changes own password with current-password check', async () => {
  let rejected = false;
  try { await setOwnPassword('wrong', 'owner-pass-2026', { actor: { username: 'owner', role: 'OWNER' } }); } catch { rejected = true; }
  expect(rejected, 'wrong current password must be rejected');
  await setOwnPassword('1234', 'owner-pass-2026', { actor: { username: 'owner', role: 'OWNER' } });
  let oldRejected = false;
  try { await login({ username: 'owner', password: '1234' }); } catch { oldRejected = true; }
  expect(oldRejected, 'old owner password must stop working');
  expect((await login({ username: 'owner', password: 'owner-pass-2026' })).role === 'OWNER', 'new owner password must work');
});

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
