import express, { type Request, type Response } from 'express';
import type { PrismaClient } from './generated/prisma/client.js';
import { hashPassword, hashToken, randomToken, safeEqualHex, validPassword, verifyPassword } from './security.js';
import { registerBusinessRoutes } from './business.js';

const SESSION_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-ni_session' : 'ni_session';
const ALLOWED_ORIGINS = (process.env.APP_ORIGINS ?? 'http://127.0.0.1:8080,http://localhost:8080,http://127.0.0.1:5173,http://localhost:5173')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
const SESSION_MS = 12 * 60 * 60 * 1000;
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const failedLogins = new Map<string, { count: number; until: number }>();

function publicUser(user: { id: string; username: string; name: string; role: string }) {
  return { id: user.id, username: user.username, name: user.name, role: user.role };
}

function landingPath(role: string): string {
  return role === 'OWNER' ? '/dashboard' : '/sales/new';
}

function cookieValue(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie ?? '';
  for (const pair of raw.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() === name) return pair.slice(separator + 1).trim();
  }
  return undefined;
}

function setSessionCookie(res: Response, token: string, remember: boolean) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(remember ? { maxAge: REMEMBER_MS } : {}),
  });
}

function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

function failureKey(req: Request, username: string) {
  return `${req.ip}:${username}`;
}

function employeeUsername(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(value);
}

function uuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function uniqueConflict(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'P2002';
}

function displayName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 150;
}

function hasOnlyKeys(body: unknown, allowed: string[]): body is Record<string, unknown> {
  return !!body && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).every((key) => allowed.includes(key));
}

function publicEmployee(user: { id: string; username: string; name: string; isActive: boolean; createdAt: Date; updatedAt: Date }) {
  return { id: user.id, username: user.username, name: user.name, isActive: user.isActive,
    createdAt: user.createdAt, updatedAt: user.updatedAt };
}

export function createApp(prisma: PrismaClient) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 0));
  app.use(express.json({ limit: '32kb' }));
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, Idempotency-Key, X-Cache-Bypass');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
      res.setHeader('Vary', 'Origin');
    }
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      res.status(403).json({ error: { code: 'ORIGIN_DENIED', message: 'Origin is not allowed' } });
      return;
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (_req, res) => {
    try {
      await prisma.user.count();
      await prisma.financialEvent.count();
      if (process.env.NODE_ENV === 'production' &&
          !(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)) {
        res.status(503).json({ error: { code: 'UPLOAD_UNAVAILABLE', message: 'Receipt storage not configured' } });
        return;
      }
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Database not ready' } });
    }
  });

  app.post('/api/v1/auth/login', async (req, res) => {
    const { username, password, rememberMe } = req.body ?? {};
    if (typeof username !== 'string' || !/^[a-zA-Z0-9._-]{3,100}$/.test(username) || !validPassword(password) ||
        (rememberMe !== undefined && typeof rememberMe !== 'boolean')) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid login fields' } });
      return;
    }
    const normalized = username.trim().toLowerCase();
    const key = failureKey(req, normalized);
    const failures = failedLogins.get(key);
    if (failures && failures.until > Date.now() && failures.count >= 5) {
      res.status(429).json({ error: { code: 'TOO_MANY_ATTEMPTS', message: 'Try again later' } });
      return;
    }
    const user = await prisma.user.findUnique({ where: { username: normalized } });
    const verified = user?.isActive ? await verifyPassword(password, user.passwordHash) : false;
    if (!verified || !user) {
      const count = failures && failures.until > Date.now() ? failures.count + 1 : 1;
      failedLogins.set(key, { count, until: Date.now() + FAIL_WINDOW_MS });
      res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } });
      return;
    }
    failedLogins.delete(key);
    const token = randomToken();
    const csrfToken = randomToken();
    const remember = rememberMe === true;
    await prisma.session.create({ data: {
      userId: user.id,
      tokenHash: hashToken(token),
      csrfToken,
      authVersion: user.authVersion,
      expiresAt: new Date(Date.now() + (remember ? REMEMBER_MS : SESSION_MS)),
    } });
    setSessionCookie(res, token, remember);
    res.json({ data: { user: publicUser(user), csrfToken, landingPath: landingPath(user.role) } });
  });

  async function currentSession(req: Request) {
    const token = cookieValue(req, SESSION_COOKIE);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date() || !session.user.isActive ||
        session.authVersion !== session.user.authVersion) return null;
    return session;
  }

  async function requireSession(req: Request, res: Response, role?: 'OWNER') {
    const session = await currentSession(req);
    if (!session) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } });
      return null;
    }
    if (role && session.user.role !== role) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Owner access required', returnPath: '/sales/new' } });
      return null;
    }
    return session;
  }

  function requireCsrf(req: Request, res: Response, expected: string): boolean {
    const supplied = req.headers['x-csrf-token'];
    if (typeof supplied !== 'string' || !safeEqualHex(hashToken(supplied), hashToken(expected))) {
      res.status(403).json({ error: { code: 'INVALID_CSRF_TOKEN', message: 'Invalid CSRF token' } });
      return false;
    }
    return true;
  }

  app.get('/api/v1/auth/me', async (req, res) => {
    const session = await requireSession(req, res);
    if (!session) return;
    res.json({ data: { user: publicUser(session.user), csrfToken: session.csrfToken,
      landingPath: landingPath(session.user.role) } });
  });

  app.post('/api/v1/auth/logout', async (req, res) => {
    const session = await currentSession(req);
    if (!session) {
      clearSessionCookie(res);
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } });
      return;
    }
    if (!requireCsrf(req, res, session.csrfToken)) return;
    await prisma.session.delete({ where: { id: session.id } });
    clearSessionCookie(res);
    res.json({ data: { signedOut: true } });
  });

  app.post('/api/v1/auth/password', async (req, res) => {
    const session = await requireSession(req, res);
    if (!session || !requireCsrf(req, res, session.csrfToken)) return;
    const body = req.body;
    if (!hasOnlyKeys(body, ['currentPassword', 'newPassword']) ||
        !validPassword(body.currentPassword) || !validPassword(body.newPassword) ||
        body.currentPassword === body.newPassword) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid password fields' } });
      return;
    }
    if (!await verifyPassword(body.currentPassword, session.user.passwordHash)) {
      res.status(403).json({ error: { code: 'WRONG_PASSWORD', message: 'Current password is incorrect' } });
      return;
    }
    const passwordHash = await hashPassword(body.newPassword);
    await prisma.$transaction([
      prisma.user.update({ where: { id: session.user.id }, data: { passwordHash, authVersion: { increment: 1 } } }),
      prisma.session.deleteMany({ where: { userId: session.user.id } }),
    ]);
    clearSessionCookie(res);
    res.json({ data: { passwordChanged: true, signedOut: true } });
  });

  app.post('/api/v1/auth/username', async (req, res) => {
    const session = await requireSession(req, res, 'OWNER'); // Only owners can change their own username using this route
    if (!session || !requireCsrf(req, res, session.csrfToken)) return;
    const body = req.body;
    if (!hasOnlyKeys(body, ['currentPassword', 'newUsername']) ||
        !validPassword(body.currentPassword) ||
        typeof body.newUsername !== 'string' ||
        !/^[a-zA-Z0-9._-]{3,100}$/.test(body.newUsername)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid field format' } });
      return;
    }
    if (!await verifyPassword(body.currentPassword, session.user.passwordHash)) {
      res.status(403).json({ error: { code: 'WRONG_PASSWORD', message: 'Current password is incorrect' } });
      return;
    }
    const newUsername = body.newUsername.trim().toLowerCase();

    if (newUsername === session.user.username) {
        res.json({ data: { usernameChanged: false, signedOut: false } });
        return;
    }

    try {
      await prisma.$transaction([
        prisma.user.update({ where: { id: session.user.id }, data: { username: newUsername, authVersion: { increment: 1 } } }),
        prisma.session.deleteMany({ where: { userId: session.user.id } }),
      ]);
      clearSessionCookie(res);
      res.json({ data: { usernameChanged: true, signedOut: true } });
    } catch (error) {
      if (uniqueConflict(error)) {
        res.status(409).json({ error: { code: 'USERNAME_TAKEN', message: 'Username already exists' } });
        return;
      }
      throw error;
    }
  });

  app.patch('/api/v1/auth/name', async (req, res) => {
    const session = await requireSession(req, res, 'OWNER');
    if (!session || !requireCsrf(req, res, session.csrfToken)) return;
    const body = req.body;
    if (!hasOnlyKeys(body, ['name']) || !displayName(body.name)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid name' } });
      return;
    }
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: body.name.trim() },
    });
    res.json({ data: { user: publicUser(updated) } });
  });

  app.get('/api/v1/users', async (req, res) => {
    const session = await requireSession(req, res, 'OWNER');
    if (!session) return;
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 50);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid pagination' } });
      return;
    }
    const where = { role: 'EMPLOYEE' as const };
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({ where, orderBy: { username: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.user.count({ where }),
    ]);
    res.json({ data: users.map(publicEmployee), meta: { page, pageSize, total } });
  });

  app.post('/api/v1/users', async (req, res) => {
    const session = await requireSession(req, res, 'OWNER');
    if (!session || !requireCsrf(req, res, session.csrfToken)) return;
    const body = req.body;
    if (!hasOnlyKeys(body, ['username', 'name', 'password']) ||
        !employeeUsername(body.username) || !validPassword(body.password) ||
        (body.name !== undefined && !displayName(body.name))) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid employee fields' } });
      return;
    }
    const username = body.username.toLowerCase();
    if (await prisma.user.findUnique({ where: { username } })) {
      res.status(409).json({ error: { code: 'USERNAME_TAKEN', message: 'Username already exists' } });
      return;
    }
    try {
      const user = await prisma.user.create({ data: {
        username,
        name: body.name === undefined ? body.username : body.name.trim(),
        passwordHash: await hashPassword(body.password),
        role: 'EMPLOYEE',
      } });
      res.status(201).json({ data: publicEmployee(user) });
    } catch (error) {
      if (uniqueConflict(error)) {
        res.status(409).json({ error: { code: 'USERNAME_TAKEN', message: 'Username already exists' } });
        return;
      }
      throw error;
    }
  });

  app.patch('/api/v1/users/:id', async (req, res) => {
    const session = await requireSession(req, res, 'OWNER');
    if (!session || !requireCsrf(req, res, session.csrfToken)) return;
    const id = String(req.params.id);
    if (!uuid(id)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid employee ID' } });
      return;
    }
    const body = req.body;
    if (!hasOnlyKeys(body, ['username', 'name', 'isActive']) || Object.keys(body).length === 0 ||
        (body.username !== undefined && !employeeUsername(body.username)) ||
        (body.name !== undefined && !displayName(body.name)) ||
        (body.isActive !== undefined && typeof body.isActive !== 'boolean')) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid employee changes' } });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== 'EMPLOYEE') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } });
      return;
    }
    const username = body.username === undefined ? user.username : body.username.toLowerCase();
    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    const isActive = typeof body.isActive === 'boolean' ? body.isActive : undefined;
    if (username !== user.username && await prisma.user.findUnique({ where: { username } })) {
      res.status(409).json({ error: { code: 'USERNAME_TAKEN', message: 'Username already exists' } });
      return;
    }
    const credentialChange = username !== user.username || (isActive !== undefined && isActive !== user.isActive);
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.user.update({ where: { id }, data: {
          ...(body.username === undefined ? {} : { username }),
          ...(name === undefined ? {} : { name }),
          ...(isActive === undefined ? {} : { isActive }),
          ...(credentialChange ? { authVersion: { increment: 1 } } : {}),
        } });
        if (credentialChange) await tx.session.deleteMany({ where: { userId: id } });
        return result;
      });
      res.json({ data: publicEmployee(updated) });
    } catch (error) {
      if (uniqueConflict(error)) {
        res.status(409).json({ error: { code: 'USERNAME_TAKEN', message: 'Username already exists' } });
        return;
      }
      throw error;
    }
  });

  app.post('/api/v1/users/:id/password', async (req, res) => {
    const session = await requireSession(req, res, 'OWNER');
    if (!session || !requireCsrf(req, res, session.csrfToken)) return;
    const id = String(req.params.id);
    if (!uuid(id)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid employee ID' } });
      return;
    }
    const body = req.body;
    if (!hasOnlyKeys(body, ['ownerPassword', 'newPassword']) ||
        !validPassword(body.ownerPassword) || !validPassword(body.newPassword)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid password fields' } });
      return;
    }
    if (!await verifyPassword(body.ownerPassword, session.user.passwordHash)) {
      res.status(403).json({ error: { code: 'WRONG_PASSWORD', message: 'Owner password is incorrect' } });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== 'EMPLOYEE') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } });
      return;
    }
    const passwordHash = await hashPassword(body.newPassword);
    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { passwordHash, authVersion: { increment: 1 } } }),
      prisma.session.deleteMany({ where: { userId: id } }),
    ]);
    res.json({ data: { passwordChanged: true, sessionsRevoked: true } });
  });

  registerBusinessRoutes(app, prisma, requireSession, requireCsrf);
  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
  app.use((error: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    const requestError = error as { status?: unknown };
    if (requestError?.status === 400) {
      res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Invalid request body' } });
      return;
    }
    // Never log an exception body here: JSON parse errors can contain credentials.
    console.error('Unhandled API error', error instanceof Error ? error.name : 'UnknownError');
    if (!res.headersSent) res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Request failed' } });
  });
  return app;
}
