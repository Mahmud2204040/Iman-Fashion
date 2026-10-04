import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { hashPassword } from './security.js';

const testUrl = process.env.NI_API_BUSINESS_TEST_DATABASE_URL;

test('business APIs post canonical financial events', { skip: !testUrl }, async () => {
  const parsed = new URL(testUrl!);
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname));
  assert.equal(parsed.pathname, '/ni_fashion_backend_test');
  process.env.DATABASE_URL = testUrl;
  const [{ prisma }, { createApp }] = await Promise.all([import('./db.js'), import('./app.js')]);
  const suffix = Date.now().toString(36);
  const owner = await prisma.user.create({ data: { username: `domain_${suffix}`, name: 'Domain Test', role: 'OWNER',
    passwordHash: await hashPassword('test-only-password') } });
  const server = createApp(prisma).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  try {
    const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: owner.username, password: 'test-only-password' }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    const { data: { csrfToken } } = await login.json() as { data: { csrfToken: string } };
    let key = 0;
    async function call(method: 'GET' | 'POST' | 'PATCH', path: string, body?: object) {
      const response = await fetch(`${base}${path}`, { method, headers: { Cookie: cookie, 'X-CSRF-Token': csrfToken,
        'Idempotency-Key': `domain-${suffix}-${++key}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const payload = await response.json() as { data?: Record<string, unknown>; error?: { code: string; message: string } };
      assert.ok(response.status < 400, `${method} ${path}: ${response.status} ${JSON.stringify(payload)}`);
      return payload.data!;
    }
    const customer = await call('POST', '/customers', { name: 'Domain Customer', phone: '01700000001' });
    const product = await call('POST', '/products', { name: 'Domain Product', purchasePrice: '10.00', openingStock: 4 });
    const catalog = await call('GET', '/catalog/products');
    assert.ok((catalog as unknown as Array<{ id: string }>).some((p) => p.id === product.id));
    const order = await call('POST', '/custom-orders', { customerId: customer.id, productName: 'Uniform', quantity: 1,
      totalPrice: '500.00', advanceAmount: '100.00', expectedDeliveryDate: '2026-12-01' });
    await call('POST', `/custom-orders/${order.id}/payments`, { amount: '400.00' });
    await call('POST', `/custom-orders/${order.id}/ready`, {});
    await call('POST', `/custom-orders/${order.id}/deliver`, {});
    const category = await call('POST', '/expense-categories', { name: `Transport ${suffix}` });
    const expense = await call('POST', '/expenses', { categoryId: category.id, amount: '30.00', expenseDate: '2026-10-04' });
    await call('PATCH', `/expenses/${expense.id}`, { amount: '35.00' });
    const supplier = await call('POST', '/suppliers', { name: 'Domain Supplier' });
    const purchase = await call('POST', '/purchases', { supplierId: supplier.id, status: 'ORDERED',
      items: [{ itemName: 'Fabric', quantity: '2.00', purchaseCost: '50.00' }] });
    await call('POST', `/purchases/${purchase.id}/payments`, { amount: '40.00' });
    await call('POST', '/raw-materials', { itemName: 'Fabric stock', quantity: '2.00', purchaseCost: '100.00', date: '2026-10-04' });
    await call('POST', '/cash/in', { amount: '20.00', reason: 'Test manual cash in' });
    const summary = await call('GET', '/cash/summary');
    const count = await call('POST', '/cash/reconciliations', { physicalCash: summary.expectedCash });
    assert.equal(count.difference, '0');
    const reports = [
      'sales-summary', 'sales-monthly', 'sales-by-product', 'sales-list',
      'custom-order-status', 'custom-order-dues', 'custom-order-payments',
      'inventory-current', 'stock-adjustments', 'customer-list',
      'supplier-totals', 'supplier-purchases', 'supplier-dues', 'supplier-payments',
      'raw-materials', 'expenses-list', 'expenses-monthly', 'expenses-yearly', 'expenses-by-category',
      'cash-opening', 'cash-in', 'cash-out', 'cash-adjustments', 'cash-expected', 'profit',
    ];
    for (const type of reports) {
      const report = await call('GET', `/reports/${type}`);
      assert.equal(report.type, type);
    }
    const expenseEvents = await prisma.financialEvent.findMany({ where: { sourceType: 'EXPENSE', sourceId: expense.id } });
    assert.equal(expenseEvents.length, 3);
    assert.equal(expenseEvents.reduce((sum, row) => sum + Number(row.amount), 0), 35);
    const orderEvents = await prisma.financialEvent.findMany({ where: { customerId: customer.id,
      metric: { in: ['CUSTOM_ORDER_VALUE', 'CUSTOM_ORDER_PAYMENT'] } } });
    assert.equal(orderEvents.filter((row) => row.metric === 'CUSTOM_ORDER_PAYMENT').reduce((sum, row) => sum + Number(row.amount), 0), 500);
  } finally {
    server.close();
    await once(server, 'close');
    await prisma.$disconnect();
  }
});
