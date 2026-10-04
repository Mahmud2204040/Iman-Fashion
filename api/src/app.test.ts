import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { hashPassword } from './security.js';

const testDatabaseUrl = process.env.NI_API_TEST_DATABASE_URL;

test('auth flow against local PostgreSQL', { skip: !testDatabaseUrl }, async () => {
  const parsed = new URL(testDatabaseUrl!);
  assert.ok(['127.0.0.1', 'localhost'].includes(parsed.hostname), 'Tests may only use a local database');
  assert.equal(parsed.pathname, '/ni_fashion', 'Unexpected test database');
  process.env.DATABASE_URL = testDatabaseUrl;
  const [{ prisma }, { createApp }] = await Promise.all([import('./db.js'), import('./app.js')]);
  const username = `test_${Date.now()}`;
  const employeeUsername = `team_${Date.now()}`;
  let employeeId: string | undefined;
  const user = await prisma.user.create({ data: {
    username,
    name: 'Integration Test',
    passwordHash: await hashPassword('test-only-password'),
    role: 'OWNER',
  } });
  const server = createApp(prisma).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const live = await fetch(`${base}/health/live`);
    assert.equal(live.status, 200);
    const ready = await fetch(`${base}/health/ready`);
    assert.equal(ready.status, 200);
    const malformed = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken',
    });
    assert.equal(malformed.status, 400);
    const forbiddenOrigin = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST', headers: { Origin: 'https://not-allowed.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'test-only-password' }),
    });
    assert.equal(forbiddenOrigin.status, 403);

    const invalid = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'wrong-password' }),
    });
    assert.equal(invalid.status, 401);

    const login = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'test-only-password', rememberMe: true }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);
    const body = await login.json() as { data: { user: { username: string }; csrfToken: string; landingPath: string } };
    assert.equal(body.data.user.username, username);
    assert.equal(body.data.landingPath, '/dashboard');
    assert.ok(body.data.csrfToken);

    const me = await fetch(`${base}/api/v1/auth/me`, { headers: { Cookie: cookie } });
    assert.equal(me.status, 200);

    const anonymousUsers = await fetch(`${base}/api/v1/users`);
    assert.equal(anonymousUsers.status, 401);
    const noCsrf = await fetch(`${base}/api/v1/users`, {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: employeeUsername, password: 'employee-password' }),
    });
    assert.equal(noCsrf.status, 403);
    const createEmployee = await fetch(`${base}/api/v1/users`, {
      method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': body.data.csrfToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: employeeUsername, password: 'employee-password', role: 'OWNER' }),
    });
    assert.equal(createEmployee.status, 400);
    const created = await fetch(`${base}/api/v1/users`, {
      method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': body.data.csrfToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: employeeUsername, name: 'Team Member', password: 'employee-password' }),
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json() as { data: { id: string; username: string; isActive: boolean; passwordHash?: string } };
    employeeId = createdBody.data.id;
    assert.equal(createdBody.data.username, employeeUsername);
    assert.equal(createdBody.data.isActive, true);
    assert.equal(createdBody.data.passwordHash, undefined);
    const duplicate = await fetch(`${base}/api/v1/users`, {
      method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': body.data.csrfToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: employeeUsername.toUpperCase(), password: 'another-password' }),
    });
    assert.equal(duplicate.status, 409);
    const employees = await fetch(`${base}/api/v1/users?page=1&pageSize=10`, { headers: { Cookie: cookie } });
    assert.equal(employees.status, 200);
    const employeesBody = await employees.json() as { data: Array<{ id: string; passwordHash?: string }>; meta: { total: number } };
    assert.ok(employeesBody.data.some((row) => row.id === employeeId));
    assert.ok(employeesBody.meta.total >= 1);
    assert.ok(employeesBody.data.every((row) => row.passwordHash === undefined));

    const employeeLogin = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: employeeUsername, password: 'employee-password' }),
    });
    assert.equal(employeeLogin.status, 200);
    const employeeCookie = employeeLogin.headers.get('set-cookie')?.split(';')[0];
    assert.ok(employeeCookie);
    const employeeBody = await employeeLogin.json() as { data: { csrfToken: string; landingPath: string } };
    assert.equal(employeeBody.data.landingPath, '/sales/new');
    const employeeForbidden = await fetch(`${base}/api/v1/users`, { headers: { Cookie: employeeCookie } });
    assert.equal(employeeForbidden.status, 403);
    const employeeWriteForbidden = await fetch(`${base}/api/v1/users/${employeeId}`, {
      method: 'PATCH', headers: { Cookie: employeeCookie, 'X-CSRF-Token': employeeBody.data.csrfToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(employeeWriteForbidden.status, 403);
    const ownerCannotEditSelfThroughEmployeeRoute = await fetch(`${base}/api/v1/users/${user.id}`, {
      method: 'PATCH', headers: { Cookie: cookie, 'X-CSRF-Token': body.data.csrfToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(ownerCannotEditSelfThroughEmployeeRoute.status, 404);

    const wrongOwnerPassword = await fetch(`${base}/api/v1/users/${employeeId}/password`, {
      method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': body.data.csrfToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerPassword: 'incorrect', newPassword: 'employee-new-password' }),
    });
    assert.equal(wrongOwnerPassword.status, 403);
    const resetEmployeePassword = await fetch(`${base}/api/v1/users/${employeeId}/password`, {
      method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': body.data.csrfToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerPassword: 'test-only-password', newPassword: 'employee-new-password' }),
    });
    assert.equal(resetEmployeePassword.status, 200);
    const revokedEmployee = await fetch(`${base}/api/v1/auth/me`, { headers: { Cookie: employeeCookie } });
    assert.equal(revokedEmployee.status, 401);

    const employeeRelogin = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: employeeUsername, password: 'employee-new-password' }),
    });
    assert.equal(employeeRelogin.status, 200);
    const employeeCookie2 = employeeRelogin.headers.get('set-cookie')?.split(';')[0];
    assert.ok(employeeCookie2);
    const deactivate = await fetch(`${base}/api/v1/users/${employeeId}`, {
      method: 'PATCH', headers: { Cookie: cookie, 'X-CSRF-Token': body.data.csrfToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(deactivate.status, 200);
    const disabledSession = await fetch(`${base}/api/v1/auth/me`, { headers: { Cookie: employeeCookie2 } });
    assert.equal(disabledSession.status, 401);
    const disabledLogin = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: employeeUsername, password: 'employee-new-password' }),
    });
    assert.equal(disabledLogin.status, 401);
    const activate = await fetch(`${base}/api/v1/users/${employeeId}`, {
      method: 'PATCH', headers: { Cookie: cookie, 'X-CSRF-Token': body.data.csrfToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true, username: employeeUsername }),
    });
    assert.equal(activate.status, 200);
    const oldSessionStillRevoked = await fetch(`${base}/api/v1/auth/me`, { headers: { Cookie: employeeCookie2 } });
    assert.equal(oldSessionStillRevoked.status, 401);
    const employeeLogin3 = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: employeeUsername, password: 'employee-new-password' }),
    });
    assert.equal(employeeLogin3.status, 200);
    const employeeCookie3 = employeeLogin3.headers.get('set-cookie')?.split(';')[0];
    assert.ok(employeeCookie3);
    const employeeBody3 = await employeeLogin3.json() as { data: { csrfToken: string } };
    const employeeChangesOwnPassword = await fetch(`${base}/api/v1/auth/password`, {
      method: 'POST', headers: { Cookie: employeeCookie3, 'X-CSRF-Token': employeeBody3.data.csrfToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'employee-new-password', newPassword: 'employee-final-password' }),
    });
    assert.equal(employeeChangesOwnPassword.status, 200);
    const changedEmployeeSession = await fetch(`${base}/api/v1/auth/me`, { headers: { Cookie: employeeCookie3 } });
    assert.equal(changedEmployeeSession.status, 401);

    const refusedLogout = await fetch(`${base}/api/v1/auth/logout`, {
      method: 'POST', headers: { Cookie: cookie },
    });
    assert.equal(refusedLogout.status, 403);
    const logout = await fetch(`${base}/api/v1/auth/logout`, {
      method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': body.data.csrfToken },
    });
    assert.equal(logout.status, 200);
    const afterLogout = await fetch(`${base}/api/v1/auth/me`, { headers: { Cookie: cookie } });
    assert.equal(afterLogout.status, 401);

    const ownerRelogin = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'test-only-password' }),
    });
    assert.equal(ownerRelogin.status, 200);
    const ownerCookie2 = ownerRelogin.headers.get('set-cookie')?.split(';')[0];
    assert.ok(ownerCookie2);
    const ownerBody2 = await ownerRelogin.json() as { data: { csrfToken: string } };
    const ownerChange = await fetch(`${base}/api/v1/auth/password`, {
      method: 'POST', headers: { Cookie: ownerCookie2, 'X-CSRF-Token': ownerBody2.data.csrfToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'test-only-password', newPassword: 'owner-new-password' }),
    });
    assert.equal(ownerChange.status, 200);
    const ownerSessionRevoked = await fetch(`${base}/api/v1/auth/me`, { headers: { Cookie: ownerCookie2 } });
    assert.equal(ownerSessionRevoked.status, 401);
    const oldOwnerPassword = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'test-only-password' }),
    });
    assert.equal(oldOwnerPassword.status, 401);
    const newOwnerPassword = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'owner-new-password' }),
    });
    assert.equal(newOwnerPassword.status, 200);
  } finally {
    server.close();
    if (employeeId) {
      await prisma.session.deleteMany({ where: { userId: employeeId } });
      await prisma.user.delete({ where: { id: employeeId } });
    }
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});
