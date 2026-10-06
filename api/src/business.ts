import { createHash, randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import type { PrismaClient, Prisma } from './generated/prisma/client.js';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

type Session = { user: { id: string; role: string }; csrfToken: string };
type Auth = (req: Request, res: Response, role?: 'OWNER') => Promise<Session | null>;
type Csrf = (req: Request, res: Response, expected: string) => boolean;
type Tx = Prisma.TransactionClient;

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

const uuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const string = (value: unknown, max = 255): value is string => typeof value === 'string' &&
  value.trim().length > 0 && value.trim().length <= max;
const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const only = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every((key) => keys.includes(key));
const bad = (message = 'Invalid request fields') => new ApiError(400, 'VALIDATION_ERROR', message);

function cents(value: unknown): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$/.test(value)) throw bad('Money must be a decimal string');
  const [whole, fraction = ''] = value.split('.');
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (amount <= 0n) throw bad('Amount must be positive');
  return amount;
}

function money(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  return `${negative ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}

function asCents(value: { toString(): string }): bigint {
  const raw = value.toString();
  const negative = raw.startsWith('-');
  const [whole, fraction = ''] = (negative ? raw.slice(1) : raw).split('.');
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
  return negative ? -result : result;
}

function businessDate(date: Date): Date {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  return new Date(`${day}T00:00:00.000Z`);
}

async function saleCode(tx: Tx, date: Date): Promise<string> {
  const day = businessDate(date).toISOString().slice(0, 10).replaceAll('-', '');
  const prefix = `S-${day}-`;
  await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${prefix}))) AS sale_code_lock`;
  const rows = await tx.$queryRaw<Array<{ last: number | null }>>`
    SELECT MAX(right(sales_code, 4)::integer) AS last FROM sales
    WHERE sales_code LIKE ${prefix + '%'} AND sales_code ~ '^S-[0-9]{8}-[0-9]{4}$'`;
  const next = (rows[0]?.last ?? 0) + 1;
  if (next > 9999) throw new ApiError(409, 'SALE_CODE_EXHAUSTED', 'Daily sale code limit reached');
  return `${prefix}${String(next).padStart(4, '0')}`;
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function requestKey(req: Request): string {
  const value = req.get('Idempotency-Key');
  if (!string(value, 100)) throw bad('Idempotency-Key is required');
  return value.trim();
}

function serializeSale(sale: Awaited<ReturnType<Tx['sale']['findUniqueOrThrow']>> & { items?: Array<Record<string, unknown>> }, owner: boolean) {
  return {
    id: sale.id, salesCode: sale.salesCode, customerId: sale.customerId,
    totalAmount: sale.totalAmount.toString(), status: sale.status, settlementSource: sale.settlementSource,
    saleDate: sale.saleDate, notes: sale.notes, createdById: sale.createdById,
    ...(sale.items ? { items: sale.items.map((item) => ({
      id: item.id, productId: item.productId, productNameAtSale: item.productNameAtSale,
      quantity: item.quantity, sellingPrice: String(item.sellingPrice), lineTotal: String(item.lineTotal),
      ...(owner ? { purchaseCostAtSale: item.purchaseCostAtSale === null ? null : String(item.purchaseCostAtSale) } : {}),
    })) } : {}),
  };
}

type ItemInput = { productId: string; quantity: number; sellingPrice: string; line: bigint };
function saleInput(body: unknown, replace: boolean) {
  const keys = replace
    ? ['reason', 'customerId', 'items', 'notes', 'cashDifferenceSettledConfirmed']
    : ['customerId', 'items', 'notes'];
  if (!plain(body) || !only(body, keys) || !uuid(body.customerId) || !Array.isArray(body.items) ||
      body.items.length === 0 || body.items.length > 100 ||
      (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') ||
      (replace && !string(body.reason, 2000))) throw bad();
  const items: ItemInput[] = [];
  const seen = new Set<string>();
  for (const raw of body.items) {
    if (!plain(raw) || !only(raw, ['productId', 'quantity', 'sellingPrice']) || !uuid(raw.productId) ||
        !Number.isInteger(raw.quantity) || (raw.quantity as number) < 1 || (raw.quantity as number) > 100000 ||
        seen.has(raw.productId)) throw bad('Invalid or duplicate sale item');
    const price = cents(raw.sellingPrice);
    items.push({ productId: raw.productId, quantity: raw.quantity as number, sellingPrice: money(price), line: price * BigInt(raw.quantity as number) });
    seen.add(raw.productId);
  }
  const total = items.reduce((sum, item) => sum + item.line, 0n);
  if (total > 999999999999n) throw bad('Sale total exceeds limit');
  return { customerId: body.customerId, items, total, notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
    reason: replace ? String(body.reason).trim() : null,
    confirmed: replace ? body.cashDifferenceSettledConfirmed === true : false };
}

async function event(tx: Tx, data: {
  key: string; metric: string; kind: string; sourceType: string; sourceId: string; amount: string;
  at: Date; actorId: string; customerId?: string | null; productId?: string | null;
  supplierId?: string | null; categoryId?: string | null; businessDay?: Date;
}) {
  if (asCents(data.amount) === 0n) return;
  await tx.financialEvent.create({ data: {
    eventKey: data.key, metric: data.metric, eventKind: data.kind, sourceType: data.sourceType,
    sourceId: data.sourceId, amount: data.amount, businessDate: data.businessDay ?? businessDate(data.at),
    occurredAt: data.at, actorId: data.actorId, customerId: data.customerId,
    productId: data.productId, supplierId: data.supplierId, categoryId: data.categoryId,
  } });
}

async function cash(tx: Tx, input: { amount: bigint; referenceType: string; referenceId?: string; reason: string; at: Date; actorId: string;
  requestKey?: string; requestFingerprint?: string }) {
  if (input.amount === 0n) return;
  await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(57489712)) AS cash_lock`;
  const transaction = await tx.cashTransaction.create({ data: {
    transactionType: input.amount > 0n ? 'CASH_IN' : 'CASH_OUT', amount: money(input.amount > 0n ? input.amount : -input.amount),
    referenceType: input.referenceType, referenceId: input.referenceId,
    reason: input.reason, occurredAt: input.at, createdById: input.actorId,
    requestKey: input.requestKey, requestFingerprint: input.requestFingerprint,
  } });
  await event(tx, { key: `cash:${transaction.id}`, metric: 'CASH', kind: input.referenceType,
    sourceType: 'CASH_TRANSACTION', sourceId: transaction.id, amount: money(input.amount), at: input.at, actorId: input.actorId });
}

async function saleEvents(tx: Tx, sale: { id: string; customerId: string; totalAmount: { toString(): string }; items: Array<{
  id: string; productId: string; quantity: number; lineTotal: { toString(): string };
  purchaseCostAtSale: { toString(): string } | null;
}> }, at: Date, actorId: string, reversal: boolean, correctionId?: string) {
  const suffix = reversal ? `correction:${correctionId}:reverse` : 'completed';
  await event(tx, { key: `sale:${sale.id}:revenue:${suffix}`, metric: 'SALES_REVENUE',
    kind: reversal ? 'SALE_REVERSED' : 'SALE_COMPLETED', sourceType: 'SALE', sourceId: sale.id,
    amount: money(asCents(sale.totalAmount) * (reversal ? -1n : 1n)), at, actorId, customerId: sale.customerId });
  for (const item of sale.items) {
    await event(tx, { key: `sale-item:${item.id}:revenue:${suffix}`, metric: 'SALES_PRODUCT_REVENUE',
      kind: reversal ? 'SALE_REVERSED' : 'SALE_COMPLETED', sourceType: 'SALE_ITEM', sourceId: item.id,
      amount: money(asCents(item.lineTotal) * (reversal ? -1n : 1n)), at, actorId,
      customerId: sale.customerId, productId: item.productId });
    if (!item.purchaseCostAtSale) {
      await event(tx, { key: `sale-item:${item.id}:unknown-cost:${suffix}`, metric: 'UNKNOWN_COST_COUNT',
        kind: reversal ? 'SALE_REVERSED' : 'SALE_COMPLETED', sourceType: 'SALE_ITEM', sourceId: item.id,
        amount: money(BigInt(item.quantity) * 100n * (reversal ? -1n : 1n)), at, actorId,
        customerId: sale.customerId, productId: item.productId });
      continue;
    }
    const cost = asCents(item.purchaseCostAtSale) * BigInt(item.quantity);
    if (cost === 0n) continue;
    await event(tx, { key: `sale-item:${item.id}:cost:${suffix}`, metric: 'PRODUCT_COST',
      kind: reversal ? 'SALE_REVERSED' : 'SALE_COMPLETED', sourceType: 'SALE_ITEM', sourceId: item.id,
      amount: money(cost * (reversal ? -1n : 1n)), at, actorId,
      customerId: sale.customerId, productId: item.productId });
  }
}

async function inventoryEvent(tx: Tx, input: { key: string; sourceType: string; sourceId: string;
  productId: string; quantityChange: number; unitCost: { toString(): string } | null; at: Date; actorId: string }) {
  if (!input.unitCost || input.quantityChange === 0) return;
  const amount = asCents(input.unitCost) * BigInt(input.quantityChange);
  if (amount === 0n) return;
  await event(tx, { key: input.key, metric: 'INVENTORY_VALUE', kind: input.sourceType,
    sourceType: input.sourceType, sourceId: input.sourceId, amount: money(amount),
    at: input.at, actorId: input.actorId, productId: input.productId });
}

async function stockAndSale(tx: Tx, input: ReturnType<typeof saleInput>, actorId: string, at: Date,
  settlementSource: 'DIRECT_CASH' | 'REPLACEMENT_NETTED', key?: string, fp?: string) {
  const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
  if (!customer || customer.status !== 'ACTIVE') throw new ApiError(409, 'CUSTOMER_INACTIVE', 'Active customer required');
  const products = new Map<string, Awaited<ReturnType<Tx['product']['findUnique']>>>();
  for (const item of [...input.items].sort((a, b) => a.productId.localeCompare(b.productId))) {
    const product = await tx.product.findUnique({ where: { id: item.productId } });
    if (!product || product.status !== 'ACTIVE') throw new ApiError(409, 'PRODUCT_INACTIVE', 'Active product required');
    const updated = await tx.product.updateMany({ where: { id: item.productId, status: 'ACTIVE', stockQuantity: { gte: item.quantity } },
      data: { stockQuantity: { decrement: item.quantity }, updatedById: actorId } });
    if (updated.count !== 1) throw new ApiError(409, 'INSUFFICIENT_STOCK', `Insufficient stock for ${product.name}`);
    products.set(item.productId, product);
  }
  const sale = await tx.sale.create({ data: {
    salesCode: await saleCode(tx, at), customerId: input.customerId, totalAmount: money(input.total),
    status: 'COMPLETED', settlementSource, saleDate: at, notes: input.notes,
    requestKey: key, requestFingerprint: fp, createdById: actorId,
    items: { create: input.items.map((item) => ({
      productId: item.productId, productNameAtSale: products.get(item.productId)!.name,
      quantity: item.quantity, sellingPrice: item.sellingPrice,
      purchaseCostAtSale: products.get(item.productId)!.purchasePrice, lineTotal: money(item.line),
    })) },
  }, include: { items: true } });
  await saleEvents(tx, sale, at, actorId, false);
  for (const item of sale.items) await inventoryEvent(tx, { key: `inventory:sale-item:${item.id}`,
    sourceType: 'SALE_ITEM', sourceId: item.id, productId: item.productId,
    quantityChange: -item.quantity, unitCost: item.purchaseCostAtSale, at, actorId });
  return sale;
}

function respondError(res: Response, error: unknown) {
  if (error instanceof ApiError) { res.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
  const code = plain(error) && typeof error.code === 'string' ? error.code : '';
  if (code === 'P2002') { res.status(409).json({ error: { code: 'CONFLICT', message: 'Resource already exists or was changed' } }); return; }
  if (code === 'P2025') { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Record not found' } }); return; }
  if (code === 'P2003') { res.status(400).json({ error: { code: 'INVALID_REFERENCE', message: 'Referenced record not found' } }); return; }
  console.error('Business API error', error instanceof Error ? error.name : 'UnknownError');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Request failed' } });
}
const uniqueError = (error: unknown) => plain(error) && error.code === 'P2002';

export function registerBusinessRoutes(app: Express, prisma: PrismaClient, authenticate: Auth, csrf: Csrf) {
  type Handler = (req: Request, res: Response, session: Session) => Promise<void>;
  const route = (method: 'get' | 'post' | 'patch', path: string, role: 'OWNER' | undefined, handler: Handler) => {
    app[method](path, async (req, res) => {
      const session = await authenticate(req, res, role);
      if (!session) return;
      if (method !== 'get' && !csrf(req, res, session.csrfToken)) return;
      try { await handler(req, res, session); } catch (error) { respondError(res, error); }
    });
  };
  const receiptUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('file');
  const receiptMime = (buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null => {
    if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
    if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
    return null;
  };
  const cloudReady = () => !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

  route('get', '/api/v1/dashboard/summary', 'OWNER', async (req, res, session) => {
    const cashResult = await prisma.financialEvent.aggregate({ _sum: { amount: true }, where: { metric: 'CASH' } });
    const currentCash = Number(cashResult._sum.amount || 0);

    const stockResult = await prisma.product.aggregate({ _sum: { stockQuantity: true }, where: { status: 'ACTIVE' } });
    const totalStock = stockResult._sum.stockQuantity || 0;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const todaySales = await prisma.sale.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: today }, status: 'COMPLETED' } });
    const todaySalesAmount = Number(todaySales._sum.totalAmount || 0);

    const todayCustomOrders = await prisma.customOrder.count({ where: { createdAt: { gte: today } } });

    const recentSales = await prisma.sale.findMany({ take: 5, orderBy: { createdAt: 'desc' }, include: { customer: true, items: true } });
    const recentOrders = await prisma.customOrder.findMany({ take: 5, orderBy: { createdAt: 'desc' }, include: { customer: true } });

    const allActivity = [
      ...recentSales.map(sale => ({
        id: `sale-${sale.id}`, kind: 'sale', title: `Sale ${sale.salesCode}`,
        detail: `${sale.customer?.name} · ${sale.items.reduce((s, i) => s + i.quantity, 0)} items`,
        amount: String(sale.totalAmount), at: sale.createdAt.toISOString()
      })),
      ...recentOrders.map(order => ({
        id: `order-${order.id}`, kind: 'custom_order', title: `Custom order ${order.orderCode}`,
        detail: `${order.customer?.name} · ${order.productName}`,
        amount: String(order.totalPrice), at: order.createdAt.toISOString()
      }))
    ];

    allActivity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    res.json({
      data: {
        stats: [
          { id: 'today-sales', value: todaySalesAmount, trend: [todaySalesAmount] },
          { id: 'today-custom-orders', value: todayCustomOrders, trend: [todayCustomOrders] },
          { id: 'current-cash', value: currentCash, trend: [currentCash] },
          { id: 'total-stock-items', value: totalStock, trend: [totalStock] },
        ],
        activity: allActivity.slice(0, 5)
      },
      meta: { generatedAt: new Date().toISOString() }
    });
  });

  const configureCloud = () => cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });

  const paging = (req: Request) => {
    const page = Number(req.query.page ?? 1), pageSize = Number(req.query.pageSize ?? 25);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw bad('Invalid pagination');
    return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
  };
  const code = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
  const optionalText = (value: unknown, max: number) => value === undefined || value === null || value === '' ? null :
    typeof value === 'string' && value.length <= max ? value.trim() || null : (() => { throw bad(); })();
  const dateOnly = (value: unknown): Date => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw bad('Expected YYYY-MM-DD');
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw bad('Invalid date');
    return date;
  };
  const dateTime = (value: unknown): Date => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) throw bad('Expected ISO datetime');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw bad('Invalid datetime');
    return date;
  };

  route('get', '/api/v1/customers', undefined, async (req, res) => {
    const { page, pageSize, skip, take } = paging(req);
    const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 100) : '';
    const where: Prisma.CustomerWhereInput = search ? { OR: [
      { customerCode: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ] } : {};
    const [rows, total] = await prisma.$transaction([
      prisma.customer.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.customer.count({ where }),
    ]);
    res.json({ data: rows, meta: { page, pageSize, total } });
  });

  route('post', '/api/v1/customers', undefined, async (req, res, session) => {
    const body = req.body;
    if (!plain(body) || !only(body, ['name', 'phone', 'address', 'notes', 'children']) ||
      !string(body.name, 150) || !string(body.phone, 30) ||
      (body.children !== undefined && (!Array.isArray(body.children) || body.children.length > 30))) throw bad();
    const children = (body.children ?? []) as unknown[];
    const parsed = children.map((child) => {
      if (!plain(child) || !only(child, ['name', 'initialClass', 'schoolName', 'registeredDate']) ||
        !string(child.name, 150) || !string(child.schoolName, 255) ||
        !Number.isInteger(child.initialClass) || (child.initialClass as number) < 1 || (child.initialClass as number) > 12 ||
        typeof child.registeredDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(child.registeredDate) ||
        Number.isNaN(Date.parse(child.registeredDate))) throw bad('Invalid child');
      return { name: child.name.trim(), initialClass: child.initialClass as number,
        schoolName: child.schoolName.trim(), registeredDate: new Date(`${child.registeredDate}T00:00:00Z`),
        createdById: session.user.id };
    });
    const result = await prisma.customer.create({ data: {
      customerCode: code('CUS'), name: body.name.trim(), phone: body.phone.trim(),
      address: optionalText(body.address, 5000), notes: optionalText(body.notes, 5000),
      createdById: session.user.id, children: { create: parsed },
    }, include: { children: true } });
    res.status(201).json({ data: result });
  });

  route('get', '/api/v1/customers/:id', undefined, async (req, res) => {
    const id = String(req.params.id);
    if (!uuid(id)) throw bad('Invalid customer ID');
    const row = await prisma.customer.findUnique({ where: { id }, include: { children: true } });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Customer not found');
    res.json({ data: row });
  });

  route('patch', '/api/v1/customers/:id', undefined, async (req, res, session) => {
    const id = String(req.params.id), body = req.body;
    if (!uuid(id) || !plain(body) || !only(body, ['name', 'phone', 'address', 'notes']) || Object.keys(body).length === 0 ||
      (body.name !== undefined && !string(body.name, 150)) || (body.phone !== undefined && !string(body.phone, 30))) throw bad();
    const result = await prisma.customer.update({ where: { id }, data: {
      ...(body.name === undefined ? {} : { name: String(body.name).trim() }),
      ...(body.phone === undefined ? {} : { phone: String(body.phone).trim() }),
      ...(body.address === undefined ? {} : { address: optionalText(body.address, 5000) }),
      ...(body.notes === undefined ? {} : { notes: optionalText(body.notes, 5000) }), updatedById: session.user.id,
    } });
    res.json({ data: result });
  });

  route('patch', '/api/v1/customers/:id/status', 'OWNER', async (req, res, session) => {
    const id = String(req.params.id), body = req.body;
    if (!uuid(id) || !plain(body) || !only(body, ['status']) || !['ACTIVE', 'INACTIVE'].includes(String(body.status))) throw bad();
    const result = await prisma.customer.update({ where: { id }, data: {
      status: body.status as 'ACTIVE' | 'INACTIVE', updatedById: session.user.id,
    } });
    res.json({ data: result });
  });

  route('post', '/api/v1/customers/:id/children', undefined, async (req, res, session) => {
    const customerId = String(req.params.id), body = req.body;
    if (!uuid(customerId) || !plain(body) || !only(body, ['name', 'initialClass', 'schoolName', 'registeredDate']) ||
      !string(body.name, 150) || !string(body.schoolName, 255) || !Number.isInteger(body.initialClass) ||
      (body.initialClass as number) < 1 || (body.initialClass as number) > 12 ||
      typeof body.registeredDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.registeredDate)) throw bad();
    const result = await prisma.child.create({ data: { customerId, name: body.name.trim(),
      initialClass: body.initialClass as number, schoolName: body.schoolName.trim(),
      registeredDate: new Date(`${body.registeredDate}T00:00:00Z`), createdById: session.user.id } });
    res.status(201).json({ data: result });
  });

  route('patch', '/api/v1/children/:id', undefined, async (req, res, session) => {
    const id = String(req.params.id), body = req.body;
    if (!uuid(id) || !plain(body) || !only(body, ['name', 'initialClass', 'schoolName', 'registeredDate']) || !Object.keys(body).length ||
      (body.name !== undefined && !string(body.name, 150)) ||
      (body.schoolName !== undefined && !string(body.schoolName, 255)) ||
      (body.initialClass !== undefined && (!Number.isInteger(body.initialClass) || (body.initialClass as number) < 1 || (body.initialClass as number) > 12)) ||
      (body.registeredDate !== undefined && (typeof body.registeredDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.registeredDate)))) throw bad();
    const result = await prisma.child.update({ where: { id }, data: {
      ...(body.name === undefined ? {} : { name: String(body.name).trim() }),
      ...(body.schoolName === undefined ? {} : { schoolName: String(body.schoolName).trim() }),
      ...(body.initialClass === undefined ? {} : { initialClass: body.initialClass as number }),
      ...(body.registeredDate === undefined ? {} : { registeredDate: new Date(`${body.registeredDate}T00:00:00Z`) }),
      updatedById: session.user.id,
    } });
    res.json({ data: result });
  });

  route('get', '/api/v1/customers/:id/sales', undefined, async (req, res, session) => {
    const customerId = String(req.params.id);
    if (!uuid(customerId)) throw bad('Invalid customer ID');
    const rows = await prisma.sale.findMany({ where: { customerId }, include: { items: true }, orderBy: { saleDate: 'desc' }, take: 100 });
    res.json({ data: rows.map((row) => serializeSale(row, session.user.role === 'OWNER')) });
  });

  route('get', '/api/v1/products', 'OWNER', async (req, res) => {
    const { page, pageSize, skip, take } = paging(req);
    const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 100) : '';
    const where: Prisma.ProductWhereInput = search ? { OR: [
      { productCode: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } },
    ] } : {};
    const [rows, total] = await prisma.$transaction([
      prisma.product.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }), prisma.product.count({ where }),
    ]);
    res.json({ data: rows.map((row) => ({ ...row, purchasePrice: row.purchasePrice?.toString() ?? null })), meta: { page, pageSize, total } });
  });

  route('post', '/api/v1/products', 'OWNER', async (req, res, session) => {
    const body = req.body;
    if (!plain(body) || !only(body, ['name', 'purchasePrice', 'openingStock', 'notes', 'status']) ||
      !string(body.name, 255) || (body.status !== undefined && !['ACTIVE', 'INACTIVE'].includes(String(body.status))) ||
      (body.openingStock !== undefined && (!Number.isInteger(body.openingStock) || (body.openingStock as number) < 0 || (body.openingStock as number) > 100000000))) throw bad();
    const price = body.purchasePrice === undefined || body.purchasePrice === null || body.purchasePrice === '' ? null : money(cents(body.purchasePrice));
    const product = await prisma.$transaction(async (tx) => {
      const row = await tx.product.create({ data: { productCode: code('PRD'), name: String(body.name).trim(),
        purchasePrice: price, stockQuantity: (body.openingStock as number) ?? 0,
        status: (body.status as 'ACTIVE' | 'INACTIVE') ?? 'ACTIVE', notes: optionalText(body.notes, 5000), createdById: session.user.id } });
      if (row.stockQuantity > 0) await tx.stockAdjustment.create({ data: {
        productId: row.id, quantityChange: row.stockQuantity, reason: 'Opening stock', createdById: session.user.id,
      } });
      await inventoryEvent(tx, { key: `inventory:product:${row.id}:opening`, sourceType: 'PRODUCT_OPENING',
        sourceId: row.id, productId: row.id, quantityChange: row.stockQuantity,
        unitCost: row.purchasePrice, at: row.createdAt, actorId: session.user.id });
      return row;
    });
    res.status(201).json({ data: { ...product, purchasePrice: product.purchasePrice?.toString() ?? null } });
  });

  route('get', '/api/v1/products/:id', 'OWNER', async (req, res) => {
    const id = String(req.params.id);
    if (!uuid(id)) throw bad('Invalid product ID');
    const row = await prisma.product.findUnique({ where: { id }, include: {
      stockAdjustments: { orderBy: { createdAt: 'desc' }, take: 100 },
    } });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Product not found');
    res.json({ data: { ...row, purchasePrice: row.purchasePrice?.toString() ?? null } });
  });

  route('patch', '/api/v1/products/:id', 'OWNER', async (req, res, session) => {
    const id = String(req.params.id), body = req.body;
    if (!uuid(id) || !plain(body) || !only(body, ['name', 'purchasePrice', 'notes', 'status']) || !Object.keys(body).length ||
      (body.name !== undefined && !string(body.name, 255)) ||
      (body.status !== undefined && !['ACTIVE', 'INACTIVE'].includes(String(body.status)))) throw bad();
    const price = body.purchasePrice === undefined ? undefined :
      body.purchasePrice === null || body.purchasePrice === '' ? null : money(cents(body.purchasePrice));
    const row = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM products WHERE id = ${id}::uuid FOR UPDATE`;
      const old = await tx.product.findUnique({ where: { id } });
      if (!old) throw new ApiError(404, 'NOT_FOUND', 'Product not found');
      const updated = await tx.product.update({ where: { id }, data: {
        ...(body.name === undefined ? {} : { name: String(body.name).trim() }),
        ...(price === undefined ? {} : { purchasePrice: price }),
        ...(body.notes === undefined ? {} : { notes: optionalText(body.notes, 5000) }),
        ...(body.status === undefined ? {} : { status: body.status as 'ACTIVE' | 'INACTIVE' }),
        updatedById: session.user.id,
      } });
      if (price !== undefined && old.stockQuantity > 0) {
        const difference = (updated.purchasePrice ? asCents(updated.purchasePrice) : 0n) -
          (old.purchasePrice ? asCents(old.purchasePrice) : 0n);
        if (difference !== 0n) await event(tx, { key: `inventory:product:${id}:revalue:${randomUUID()}`,
          metric: 'INVENTORY_VALUE', kind: 'PRODUCT_COST_REVALUED', sourceType: 'PRODUCT', sourceId: id,
          amount: money(difference * BigInt(old.stockQuantity)), at: new Date(), actorId: session.user.id,
          productId: id });
      }
      return updated;
    });
    res.json({ data: { ...row, purchasePrice: row.purchasePrice?.toString() ?? null } });
  });

  route('get', '/api/v1/products/:id/adjustments', 'OWNER', async (req, res) => {
    const productId = String(req.params.id);
    if (!uuid(productId)) throw bad('Invalid product ID');
    const rows = await prisma.stockAdjustment.findMany({ where: { productId }, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ data: rows });
  });

  route('get', '/api/v1/products/:id/stock-history', 'OWNER', async (req, res) => {
    const productId = String(req.params.id);
    if (!uuid(productId)) throw bad('Invalid product ID');
    const [adjustments, items] = await prisma.$transaction([
      prisma.stockAdjustment.findMany({ where: { productId }, orderBy: { createdAt: 'desc' }, take: 1000 }),
      prisma.saleItem.findMany({ where: { productId }, include: { sale: { include: { correctionFrom: true } } }, take: 1000 }),
    ]);
    const rows = [
      ...adjustments.map((a) => ({ at: a.createdAt, sourceType: 'ADJUSTMENT', sourceId: a.id,
        quantityChange: a.quantityChange, reason: a.reason, actorId: a.createdById })),
      ...items.flatMap((item) => [
        { at: item.sale.saleDate, sourceType: 'SALE', sourceId: item.saleId,
          quantityChange: -item.quantity, reason: item.sale.salesCode, actorId: item.sale.createdById },
        ...(item.sale.correctionFrom ? [{ at: item.sale.correctionFrom.correctedAt,
          sourceType: 'SALE_CORRECTION', sourceId: item.sale.correctionFrom.id,
          quantityChange: item.quantity, reason: item.sale.correctionFrom.reason,
          actorId: item.sale.correctionFrom.correctedById }] : []),
      ]),
    ].sort((a, b) => b.at.getTime() - a.at.getTime());
    res.json({ data: rows });
  });

  route('post', '/api/v1/products/:id/adjustments', 'OWNER', async (req, res, session) => {
    const productId = String(req.params.id), body = req.body;
    if (!uuid(productId) || !plain(body) || !only(body, ['quantityChange', 'reason']) ||
      !Number.isInteger(body.quantityChange) || body.quantityChange === 0 ||
      Math.abs(body.quantityChange as number) > 100000000 || !string(body.reason, 2000)) throw bad();
    const key = requestKey(req), fp = fingerprint({ productId, body });
    const replay = await prisma.stockAdjustment.findUnique({ where: { createdById_requestKey: { createdById: session.user.id, requestKey: key } } });
    if (replay) {
      if (replay.requestFingerprint !== fp) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key was used for a different adjustment');
      res.json({ data: replay }); return;
    }
    const delta = body.quantityChange as number;
    const adjustment = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.updateMany({ where: { id: productId,
        ...(delta < 0 ? { stockQuantity: { gte: -delta } } : {}),
      }, data: { stockQuantity: delta > 0 ? { increment: delta } : { decrement: -delta }, updatedById: session.user.id } });
      if (!updated.count) throw new ApiError(409, 'INSUFFICIENT_STOCK', 'Product not found or stock insufficient');
      const adjustment = await tx.stockAdjustment.create({ data: { productId, quantityChange: delta, reason: String(body.reason).trim(),
        createdById: session.user.id, requestKey: key, requestFingerprint: fp } });
      const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      await inventoryEvent(tx, { key: `inventory:adjustment:${adjustment.id}`, sourceType: 'STOCK_ADJUSTMENT',
        sourceId: adjustment.id, productId, quantityChange: delta, unitCost: product.purchasePrice,
        at: adjustment.createdAt, actorId: session.user.id });
      return adjustment;
    });
    res.status(201).json({ data: adjustment });
  });

  route('get', '/api/v1/expense-categories', 'OWNER', async (_req, res) => {
    res.json({ data: await prisma.expenseCategory.findMany({ orderBy: { name: 'asc' } }) });
  });

  route('post', '/api/v1/expense-categories', 'OWNER', async (req, res, session) => {
    const body = req.body;
    if (!plain(body) || !only(body, ['name', 'description']) || !string(body.name, 100)) throw bad();
    const name = body.name.trim();
    const row = await prisma.expenseCategory.create({ data: { name, normalizedName: name.toLocaleLowerCase('en'),
      description: optionalText(body.description, 5000), createdById: session.user.id } });
    res.status(201).json({ data: row });
  });

  route('patch', '/api/v1/expense-categories/:id', 'OWNER', async (req, res, session) => {
    const id = String(req.params.id), body = req.body;
    if (!uuid(id) || !plain(body) || !only(body, ['name', 'description', 'isActive']) || !Object.keys(body).length ||
      (body.name !== undefined && !string(body.name, 100)) ||
      (body.isActive !== undefined && typeof body.isActive !== 'boolean')) throw bad();
    const row = await prisma.expenseCategory.update({ where: { id }, data: {
      ...(body.name === undefined ? {} : { name: String(body.name).trim(), normalizedName: String(body.name).trim().toLocaleLowerCase('en') }),
      ...(body.description === undefined ? {} : { description: optionalText(body.description, 5000) }),
      ...(body.isActive === undefined ? {} : { isActive: body.isActive as boolean }), updatedById: session.user.id,
    } });
    res.json({ data: row });
  });

  route('get', '/api/v1/expenses', 'OWNER', async (req, res) => {
    const { page, pageSize, skip, take } = paging(req);
    const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
    if (categoryId && !uuid(categoryId)) throw bad();
    const where: Prisma.ExpenseWhereInput = categoryId ? { expenseCategoryId: categoryId } : {};
    const [rows, total] = await prisma.$transaction([
      prisma.expense.findMany({ where, include: { category: true }, orderBy: { expenseDate: 'desc' }, skip, take }),
      prisma.expense.count({ where }),
    ]);
    res.json({ data: rows.map((row) => ({ ...row, amount: row.amount.toString() })), meta: { page, pageSize, total } });
  });

  route('post', '/api/v1/expenses', 'OWNER', async (req, res, session) => {
    const body = req.body;
    if (!plain(body) || !only(body, ['categoryId', 'amount', 'expenseDate', 'description']) || !uuid(body.categoryId)) throw bad();
    const amount = money(cents(body.amount)), expenseDate = dateOnly(body.expenseDate);
    const result = await prisma.$transaction(async (tx) => {
      const category = await tx.expenseCategory.findUnique({ where: { id: body.categoryId as string } });
      if (!category?.isActive) throw new ApiError(409, 'CATEGORY_INACTIVE', 'Active category required');
      const row = await tx.expense.create({ data: { expenseCategoryId: category.id, amount, expenseDate,
        description: optionalText(body.description, 5000), createdById: session.user.id } });
      await event(tx, { key: `expense:${row.id}`, metric: 'EXPENSE', kind: 'EXPENSE_RECORDED', sourceType: 'EXPENSE',
        sourceId: row.id, amount, at: row.createdAt, businessDay: expenseDate, actorId: session.user.id, categoryId: category.id });
      return row;
    });
    res.status(201).json({ data: { ...result, amount: result.amount.toString() } });
  });

  route('patch', '/api/v1/expenses/:id', 'OWNER', async (req, res, session) => {
    const id = String(req.params.id), body = req.body;
    if (!uuid(id) || !plain(body) || !only(body, ['categoryId', 'amount', 'expenseDate', 'description']) || !Object.keys(body).length ||
      (body.categoryId !== undefined && !uuid(body.categoryId))) throw bad();
    const amount = body.amount === undefined ? undefined : money(cents(body.amount));
    const expenseDate = body.expenseDate === undefined ? undefined : dateOnly(body.expenseDate);
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM expenses WHERE id = ${id}::uuid FOR UPDATE`;
      const old = await tx.expense.findUnique({ where: { id } });
      if (!old) throw new ApiError(404, 'NOT_FOUND', 'Expense not found');
      const categoryId = (body.categoryId as string | undefined) ?? old.expenseCategoryId;
      const category = await tx.expenseCategory.findUnique({ where: { id: categoryId } });
      if (!category?.isActive) throw new ApiError(409, 'CATEGORY_INACTIVE', 'Active category required');
      const at = new Date(), revision = randomUUID();
      await event(tx, { key: `expense:${id}:reversal:${revision}`, metric: 'EXPENSE', kind: 'EXPENSE_REVERSED',
        sourceType: 'EXPENSE', sourceId: id, amount: money(-asCents(old.amount)), at, actorId: session.user.id,
        categoryId: old.expenseCategoryId });
      const row = await tx.expense.update({ where: { id }, data: { expenseCategoryId: categoryId,
        ...(amount === undefined ? {} : { amount }), ...(expenseDate === undefined ? {} : { expenseDate }),
        ...(body.description === undefined ? {} : { description: optionalText(body.description, 5000) }),
        updatedById: session.user.id } });
      await event(tx, { key: `expense:${id}:revision:${revision}`, metric: 'EXPENSE', kind: 'EXPENSE_REVISED',
        sourceType: 'EXPENSE', sourceId: id, amount: row.amount.toString(), at, actorId: session.user.id,
        categoryId: row.expenseCategoryId });
      return row;
    });
    res.json({ data: { ...result, amount: result.amount.toString() } });
  });

  route('get', '/api/v1/cash/transactions', 'OWNER', async (req, res) => {
    const { page, pageSize, skip, take } = paging(req);
    const [rows, total] = await prisma.$transaction([
      prisma.cashTransaction.findMany({ orderBy: { ledgerSequence: 'desc' }, skip, take }), prisma.cashTransaction.count(),
    ]);
    res.json({ data: rows.map((row) => ({ ...row, ledgerSequence: row.ledgerSequence.toString(), amount: row.amount.toString() })),
      meta: { page, pageSize, total } });
  });

  route('get', '/api/v1/cash/summary', 'OWNER', async (_req, res) => {
    const balance = await prisma.financialEvent.aggregate({ where: { metric: 'CASH' }, _sum: { amount: true } });
    res.json({ data: { expectedCash: balance._sum.amount?.toString() ?? '0.00' } });
  });

  route('post', '/api/v1/cash/opening', 'OWNER', async (req, res, session) => {
    const body = req.body;
    if (!plain(body) || !only(body, ['amount', 'reason']) || !string(body.reason, 2000)) throw bad();
    const amount = body.amount === '0' || body.amount === '0.00' ? 0n : cents(body.amount);
    const key = requestKey(req), fp = fingerprint(body);
    const replay = await prisma.cashTransaction.findUnique({ where: { createdById_requestKey: { createdById: session.user.id, requestKey: key } } });
    if (replay) {
      if (replay.requestFingerprint !== fp) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key was used for another transaction');
      res.json({ data: { ...replay, ledgerSequence: replay.ledgerSequence.toString(), amount: replay.amount.toString() } }); return;
    }
    const row = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(57489712)) AS cash_lock`;
      const at = new Date();
      const created = await tx.cashTransaction.create({ data: { transactionType: 'OPENING', amount: money(amount),
        referenceType: 'INITIAL_SETUP', reason: String(body.reason).trim(), occurredAt: at,
        createdById: session.user.id, requestKey: key, requestFingerprint: fp } });
      if (amount > 0n) await event(tx, { key: `cash:${created.id}`, metric: 'CASH', kind: 'INITIAL_SETUP',
        sourceType: 'CASH_TRANSACTION', sourceId: created.id, amount: money(amount), at, actorId: session.user.id });
      else await tx.financialEvent.create({ data: { eventKey: `cash:${created.id}`, metric: 'CASH',
        eventKind: 'INITIAL_SETUP', sourceType: 'CASH_TRANSACTION', sourceId: created.id,
        amount: '0.00', businessDate: businessDate(at), occurredAt: at, actorId: session.user.id } });
      return created;
    });
    res.status(201).json({ data: { ...row, ledgerSequence: row.ledgerSequence.toString(), amount: row.amount.toString() } });
  });

  for (const direction of ['in', 'out'] as const) route('post', `/api/v1/cash/${direction}`, 'OWNER', async (req, res, session) => {
    const body = req.body;
    if (!plain(body) || !only(body, ['amount', 'reason']) || !string(body.reason, 2000)) throw bad();
    const amount = cents(body.amount) * (direction === 'out' ? -1n : 1n);
    const key = requestKey(req), fp = fingerprint({ direction, body });
    const replay = await prisma.cashTransaction.findUnique({ where: { createdById_requestKey: { createdById: session.user.id, requestKey: key } } });
    if (replay) {
      if (replay.requestFingerprint !== fp) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key was used for another transaction');
      res.json({ data: { ...replay, ledgerSequence: replay.ledgerSequence.toString(), amount: replay.amount.toString() } }); return;
    }
    const at = new Date();
    const row = await prisma.$transaction(async (tx) => {
      await cash(tx, { amount, referenceType: 'MANUAL', reason: String(body.reason).trim(), at,
        actorId: session.user.id, requestKey: key, requestFingerprint: fp });
      return tx.cashTransaction.findUniqueOrThrow({ where: { createdById_requestKey: { createdById: session.user.id, requestKey: key } } });
    });
    res.status(201).json({ data: { ...row, ledgerSequence: row.ledgerSequence.toString(), amount: row.amount.toString() } });
  });

  route('get', '/api/v1/suppliers', 'OWNER', async (req, res) => {
    const { page, pageSize, skip, take } = paging(req);
    const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 100) : '';
    const where: Prisma.SupplierWhereInput = search ? { OR: [
      { name: { contains: search, mode: 'insensitive' } }, { supplierCode: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ] } : {};
    const [rows, total] = await prisma.$transaction([
      prisma.supplier.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }), prisma.supplier.count({ where }),
    ]);
    res.json({ data: rows, meta: { page, pageSize, total } });
  });

  route('post', '/api/v1/suppliers', 'OWNER', async (req, res, session) => {
    const body = req.body;
    if (!plain(body) || !only(body, ['name', 'phone', 'address', 'notes']) || !string(body.name, 150)) throw bad();
    const row = await prisma.supplier.create({ data: { supplierCode: code('SUP'), name: body.name.trim(),
      phone: optionalText(body.phone, 30), address: optionalText(body.address, 5000),
      notes: optionalText(body.notes, 5000), createdById: session.user.id } });
    res.status(201).json({ data: row });
  });

  route('get', '/api/v1/suppliers/:id', 'OWNER', async (req, res) => {
    const id = String(req.params.id);
    if (!uuid(id)) throw bad('Invalid supplier ID');
    const row = await prisma.supplier.findUnique({ where: { id } });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Supplier not found');
    res.json({ data: row });
  });

  route('patch', '/api/v1/suppliers/:id', 'OWNER', async (req, res, session) => {
    const id = String(req.params.id), body = req.body;
    if (!uuid(id) || !plain(body) || !only(body, ['name', 'phone', 'address', 'notes', 'status']) || !Object.keys(body).length ||
      (body.name !== undefined && !string(body.name, 150)) ||
      (body.status !== undefined && !['ACTIVE', 'INACTIVE'].includes(String(body.status)))) throw bad();
    const row = await prisma.supplier.update({ where: { id }, data: {
      ...(body.name === undefined ? {} : { name: String(body.name).trim() }),
      ...(body.phone === undefined ? {} : { phone: optionalText(body.phone, 30) }),
      ...(body.address === undefined ? {} : { address: optionalText(body.address, 5000) }),
      ...(body.notes === undefined ? {} : { notes: optionalText(body.notes, 5000) }),
      ...(body.status === undefined ? {} : { status: body.status as 'ACTIVE' | 'INACTIVE' }),
      updatedById: session.user.id,
    } });
    res.json({ data: row });
  });

  route('get', '/api/v1/purchases', 'OWNER', async (req, res) => {
    const { page, pageSize, skip, take } = paging(req);
    const [rows, total] = await prisma.$transaction([
      prisma.purchase.findMany({ include: { supplier: true, items: true, payments: true },
        orderBy: { purchaseDate: 'desc' }, skip, take }), prisma.purchase.count(),
    ]);
    res.json({ data: rows.map((row) => ({ ...row, totalAmount: row.totalAmount.toString(),
      items: row.items.map((item) => ({ ...item, quantity: item.quantity.toString(), purchaseCost: item.purchaseCost.toString() })),
      payments: row.payments.map((p) => ({ ...p, amount: p.amount.toString() })) })), meta: { page, pageSize, total } });
  });

  route('post', '/api/v1/purchases', 'OWNER', async (req, res, session) => {
    const body = req.body;
    if (!plain(body) || !only(body, ['supplierId', 'purchaseDate', 'expectedDeliveryDate', 'items', 'notes', 'status']) ||
      !uuid(body.supplierId) || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100 ||
      (body.status !== undefined && !['DRAFT', 'ORDERED'].includes(String(body.status)))) throw bad();
    const date = body.purchaseDate === undefined ? new Date() : dateTime(body.purchaseDate);
    const items = body.items.map((item: unknown) => {
      if (!plain(item) || !only(item, ['itemName', 'quantity', 'purchaseCost', 'description', 'notes']) ||
        !string(item.itemName, 255)) throw bad('Invalid purchase item');
      const quantity = cents(item.quantity), purchaseCost = cents(item.purchaseCost);
      return { itemName: item.itemName.trim(), quantity: money(quantity), purchaseCost: money(purchaseCost),
        description: optionalText(item.description, 5000), notes: optionalText(item.notes, 5000),
        line: (quantity * purchaseCost + 50n) / 100n };
    });
    const total = items.reduce((sum: bigint, item: { line: bigint }) => sum + item.line, 0n);
    if (total <= 0n || total > 999999999999n) throw bad('Invalid purchase total');
    const key = requestKey(req), fp = fingerprint(body);
    const replay = await prisma.purchase.findUnique({ where: { createdById_requestKey: { createdById: session.user.id, requestKey: key } } });
    if (replay) {
      if (replay.requestFingerprint !== fp) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key was used for another purchase');
      res.json({ data: { ...replay, totalAmount: replay.totalAmount.toString() } }); return;
    }
    const purchase = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: body.supplierId as string } });
      if (!supplier || supplier.status !== 'ACTIVE') throw new ApiError(409, 'SUPPLIER_INACTIVE', 'Active supplier required');
      const row = await tx.purchase.create({ data: { purchaseCode: code('P'), supplierId: supplier.id,
        totalAmount: money(total), purchaseDate: date, status: (body.status as 'DRAFT' | 'ORDERED') ?? 'DRAFT',
        notes: optionalText(body.notes, 5000), createdById: session.user.id, requestKey: key, requestFingerprint: fp,
        items: { create: items.map((item: { itemName: string; quantity: string; purchaseCost: string; description: string | null; notes: string | null }) => ({
          itemName: item.itemName, quantity: item.quantity, purchaseCost: item.purchaseCost,
          description: item.description, notes: item.notes,
        })) },
      }, include: { items: true } });
      if (row.status === 'ORDERED') await event(tx, { key: `purchase:${row.id}`, metric: 'PURCHASE', kind: 'PURCHASE_ORDERED',
        sourceType: 'PURCHASE', sourceId: row.id, amount: money(total), at: date,
        actorId: session.user.id, supplierId: supplier.id });
      return row;
    });
    res.status(201).json({ data: { ...purchase, totalAmount: purchase.totalAmount.toString(),
      items: purchase.items.map((item) => ({ ...item, quantity: item.quantity.toString(), purchaseCost: item.purchaseCost.toString() })) } });
  });

  route('get', '/api/v1/purchases/:id', 'OWNER', async (req, res) => {
    const id = String(req.params.id);
    if (!uuid(id)) throw bad('Invalid purchase ID');
    const row = await prisma.purchase.findUnique({ where: { id }, include: { items: true, payments: true, receipts: true, supplier: true } });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Purchase not found');
    res.json({ data: { ...row, totalAmount: row.totalAmount.toString(),
      items: row.items.map((item) => ({ ...item, quantity: item.quantity.toString(), purchaseCost: item.purchaseCost.toString() })),
      payments: row.payments.map((p) => ({ ...p, amount: p.amount.toString() })),
      receipts: row.receipts.map((p) => ({ ...p, sizeBytes: p.sizeBytes.toString() })) } });
  });

  route('post', '/api/v1/purchases/:id/status', 'OWNER', async (req, res, session) => {
    const id = String(req.params.id), body = req.body;
    if (!uuid(id) || !plain(body) || !only(body, ['status']) || !['ORDERED', 'RECEIVED', 'CANCELLED'].includes(String(body.status))) throw bad();
    const row = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM purchases WHERE id = ${id}::uuid FOR UPDATE`;
      const old = await tx.purchase.findUnique({ where: { id }, include: { payments: true } });
      if (!old) throw new ApiError(404, 'NOT_FOUND', 'Purchase not found');
      const status = body.status as 'ORDERED' | 'RECEIVED' | 'CANCELLED';
      if (!((old.status === 'DRAFT' && ['ORDERED', 'CANCELLED'].includes(status)) ||
        (old.status === 'ORDERED' && status === 'RECEIVED'))) throw new ApiError(409, 'INVALID_STATUS_TRANSITION', 'Invalid purchase transition');
      if (status === 'CANCELLED' && old.payments.length) throw new ApiError(409, 'PURCHASE_HAS_PAYMENTS', 'Paid purchase cannot be cancelled');
      const updated = await tx.purchase.update({ where: { id }, data: { status, updatedById: session.user.id } });
      if (status === 'ORDERED') await event(tx, { key: `purchase:${id}`, metric: 'PURCHASE', kind: 'PURCHASE_ORDERED',
        sourceType: 'PURCHASE', sourceId: id, amount: old.totalAmount.toString(), at: new Date(),
        actorId: session.user.id, supplierId: old.supplierId });
      return updated;
    });
    res.json({ data: { ...row, totalAmount: row.totalAmount.toString() } });
  });

  route('get', '/api/v1/purchases/:id/payments', 'OWNER', async (req, res) => {
    const purchaseId = String(req.params.id);
    if (!uuid(purchaseId)) throw bad();
    const rows = await prisma.supplierPayment.findMany({ where: { purchaseId }, orderBy: { paymentDate: 'desc' } });
    res.json({ data: rows.map((row) => ({ ...row, amount: row.amount.toString() })) });
  });

  route('post', '/api/v1/purchases/:id/payments', 'OWNER', async (req, res, session) => {
    const purchaseId = String(req.params.id), body = req.body;
    if (!uuid(purchaseId) || !plain(body) || !only(body, ['amount', 'notes']) ||
      (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string')) throw bad();
    const amount = cents(body.amount), key = requestKey(req), fp = fingerprint({ purchaseId, body });
    const replay = await prisma.supplierPayment.findUnique({ where: { createdById_requestKey: { createdById: session.user.id, requestKey: key } } });
    if (replay) {
      if (replay.requestFingerprint !== fp) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key was used for another payment');
      res.json({ data: { ...replay, amount: replay.amount.toString() } }); return;
    }
    const payment = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM purchases WHERE id = ${purchaseId}::uuid FOR UPDATE`;
      const purchase = await tx.purchase.findUnique({ where: { id: purchaseId }, include: { payments: true } });
      if (!purchase) throw new ApiError(404, 'NOT_FOUND', 'Purchase not found');
      if (!['ORDERED', 'RECEIVED'].includes(purchase.status)) throw new ApiError(409, 'INVALID_STATUS_TRANSITION', 'Purchase is not payable');
      const paid = purchase.payments.reduce((sum, row) => sum + asCents(row.amount), 0n);
      if (paid + amount > asCents(purchase.totalAmount)) throw new ApiError(409, 'OVERPAYMENT', 'Payment exceeds outstanding due');
      const at = new Date();
      const row = await tx.supplierPayment.create({ data: { purchaseId, supplierId: purchase.supplierId,
        amount: money(amount), paymentDate: at, notes: optionalText(body.notes, 5000),
        createdById: session.user.id, requestKey: key, requestFingerprint: fp } });
      await event(tx, { key: `supplier-payment:${row.id}`, metric: 'SUPPLIER_PAYMENT', kind: 'PAYMENT_RECORDED',
        sourceType: 'SUPPLIER_PAYMENT', sourceId: row.id, amount: money(amount), at,
        actorId: session.user.id, supplierId: purchase.supplierId });
      return row;
    });
    res.status(201).json({ data: { ...payment, amount: payment.amount.toString() } });
  });

  route('get', '/api/v1/purchases/:id/receipts', 'OWNER', async (req, res) => {
    const purchaseId = String(req.params.id);
    if (!uuid(purchaseId)) throw bad();
    const rows = await prisma.purchaseReceipt.findMany({ where: { purchaseId }, orderBy: { createdAt: 'desc' } });
    res.json({ data: rows.map((row) => ({ id: row.id, purchaseId: row.purchaseId,
      supplierPaymentId: row.supplierPaymentId, fileName: row.fileName, mimeType: row.mimeType,
      sizeBytes: row.sizeBytes.toString(), createdAt: row.createdAt, uploadedById: row.uploadedById })) });
  });

  app.post('/api/v1/purchases/:id/receipts', async (req, res) => {
    const session = await authenticate(req, res, 'OWNER');
    if (!session || !csrf(req, res, session.csrfToken)) return;
    const purchaseId = String(req.params.id);
    if (!uuid(purchaseId)) { respondError(res, bad('Invalid purchase ID')); return; }
    if (!cloudReady()) { respondError(res, new ApiError(503, 'UPLOAD_UNAVAILABLE', 'Cloudinary is not configured')); return; }
    receiptUpload(req, res, async (uploadError) => {
      if (uploadError) { respondError(res, bad('Receipt must be an image up to 5 MB')); return; }
      try {
        if (!req.file || !req.file.buffer.length) throw bad('Receipt image is required');
        const mimeType = receiptMime(req.file.buffer);
        if (!mimeType || req.file.mimetype !== mimeType) throw bad('Only JPEG, PNG or WebP images are supported');
        const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
        if (!purchase) throw new ApiError(404, 'NOT_FOUND', 'Purchase not found');
        const paymentId = req.body?.supplierPaymentId;
        if (paymentId !== undefined) {
          if (!uuid(paymentId)) throw bad('Invalid payment ID');
          const payment = await prisma.supplierPayment.findUnique({ where: { id: paymentId } });
          if (!payment || payment.purchaseId !== purchaseId) throw bad('Payment does not belong to purchase');
        }
        configureCloud();
        const uploaded = await new Promise<{ public_id: string }>((resolve, reject) => {
          const prefix = process.env.CLOUDINARY_PREFIX === 'production' ? 'production' : 'pilot';
          const stream = cloudinary.uploader.upload_stream({ folder: `ni-fashion/${prefix}/purchase-receipts`,
            type: 'authenticated', resource_type: 'image', overwrite: false, unique_filename: true }, (error, result) => {
            if (error || !result) reject(error ?? new Error('Cloudinary upload failed'));
            else resolve(result);
          });
          stream.end(req.file!.buffer);
        });
        try {
          const row = await prisma.purchaseReceipt.create({ data: { purchaseId,
            supplierPaymentId: paymentId === undefined ? null : paymentId,
            storageKey: uploaded.public_id, fileName: req.file.originalname.slice(0, 255),
            mimeType, sizeBytes: BigInt(req.file.size), uploadedById: session.user.id } });
          res.status(201).json({ data: { id: row.id, purchaseId: row.purchaseId,
            fileName: row.fileName, mimeType: row.mimeType, sizeBytes: row.sizeBytes.toString() } });
        } catch (error) {
          await cloudinary.uploader.destroy(uploaded.public_id, { type: 'authenticated', resource_type: 'image' })
            .catch(() => console.error('Cloudinary orphan cleanup failed'));
          throw error;
        }
      } catch (error) { respondError(res, error); }
    });
  });

  route('get', '/api/v1/receipts/:id/content', 'OWNER', async (req, res) => {
    const id = String(req.params.id);
    if (!uuid(id)) throw bad('Invalid receipt ID');
    const row = await prisma.purchaseReceipt.findUnique({ where: { id } });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Receipt not found');
    if (!cloudReady()) throw new ApiError(503, 'UPLOAD_UNAVAILABLE', 'Cloudinary is not configured');
    configureCloud();
    const format = row.mimeType === 'image/png' ? 'png' : row.mimeType === 'image/webp' ? 'webp' : 'jpg';
    const signedUrl = cloudinary.utils.private_download_url(row.storageKey, format, {
      type: 'authenticated', resource_type: 'image', expires_at: Math.floor(Date.now() / 1000) + 300,
      attachment: true,
    });
    res.redirect(302, signedUrl);
  });

  route('get', '/api/v1/custom-orders', undefined, async (req, res) => {
    const { page, pageSize, skip, take } = paging(req);
    const [rows, total] = await prisma.$transaction([
      prisma.customOrder.findMany({ include: { customer: true, payments: true }, orderBy: { orderDate: 'desc' }, skip, take }),
      prisma.customOrder.count(),
    ]);
    res.json({ data: rows.map((row) => ({ ...row, totalPrice: row.totalPrice.toString(),
      paid: money(row.payments.reduce((sum, payment) => sum + asCents(payment.amount), 0n)),
      due: row.status === 'CANCELLED' ? '0.00' : money(asCents(row.totalPrice) - row.payments.reduce((sum, payment) => sum + asCents(payment.amount), 0n)),
      payments: row.payments.map((payment) => ({ ...payment, amount: payment.amount.toString() })) })),
      meta: { page, pageSize, total } });
  });

  route('post', '/api/v1/custom-orders', undefined, async (req, res, session) => {
    const body = req.body;
    if (!plain(body) || !only(body, ['customerId', 'productName', 'description', 'quantity', 'totalPrice',
      'expectedDeliveryDate', 'notes', 'advanceAmount']) || !uuid(body.customerId) || !string(body.productName, 255) ||
      !Number.isInteger(body.quantity) || (body.quantity as number) < 1 || (body.quantity as number) > 100000) throw bad();
    const total = cents(body.totalPrice), dueDate = dateOnly(body.expectedDeliveryDate);
    const advance = body.advanceAmount === undefined || body.advanceAmount === '0' || body.advanceAmount === '0.00'
      ? 0n : cents(body.advanceAmount);
    if (advance > total) throw new ApiError(409, 'OVERPAYMENT', 'Advance exceeds order total');
    const key = requestKey(req), fp = fingerprint(body);
    const replay = await prisma.customOrder.findUnique({ where: { createdById_requestKey: { createdById: session.user.id, requestKey: key } },
      include: { payments: true } });
    if (replay) {
      if (replay.requestFingerprint !== fp) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key was used for another order');
      res.json({ data: { ...replay, totalPrice: replay.totalPrice.toString(),
        payments: replay.payments.map((p) => ({ ...p, amount: p.amount.toString() })) } }); return;
    }
    const at = new Date();
    const order = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: body.customerId as string } });
      if (!customer || customer.status !== 'ACTIVE') throw new ApiError(409, 'CUSTOMER_INACTIVE', 'Active customer required');
      const row = await tx.customOrder.create({ data: { orderCode: code('CO'), customerId: customer.id,
        productName: String(body.productName).trim(), description: optionalText(body.description, 5000),
        quantity: body.quantity as number, totalPrice: money(total), expectedDeliveryDate: dueDate,
        orderDate: at, notes: optionalText(body.notes, 5000), createdById: session.user.id,
        requestKey: key, requestFingerprint: fp } });
      await event(tx, { key: `custom-order:${row.id}:value`, metric: 'CUSTOM_ORDER_VALUE', kind: 'ORDER_CREATED',
        sourceType: 'CUSTOM_ORDER', sourceId: row.id, amount: money(total), at, actorId: session.user.id,
        customerId: customer.id });
      if (advance > 0n) {
        const payment = await tx.customOrderPayment.create({ data: { customOrderId: row.id, amount: money(advance),
          paymentDate: at, createdById: session.user.id } });
        await event(tx, { key: `order-payment:${payment.id}`, metric: 'CUSTOM_ORDER_PAYMENT', kind: 'PAYMENT_RECORDED',
          sourceType: 'CUSTOM_ORDER_PAYMENT', sourceId: payment.id, amount: money(advance), at,
          actorId: session.user.id, customerId: customer.id });
        await cash(tx, { amount: advance, referenceType: 'CUSTOM_ORDER_PAYMENT', referenceId: payment.id,
          reason: `Custom order advance ${row.orderCode}`, at, actorId: session.user.id });
      }
      return tx.customOrder.findUniqueOrThrow({ where: { id: row.id }, include: { payments: true } });
    });
    res.status(201).json({ data: { ...order, totalPrice: order.totalPrice.toString(),
      payments: order.payments.map((p) => ({ ...p, amount: p.amount.toString() })) } });
  });

  route('get', '/api/v1/custom-orders/:id', undefined, async (req, res) => {
    const id = String(req.params.id);
    if (!uuid(id)) throw bad('Invalid order ID');
    const row = await prisma.customOrder.findUnique({ where: { id }, include: { payments: true, customer: true } });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Order not found');
    const paid = row.payments.reduce((sum, payment) => sum + asCents(payment.amount), 0n);
    res.json({ data: { ...row, totalPrice: row.totalPrice.toString(), paid: money(paid),
      due: row.status === 'CANCELLED' ? '0.00' : money(asCents(row.totalPrice) - paid),
      payments: row.payments.map((payment) => ({ ...payment, amount: payment.amount.toString() })) } });
  });

  route('patch', '/api/v1/custom-orders/:id', 'OWNER', async (req, res, session) => {
    const id = String(req.params.id), body = req.body;
    if (!uuid(id) || !plain(body) || !only(body, ['productName', 'description', 'quantity', 'totalPrice', 'expectedDeliveryDate', 'notes']) ||
      !Object.keys(body).length || (body.productName !== undefined && !string(body.productName, 255)) ||
      (body.quantity !== undefined && (!Number.isInteger(body.quantity) || (body.quantity as number) < 1 || (body.quantity as number) > 100000))) throw bad();
    const newTotal = body.totalPrice === undefined ? undefined : cents(body.totalPrice);
    const dueDate = body.expectedDeliveryDate === undefined ? undefined : dateOnly(body.expectedDeliveryDate);
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM custom_orders WHERE id = ${id}::uuid FOR UPDATE`;
      const old = await tx.customOrder.findUnique({ where: { id }, include: { payments: true } });
      if (!old) throw new ApiError(404, 'NOT_FOUND', 'Order not found');
      if (old.status === 'CANCELLED' || old.status === 'DELIVERED')
        throw new ApiError(409, 'INVALID_STATUS_TRANSITION', 'Completed or cancelled order cannot be edited');
      const paid = old.payments.reduce((sum, payment) => sum + asCents(payment.amount), 0n);
      if (newTotal !== undefined && newTotal < paid) throw new ApiError(409, 'OVERPAYMENT', 'Total cannot be lower than paid amount');
      const at = new Date();
      const row = await tx.customOrder.update({ where: { id }, data: {
        ...(body.productName === undefined ? {} : { productName: String(body.productName).trim() }),
        ...(body.description === undefined ? {} : { description: optionalText(body.description, 5000) }),
        ...(body.quantity === undefined ? {} : { quantity: body.quantity as number }),
        ...(newTotal === undefined ? {} : { totalPrice: money(newTotal) }),
        ...(dueDate === undefined ? {} : { expectedDeliveryDate: dueDate }),
        ...(body.notes === undefined ? {} : { notes: optionalText(body.notes, 5000) }), updatedById: session.user.id,
      } });
      if (newTotal !== undefined && newTotal !== asCents(old.totalPrice)) await event(tx, {
        key: `custom-order:${id}:revision:${randomUUID()}`, metric: 'CUSTOM_ORDER_VALUE', kind: 'ORDER_VALUE_REVISED',
        sourceType: 'CUSTOM_ORDER', sourceId: id, amount: money(newTotal - asCents(old.totalPrice)), at,
        actorId: session.user.id, customerId: old.customerId });
      return row;
    });
    res.json({ data: { ...result, totalPrice: result.totalPrice.toString() } });
  });

  route('get', '/api/v1/customers/:id/orders', undefined, async (req, res) => {
    const customerId = String(req.params.id);
    if (!uuid(customerId)) throw bad();
    const rows = await prisma.customOrder.findMany({ where: { customerId }, include: { payments: true }, orderBy: { orderDate: 'desc' } });
    res.json({ data: rows.map((row) => ({ ...row, totalPrice: row.totalPrice.toString(),
      paid: money(row.payments.reduce((sum, payment) => sum + asCents(payment.amount), 0n)) })) });
  });

  route('get', '/api/v1/customers/:id/due', undefined, async (req, res) => {
    const customerId = String(req.params.id);
    if (!uuid(customerId)) throw bad();
    const rows = await prisma.customOrder.findMany({ where: { customerId, status: { not: 'CANCELLED' } }, include: { payments: true } });
    const due = rows.reduce((sum, row) => sum + asCents(row.totalPrice) - row.payments.reduce((paid, p) => paid + asCents(p.amount), 0n), 0n);
    res.json({ data: { customerId, due: money(due) } });
  });

  route('post', '/api/v1/custom-orders/:id/payments', undefined, async (req, res, session) => {
    const customOrderId = String(req.params.id), body = req.body;
    if (!uuid(customOrderId) || !plain(body) || !only(body, ['amount', 'notes'])) throw bad();
    const amount = cents(body.amount), key = requestKey(req), fp = fingerprint({ customOrderId, body });
    const replay = await prisma.customOrderPayment.findUnique({ where: { createdById_requestKey: { createdById: session.user.id, requestKey: key } } });
    if (replay) {
      if (replay.requestFingerprint !== fp) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key was used for another payment');
      res.json({ data: { ...replay, amount: replay.amount.toString() } }); return;
    }
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM custom_orders WHERE id = ${customOrderId}::uuid FOR UPDATE`;
      const order = await tx.customOrder.findUnique({ where: { id: customOrderId }, include: { payments: true } });
      if (!order) throw new ApiError(404, 'NOT_FOUND', 'Order not found');
      if (order.status === 'CANCELLED') throw new ApiError(409, 'CANCELLED_ORDER', 'Cannot pay a cancelled order');
      const paid = order.payments.reduce((sum, payment) => sum + asCents(payment.amount), 0n);
      if (paid + amount > asCents(order.totalPrice)) throw new ApiError(409, 'OVERPAYMENT', 'Payment exceeds due');
      const at = new Date();
      const payment = await tx.customOrderPayment.create({ data: { customOrderId, amount: money(amount),
        notes: optionalText(body.notes, 5000), paymentDate: at, createdById: session.user.id,
        requestKey: key, requestFingerprint: fp } });
      await event(tx, { key: `order-payment:${payment.id}`, metric: 'CUSTOM_ORDER_PAYMENT', kind: 'PAYMENT_RECORDED',
        sourceType: 'CUSTOM_ORDER_PAYMENT', sourceId: payment.id, amount: money(amount), at,
        actorId: session.user.id, customerId: order.customerId });
      await cash(tx, { amount, referenceType: 'CUSTOM_ORDER_PAYMENT', referenceId: payment.id,
        reason: `Custom order payment ${order.orderCode}`, at, actorId: session.user.id });
      return payment;
    });
    res.status(201).json({ data: { ...result, amount: result.amount.toString() } });
  });

  for (const action of ['ready', 'deliver', 'cancel'] as const) route('post', `/api/v1/custom-orders/:id/${action}`, undefined,
    async (req, res, session) => {
      const id = String(req.params.id);
      if (!uuid(id)) throw bad();
      const body = req.body ?? {};
      if (!plain(body) || !only(body, action === 'cancel' ? ['reason'] : []) ||
        (action === 'cancel' && !string(body.reason, 2000))) throw bad();
      const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM custom_orders WHERE id = ${id}::uuid FOR UPDATE`;
        const order = await tx.customOrder.findUnique({ where: { id }, include: { payments: true } });
        if (!order) throw new ApiError(404, 'NOT_FOUND', 'Order not found');
        if ((action === 'ready' && order.status !== 'PENDING') ||
          (action === 'deliver' && order.status !== 'READY') ||
          (action === 'cancel' && !['PENDING', 'READY'].includes(order.status)))
          throw new ApiError(409, 'INVALID_STATUS_TRANSITION', 'Invalid order status transition');
        const paid = order.payments.reduce((sum, payment) => sum + asCents(payment.amount), 0n);
        if (action === 'deliver' && paid !== asCents(order.totalPrice))
          throw new ApiError(409, 'ORDER_DUE', 'Delivery requires zero due');
        const at = new Date();
        const row = await tx.customOrder.update({ where: { id }, data: {
          status: action === 'ready' ? 'READY' : action === 'deliver' ? 'DELIVERED' : 'CANCELLED',
          statusChangedAt: at, statusChangedById: session.user.id, updatedById: session.user.id,
          ...(action === 'ready' ? { readyAt: at, readyById: session.user.id } : {}),
          ...(action === 'deliver' ? { deliveredAt: at, deliveredById: session.user.id, deliveryDate: at } : {}),
          ...(action === 'cancel' ? { cancelledAt: at, cancelledById: session.user.id, notes: [order.notes, String(body.reason).trim()].filter(Boolean).join('\n') } : {}),
        } });
        if (action === 'cancel' && asCents(order.totalPrice) > paid)
          await event(tx, { key: `custom-order:${id}:cancelled`, metric: 'CUSTOM_ORDER_VALUE', kind: 'ORDER_CANCELLED_DUE',
            sourceType: 'CUSTOM_ORDER', sourceId: id, amount: money(-(asCents(order.totalPrice) - paid)), at,
            actorId: session.user.id, customerId: order.customerId });
        return row;
      });
      res.json({ data: { ...result, totalPrice: result.totalPrice.toString() } });
    });

  route('get', '/api/v1/raw-materials', 'OWNER', async (req, res) => {
    const { page, pageSize, skip, take } = paging(req);
    const [rows, total] = await prisma.$transaction([
      prisma.rawMaterial.findMany({ orderBy: { date: 'desc' }, skip, take }), prisma.rawMaterial.count(),
    ]);
    res.json({ data: rows.map((row) => ({ ...row, quantity: row.quantity.toString(),
      purchaseCost: row.purchaseCost?.toString() ?? null })), meta: { page, pageSize, total } });
  });

  route('post', '/api/v1/raw-materials', 'OWNER', async (req, res, session) => {
    const body = req.body;
    if (!plain(body) || !only(body, ['itemName', 'quantity', 'description', 'date', 'purchaseCost']) || !string(body.itemName, 255)) throw bad();
    const quantity = money(cents(body.quantity)), date = dateOnly(body.date);
    const purchaseCost = body.purchaseCost === undefined || body.purchaseCost === null || body.purchaseCost === '' ? null : money(cents(body.purchaseCost));
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.rawMaterial.create({ data: { itemName: String(body.itemName).trim(), quantity,
        description: optionalText(body.description, 5000), date, purchaseCost, createdById: session.user.id } });
      if (purchaseCost) await event(tx, { key: `raw-material:${created.id}`, metric: 'RAW_MATERIAL_COST',
        kind: 'RAW_MATERIAL_RECORDED', sourceType: 'RAW_MATERIAL', sourceId: created.id,
        amount: purchaseCost, at: created.createdAt, businessDay: date, actorId: session.user.id });
      return created;
    });
    res.status(201).json({ data: { ...row, quantity: row.quantity.toString(), purchaseCost: row.purchaseCost?.toString() ?? null } });
  });

  route('patch', '/api/v1/raw-materials/:id', 'OWNER', async (req, res, session) => {
    const id = String(req.params.id), body = req.body;
    if (!uuid(id) || !plain(body) || !only(body, ['itemName', 'quantity', 'description', 'date', 'purchaseCost']) ||
      !Object.keys(body).length || (body.itemName !== undefined && !string(body.itemName, 255))) throw bad();
    const quantity = body.quantity === undefined ? undefined : money(cents(body.quantity));
    const date = body.date === undefined ? undefined : dateOnly(body.date);
    const purchaseCost = body.purchaseCost === undefined ? undefined :
      body.purchaseCost === null || body.purchaseCost === '' ? null : money(cents(body.purchaseCost));
    const row = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM raw_materials WHERE id = ${id}::uuid FOR UPDATE`;
      const old = await tx.rawMaterial.findUnique({ where: { id } });
      if (!old) throw new ApiError(404, 'NOT_FOUND', 'Raw material not found');
      const at = new Date(), revision = randomUUID();
      if (old.purchaseCost && asCents(old.purchaseCost) > 0n) await event(tx, {
        key: `raw-material:${id}:reversal:${revision}`, metric: 'RAW_MATERIAL_COST', kind: 'RAW_MATERIAL_REVERSED',
        sourceType: 'RAW_MATERIAL', sourceId: id, amount: money(-asCents(old.purchaseCost)), at, actorId: session.user.id });
      const updated = await tx.rawMaterial.update({ where: { id }, data: {
        ...(body.itemName === undefined ? {} : { itemName: String(body.itemName).trim() }),
        ...(quantity === undefined ? {} : { quantity }), ...(date === undefined ? {} : { date }),
        ...(purchaseCost === undefined ? {} : { purchaseCost }),
        ...(body.description === undefined ? {} : { description: optionalText(body.description, 5000) }),
        updatedById: session.user.id,
      } });
      if (updated.purchaseCost && asCents(updated.purchaseCost) > 0n) await event(tx, {
        key: `raw-material:${id}:revision:${revision}`, metric: 'RAW_MATERIAL_COST', kind: 'RAW_MATERIAL_REVISED',
        sourceType: 'RAW_MATERIAL', sourceId: id, amount: updated.purchaseCost.toString(), at, actorId: session.user.id });
      return updated;
    });
    res.json({ data: { ...row, quantity: row.quantity.toString(), purchaseCost: row.purchaseCost?.toString() ?? null } });
  });

  route('get', '/api/v1/cash/reconciliations', 'OWNER', async (req, res) => {
    const { page, pageSize, skip, take } = paging(req);
    const [rows, total] = await prisma.$transaction([
      prisma.cashReconciliation.findMany({ orderBy: { countedAt: 'desc' }, skip, take }),
      prisma.cashReconciliation.count(),
    ]);
    res.json({ data: rows.map((row) => ({ ...row, expectedCash: row.expectedCash.toString(),
      physicalCash: row.physicalCash.toString(), difference: row.difference.toString(),
      ledgerSequenceAtCount: row.ledgerSequenceAtCount.toString() })), meta: { page, pageSize, total } });
  });

  route('post', '/api/v1/cash/reconciliations', 'OWNER', async (req, res, session) => {
    const body = req.body;
    if (!plain(body) || !only(body, ['physicalCash', 'notes'])) throw bad();
    const physicalCash = body.physicalCash === '0' || body.physicalCash === '0.00' ? 0n : cents(body.physicalCash);
    const key = requestKey(req), fp = fingerprint(body);
    const replay = await prisma.cashReconciliation.findUnique({ where: { reconciledById_requestKey: { reconciledById: session.user.id, requestKey: key } } });
    if (replay) {
      if (replay.requestFingerprint !== fp) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key was used for another count');
      res.json({ data: { ...replay, expectedCash: replay.expectedCash.toString(), physicalCash: replay.physicalCash.toString(),
        difference: replay.difference.toString(), ledgerSequenceAtCount: replay.ledgerSequenceAtCount.toString() } }); return;
    }
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(57489712)) AS cash_lock`;
      const balance = await tx.financialEvent.aggregate({ where: { metric: 'CASH' }, _sum: { amount: true } });
      const latest = await tx.cashTransaction.findFirst({ orderBy: { ledgerSequence: 'desc' } });
      const expected = balance._sum.amount ? asCents(balance._sum.amount) : 0n;
      const at = new Date();
      return tx.cashReconciliation.create({ data: { businessDate: businessDate(at), countedAt: at,
        expectedCash: money(expected), physicalCash: money(physicalCash), difference: money(physicalCash - expected),
        ledgerSequenceAtCount: latest?.ledgerSequence ?? 0n, notes: optionalText(body.notes, 5000),
        reconciledById: session.user.id, requestKey: key, requestFingerprint: fp } });
    });
    res.status(201).json({ data: { ...result, expectedCash: result.expectedCash.toString(),
      physicalCash: result.physicalCash.toString(), difference: result.difference.toString(),
      ledgerSequenceAtCount: result.ledgerSequenceAtCount.toString() } });
  });

  route('post', '/api/v1/cash/reconciliations/:id/adjustment', 'OWNER', async (req, res, session) => {
    const id = String(req.params.id), body = req.body;
    if (!uuid(id) || !plain(body) || !only(body, ['reason']) || !string(body.reason, 2000)) throw bad();
    const row = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(57489712)) AS cash_lock`;
      await tx.$queryRaw`SELECT id FROM cash_reconciliations WHERE id = ${id}::uuid FOR UPDATE`;
      const observation = await tx.cashReconciliation.findUnique({ where: { id } });
      if (!observation) throw new ApiError(404, 'NOT_FOUND', 'Reconciliation not found');
      if (observation.adjustmentTransactionId) throw new ApiError(409, 'ADJUSTMENT_ALREADY_APPLIED', 'Adjustment already applied');
      const difference = asCents(observation.difference);
      if (difference === 0n) throw new ApiError(409, 'NO_DIFFERENCE', 'Matched count needs no adjustment');
      const latest = await tx.cashTransaction.findFirst({ orderBy: { ledgerSequence: 'desc' } });
      if ((latest?.ledgerSequence ?? 0n) !== observation.ledgerSequenceAtCount)
        throw new ApiError(409, 'STALE_RECONCILIATION', 'Cash ledger changed; recount required');
      const at = new Date();
      const transaction = await tx.cashTransaction.create({ data: { transactionType: 'CASH_ADJUSTMENT',
        amount: money(difference), referenceType: 'RECONCILIATION', referenceId: id,
        reason: String(body.reason).trim(), occurredAt: at, createdById: session.user.id } });
      await event(tx, { key: `cash:${transaction.id}`, metric: 'CASH', kind: 'RECONCILIATION',
        sourceType: 'CASH_TRANSACTION', sourceId: transaction.id, amount: money(difference),
        at, actorId: session.user.id });
      await tx.cashReconciliation.update({ where: { id }, data: { adjustmentTransactionId: transaction.id } });
      return transaction;
    });
    res.status(201).json({ data: { ...row, ledgerSequence: row.ledgerSequence.toString(), amount: row.amount.toString() } });
  });

  route('get', '/api/v1/catalog/products', undefined, async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 100) : '';
    const rows = await prisma.product.findMany({ where: { status: 'ACTIVE', ...(search ? { OR: [
      { name: { contains: search, mode: 'insensitive' } }, { productCode: { contains: search, mode: 'insensitive' } },
    ] } : {}) }, orderBy: { name: 'asc' }, take: 100 });
    res.json({ data: rows.map((row) => ({ id: row.id, productCode: row.productCode, name: row.name, stockQuantity: row.stockQuantity })) });
  });

  route('get', '/api/v1/sales', undefined, async (req, res, session) => {
    const page = Number(req.query.page ?? 1), pageSize = Number(req.query.pageSize ?? 25);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw bad('Invalid pagination');
    const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 100) : '';
    const where: Prisma.SaleWhereInput = search ? { OR: [
      { salesCode: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
    ] } : {};
    const [rows, total] = await prisma.$transaction([
      prisma.sale.findMany({ where, include: { items: true }, orderBy: { saleDate: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.sale.count({ where }),
    ]);
    res.json({ data: rows.map((row) => serializeSale(row, session.user.role === 'OWNER')), meta: { page, pageSize, total } });
  });

  route('get', '/api/v1/sales/:id', undefined, async (req, res, session) => {
    const id = String(req.params.id);
    if (!uuid(id)) throw bad('Invalid sale ID');
    const sale = await prisma.sale.findUnique({ where: { id }, include: { items: true, correctionFrom: true, correctionInto: true } });
    if (!sale) throw new ApiError(404, 'NOT_FOUND', 'Sale not found');
    res.json({ data: { ...serializeSale(sale, session.user.role === 'OWNER'),
      correction: sale.correctionFrom ? { kind: sale.correctionFrom.kind, replacementSaleId: sale.correctionFrom.replacementSaleId,
        correctedAt: sale.correctionFrom.correctedAt } : null,
      replacementOfSaleId: sale.correctionInto?.originalSaleId ?? null } });
  });

  route('post', '/api/v1/sales', undefined, async (req, res, session) => {
    const input = saleInput(req.body, false);
    const key = requestKey(req), fp = fingerprint(req.body);
    const replay = await prisma.sale.findUnique({ where: { createdById_requestKey: { createdById: session.user.id, requestKey: key } }, include: { items: true } });
    if (replay) {
      if (replay.requestFingerprint !== fp) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key was used for a different request');
      res.status(200).json({ data: serializeSale(replay, session.user.role === 'OWNER') }); return;
    }
    const at = new Date();
    let sale;
    try {
      sale = await prisma.$transaction(async (tx) => {
        const created = await stockAndSale(tx, input, session.user.id, at, 'DIRECT_CASH', key, fp);
        await cash(tx, { amount: input.total, referenceType: 'SALE', referenceId: created.id,
          reason: `Sale ${created.salesCode}`, at, actorId: session.user.id });
        return created;
      });
    } catch (error) {
      if (uniqueError(error)) {
        const winner = await prisma.sale.findUnique({ where: { createdById_requestKey: {
          createdById: session.user.id, requestKey: key,
        } }, include: { items: true } });
        if (winner?.requestFingerprint === fp) { res.json({ data: serializeSale(winner, session.user.role === 'OWNER') }); return; }
        if (winner) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key was used for a different request');
      }
      throw error;
    }
    res.status(201).json({ data: serializeSale(sale, session.user.role === 'OWNER') });
  });

  async function correction(req: Request, res: Response, session: Session, kind: 'VOID' | 'REPLACE') {
    const saleId = String(req.params.id);
    if (!uuid(saleId)) throw bad('Invalid sale ID');
    const key = requestKey(req), fp = fingerprint({ kind, saleId, body: req.body });
    const body = req.body;
    let replacement: ReturnType<typeof saleInput> | null = null;
    if (kind === 'REPLACE') replacement = saleInput(body, true);
    else if (!plain(body) || !only(body, ['reason', 'goodsReturnedConfirmed', 'fullRefundConfirmed']) ||
      !string(body.reason, 2000) || body.goodsReturnedConfirmed !== true || body.fullRefundConfirmed !== true)
      throw bad('Reason and full return/refund confirmations are required');
    const existing = await prisma.saleCorrection.findUnique({ where: { correctedById_requestKey: {
      correctedById: session.user.id, requestKey: key,
    } } });
    if (existing) {
      if (existing.requestFingerprint !== fp) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key was used for a different correction');
      res.json({ data: { id: existing.id, kind: existing.kind, originalSaleId: existing.originalSaleId,
        replacementSaleId: existing.replacementSaleId, cashDelta: existing.cashDelta.toString() } }); return;
    }
    const at = new Date();
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM sales WHERE id = ${saleId}::uuid FOR UPDATE`;
      const replay = await tx.saleCorrection.findUnique({ where: { correctedById_requestKey: {
        correctedById: session.user.id, requestKey: key,
      } } });
      if (replay) {
        if (replay.requestFingerprint !== fp) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key was used for a different correction');
        return replay;
      }
      const original = await tx.sale.findUnique({ where: { id: saleId }, include: { items: true, correctionFrom: true } });
      if (!original) throw new ApiError(404, 'NOT_FOUND', 'Sale not found');
      if (original.status !== 'COMPLETED' || original.correctionFrom)
        throw new ApiError(409, 'SALE_ALREADY_CORRECTED', 'Sale is voided or superseded');
      const originalTotal = asCents(original.totalAmount);
      const delta = replacement ? replacement.total - originalTotal : -originalTotal;
      if (replacement && delta !== 0n && !replacement.confirmed)
        throw bad('Cash difference settlement confirmation is required');
      const affectedProducts = [...new Set([
        ...original.items.map((item) => item.productId), ...(replacement?.items.map((item) => item.productId) ?? []),
      ])].sort();
      for (const productId of affectedProducts)
        await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
      for (const item of [...original.items].sort((a, b) => a.productId.localeCompare(b.productId))) {
        const restoredProduct = await tx.product.update({ where: { id: item.productId }, data: {
          stockQuantity: { increment: item.quantity }, updatedById: session.user.id,
        } });
        await inventoryEvent(tx, { key: `inventory:correction:${saleId}:restore:${item.productId}`,
          sourceType: 'SALE_RESTORED', sourceId: saleId, productId: item.productId,
          quantityChange: item.quantity, unitCost: restoredProduct.purchasePrice,
          at, actorId: session.user.id });
      }
      const newSale = replacement ? await stockAndSale(tx, replacement, session.user.id, at, 'REPLACEMENT_NETTED') : null;
      await tx.sale.update({ where: { id: saleId }, data: { status: 'VOIDED', updatedById: session.user.id } });
      const created = await tx.saleCorrection.create({ data: {
        kind, originalSaleId: saleId, replacementSaleId: newSale?.id,
        originalTotal: money(originalTotal), replacementTotal: newSale ? money(replacement!.total) : null,
        cashDelta: money(delta), reason: kind === 'VOID' ? String(body.reason).trim() : replacement!.reason!,
        correctedById: session.user.id, correctedAt: at, requestKey: key, requestFingerprint: fp,
      } });
      await saleEvents(tx, original, at, session.user.id, true, created.id);
      if (delta !== 0n) await cash(tx, { amount: delta, referenceType: 'SALE_CORRECTION', referenceId: created.id,
        reason: `Sale ${kind === 'VOID' ? 'void' : 'replacement'}: ${created.reason}`, at, actorId: session.user.id });
      return created;
    });
    res.status(201).json({ data: { id: result.id, kind: result.kind, originalSaleId: result.originalSaleId,
      replacementSaleId: result.replacementSaleId, cashDelta: result.cashDelta.toString() } });
  }

  route('post', '/api/v1/sales/:id/void', 'OWNER', (req, res, session) => correction(req, res, session, 'VOID'));
  route('post', '/api/v1/sales/:id/replace', 'OWNER', (req, res, session) => correction(req, res, session, 'REPLACE'));

  route('get', '/api/v1/financial-events', 'OWNER', async (req, res) => {
    const metric = typeof req.query.metric === 'string' ? req.query.metric : undefined;
    const allowed = ['SALES_REVENUE', 'SALES_PRODUCT_REVENUE', 'PRODUCT_COST', 'UNKNOWN_COST_COUNT', 'INVENTORY_VALUE', 'CASH', 'EXPENSE', 'PURCHASE', 'SUPPLIER_PAYMENT', 'CUSTOM_ORDER_VALUE', 'CUSTOM_ORDER_PAYMENT', 'RAW_MATERIAL_COST'];
    if (metric && !allowed.includes(metric)) throw bad('Unsupported financial metric');
    const page = Number(req.query.page ?? 1), pageSize = Number(req.query.pageSize ?? 100);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw bad('Invalid pagination');
    const rows = await prisma.financialEvent.findMany({ where: metric ? { metric } : {},
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize });
    res.json({ data: rows.map((row) => ({ ...row, amount: row.amount.toString() })), meta: { page, pageSize } });
  });

  const reportTypes = new Set([
    'sales-summary', 'sales-monthly', 'sales-by-product', 'sales-list',
    'custom-order-status', 'custom-order-dues', 'custom-order-payments',
    'inventory-current', 'stock-adjustments', 'customer-list',
    'supplier-totals', 'supplier-purchases', 'supplier-dues', 'supplier-payments',
    'raw-materials', 'expenses-list', 'expenses-monthly', 'expenses-yearly', 'expenses-by-category',
    'cash-opening', 'cash-in', 'cash-out', 'cash-adjustments', 'cash-expected', 'profit',
  ]);

  route('get', '/api/v1/reports/:type', 'OWNER', async (req, res) => {
    const type = String(req.params.type);
    if (!reportTypes.has(type)) throw new ApiError(404, 'NOT_FOUND', 'Report not found');
    const from = req.query.from === undefined ? undefined : dateOnly(req.query.from);
    const to = req.query.to === undefined ? undefined : dateOnly(req.query.to);
    if (from && to && from > to) throw bad('Invalid date range');
    if (type === 'inventory-current' && (from || to)) throw bad('Current inventory does not support historical dates');
    const dateWhere = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    const metricFor = (): string[] => {
      if (type.startsWith('sales-')) return type === 'sales-by-product' ? ['SALES_PRODUCT_REVENUE'] : ['SALES_REVENUE'];
      if (type === 'profit') return ['SALES_PRODUCT_REVENUE', 'PRODUCT_COST', 'UNKNOWN_COST_COUNT'];
      if (type === 'custom-order-dues') return ['CUSTOM_ORDER_VALUE', 'CUSTOM_ORDER_PAYMENT'];
      if (type === 'custom-order-payments') return ['CUSTOM_ORDER_PAYMENT'];
      if (type.startsWith('supplier-')) return ['PURCHASE', 'SUPPLIER_PAYMENT'];
      if (type.startsWith('expenses-')) return ['EXPENSE'];
      if (type.startsWith('cash-')) return ['CASH'];
      if (type === 'raw-materials') return ['RAW_MATERIAL_COST'];
      if (type === 'inventory-current') return ['INVENTORY_VALUE'];
      return [];
    };
    const metrics = metricFor();
    const snapshotDue = type === 'custom-order-dues' || type === 'supplier-dues' || type === 'inventory-current';
    const events = metrics.length ? await prisma.financialEvent.findMany({ where: {
      metric: { in: metrics }, ...(snapshotDue ? (to ? { businessDate: { lte: to } } : {}) :
        from || to ? { businessDate: dateWhere } : {}),
    }, orderBy: [{ businessDate: 'asc' }, { occurredAt: 'asc' }, { id: 'asc' }], take: 10001 }) : [];
    if (events.length > 10000) throw new ApiError(400, 'REPORT_RANGE_TOO_LARGE', 'Narrow the date range');
    const rows = events.map((e) => ({ id: e.id, metric: e.metric, kind: e.eventKind, sourceId: e.sourceId,
      amount: e.amount.toString(), businessDate: e.businessDate.toISOString().slice(0, 10),
      occurredAt: e.occurredAt, customerId: e.customerId, productId: e.productId,
      supplierId: e.supplierId, categoryId: e.categoryId }));
    const total = (filtered: typeof events) => money(filtered.reduce((sum, row) => sum + asCents(row.amount), 0n));
    const group = (filtered: typeof events, key: (row: typeof events[number]) => string) => {
      const buckets = new Map<string, bigint>();
      for (const item of filtered) buckets.set(key(item), (buckets.get(key(item)) ?? 0n) + asCents(item.amount));
      return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([bucket, amount]) => ({ bucket, amount: money(amount) }));
    };
    const metric = (name: string) => events.filter((e) => e.metric === name);
    let result: unknown = { rows, summary: { total: total(events) } };
    if (type === 'sales-summary' || type === 'sales-monthly') {
      const granularity = type === 'sales-monthly' ? 'month' :
        ['day', 'week', 'month', 'year'].includes(String(req.query.groupBy)) ? String(req.query.groupBy) : 'day';
      const period = (date: Date) => {
        const day = date.toISOString().slice(0, 10);
        if (granularity === 'year') return day.slice(0, 4);
        if (granularity === 'month') return day.slice(0, 7);
        if (granularity === 'week') {
          const monday = new Date(date);
          monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
          return monday.toISOString().slice(0, 10);
        }
        return day;
      };
      result = { rows: group(events, (e) => period(e.businessDate)), summary: { total: total(events), granularity } };
    } else if (type === 'sales-by-product' || type === 'profit') {
      const ids = [...new Set(events.map((e) => e.productId).filter((id): id is string => !!id))];
      const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, productCode: true, name: true } });
      const names = new Map(products.map((p) => [p.id, p]));
      const grouped = new Map<string, { revenue: bigint; cost: bigint; unknown: bigint }>();
      for (const e of events) {
        const id = e.productId ?? 'unknown';
        const bucket = grouped.get(id) ?? { revenue: 0n, cost: 0n, unknown: 0n };
        if (e.metric === 'SALES_PRODUCT_REVENUE') bucket.revenue += asCents(e.amount);
        if (e.metric === 'PRODUCT_COST') bucket.cost += asCents(e.amount);
        if (e.metric === 'UNKNOWN_COST_COUNT') bucket.unknown += asCents(e.amount);
        grouped.set(id, bucket);
      }
      result = { rows: [...grouped].map(([productId, amounts]) => ({ productId,
        productCode: names.get(productId)?.productCode ?? null, name: names.get(productId)?.name ?? null,
        revenue: money(amounts.revenue), ...(type === 'profit' ? {
          knownCost: money(amounts.cost), knownProfit: money(amounts.revenue - amounts.cost),
          unknownCostQuantity: Number(amounts.unknown / 100n), complete: amounts.unknown === 0n,
        } : {}) })), summary: { revenue: money([...grouped.values()].reduce((sum, row) => sum + row.revenue, 0n)) } };
    } else if (type === 'custom-order-status') {
      const statuses = await prisma.customOrder.groupBy({ by: ['status'], _count: { id: true } });
      result = { rows: statuses.map((row) => ({ status: row.status, count: row._count.id })) };
    } else if (type === 'custom-order-dues') {
      const payments = await prisma.customOrderPayment.findMany({ where: { id: { in: metric('CUSTOM_ORDER_PAYMENT').map((e) => e.sourceId) } },
        select: { id: true, customOrderId: true } });
      const orderByPayment = new Map(payments.map((p) => [p.id, p.customOrderId]));
      const balances = new Map<string, { value: bigint; paid: bigint }>();
      for (const e of events) {
        const orderId = e.metric === 'CUSTOM_ORDER_VALUE' ? e.sourceId : orderByPayment.get(e.sourceId);
        if (!orderId) continue;
        const current = balances.get(orderId) ?? { value: 0n, paid: 0n };
        if (e.metric === 'CUSTOM_ORDER_VALUE') current.value += asCents(e.amount);
        else current.paid += asCents(e.amount);
        balances.set(orderId, current);
      }
      result = { rows: [...balances].map(([orderId, value]) => ({ orderId, total: money(value.value),
        paid: money(value.paid), due: money(value.value - value.paid) })),
        summary: { due: money([...balances.values()].reduce((sum, row) => sum + row.value - row.paid, 0n)) } };
    } else if (type === 'supplier-totals' || type === 'supplier-dues') {
      const ids = [...new Set(events.map((e) => e.supplierId).filter((id): id is string => !!id))];
      const suppliers = await prisma.supplier.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, supplierCode: true } });
      const names = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
      const purchase = new Map<string, bigint>(), payments = new Map<string, bigint>();
      for (const e of events) {
        if (!e.supplierId) continue;
        const map = e.metric === 'PURCHASE' ? purchase : payments;
        map.set(e.supplierId, (map.get(e.supplierId) ?? 0n) + asCents(e.amount));
      }
      result = { rows: ids.map((id) => ({ supplierId: id, supplierCode: names.get(id)?.supplierCode,
        name: names.get(id)?.name, purchases: money(purchase.get(id) ?? 0n), paid: money(payments.get(id) ?? 0n),
        due: money((purchase.get(id) ?? 0n) - (payments.get(id) ?? 0n)) })) };
    } else if (type === 'supplier-purchases' || type === 'supplier-payments') {
      const selected = metric(type === 'supplier-purchases' ? 'PURCHASE' : 'SUPPLIER_PAYMENT');
      result = { rows: selected.map((e) => ({ sourceId: e.sourceId, supplierId: e.supplierId,
        amount: e.amount.toString(), date: e.businessDate.toISOString().slice(0, 10) })), summary: { total: total(selected) } };
    } else if (type === 'custom-order-payments' || type === 'expenses-list' || type === 'raw-materials' || type === 'sales-list') {
      result = { rows, summary: { total: total(events) } };
    } else if (type === 'expenses-monthly' || type === 'expenses-yearly') {
      result = { rows: group(events, (e) => e.businessDate.toISOString().slice(0, type === 'expenses-monthly' ? 7 : 4)),
        summary: { total: total(events) } };
    } else if (type === 'expenses-by-category') {
      result = { rows: group(events, (e) => e.categoryId ?? 'unknown'), summary: { total: total(events) } };
    } else if (type === 'cash-opening' || type === 'cash-in' || type === 'cash-out' || type === 'cash-adjustments') {
      const filtered = events.filter((e) => type === 'cash-opening' ? e.eventKind === 'INITIAL_SETUP' :
        type === 'cash-adjustments' ? e.eventKind === 'RECONCILIATION' :
        type === 'cash-in' ? asCents(e.amount) > 0n && e.eventKind !== 'INITIAL_SETUP' && e.eventKind !== 'RECONCILIATION' :
        asCents(e.amount) < 0n && e.eventKind !== 'RECONCILIATION');
      result = { rows: filtered.map((e) => ({ sourceId: e.sourceId, kind: e.eventKind, amount: e.amount.toString(),
        date: e.businessDate.toISOString().slice(0, 10) })), summary: { total: total(filtered) } };
    } else if (type === 'cash-expected') {
      const lifetime = await prisma.financialEvent.aggregate({ where: { metric: 'CASH', ...(to ? { businessDate: { lte: to } } : {}) }, _sum: { amount: true } });
      result = { rows: group(events, (e) => e.businessDate.toISOString().slice(0, 10)),
        summary: { expectedCash: lifetime._sum.amount?.toString() ?? '0.00', periodMovement: total(events) } };
    } else if (type === 'inventory-current') {
      const products = await prisma.product.findMany({ orderBy: { name: 'asc' }, take: 10000 });
      const valuations = new Map<string, bigint>();
      for (const e of events) if (e.productId)
        valuations.set(e.productId, (valuations.get(e.productId) ?? 0n) + asCents(e.amount));
      result = { rows: products.map((p) => ({ productId: p.id, productCode: p.productCode, name: p.name,
        stockQuantity: p.stockQuantity, purchaseCost: p.purchasePrice?.toString() ?? null,
        estimatedValue: p.purchasePrice ? money(valuations.get(p.id) ?? 0n) : null })) };
    } else if (type === 'stock-adjustments') {
      result = { rows: await prisma.stockAdjustment.findMany({ orderBy: { createdAt: 'desc' }, take: 10000 }) };
    } else if (type === 'customer-list') {
      result = { rows: await prisma.customer.findMany({ orderBy: { name: 'asc' }, take: 10000 }) };
    }
    res.json({ data: { type, ...result as object } });
  });

  route('get', '/api/v1/dashboard', 'OWNER', async (_req, res) => {
    const metrics = ['SALES_REVENUE', 'CASH', 'EXPENSE', 'PRODUCT_COST'];
    const values = await Promise.all(metrics.map((metric) => prisma.financialEvent.aggregate({
      where: { metric }, _sum: { amount: true },
    })));
    res.json({ data: Object.fromEntries(metrics.map((metric, index) => [metric, values[index]._sum.amount?.toString() ?? '0.00'])) });
  });
}
