import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { hashPassword } from './security.js';

const testUrl = process.env.NI_API_BUSINESS_TEST_DATABASE_URL;

test('atomic sale correction, net settlement and immutable financial events', { skip: !testUrl }, async () => {
  const parsed = new URL(testUrl!);
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname));
  assert.equal(parsed.pathname, '/ni_fashion_backend_test');
  process.env.DATABASE_URL = testUrl;
  const [{ prisma }, { createApp }] = await Promise.all([import('./db.js'), import('./app.js')]);
  const suffix = Date.now().toString(36);
  const user = await prisma.user.create({ data: {
    username: `sale_test_${suffix}`, name: 'Sale Test Owner', role: 'OWNER',
    passwordHash: await hashPassword('test-only-password'),
  } });
  const customer = await prisma.customer.create({ data: {
    customerCode: `C-${suffix}`, name: 'Sale Test Customer', phone: '01700000000', createdById: user.id,
  } });
  const product = await prisma.product.create({ data: {
    productCode: `P-${suffix}`, name: 'Sale Test Product', stockQuantity: 10,
    purchasePrice: '200.00', createdById: user.id,
  } });
  const server = createApp(prisma).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  try {
    const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, password: 'test-only-password' }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    const { data: { csrfToken } } = await login.json() as { data: { csrfToken: string } };
    let requestNumber = 0;
    async function post(path: string, body: object, key?: string) {
      const response = await fetch(`${base}${path}`, { method: 'POST', headers: {
        Cookie: cookie, 'X-CSRF-Token': csrfToken, 'Idempotency-Key': key ?? `test-${suffix}-${++requestNumber}`,
        'Content-Type': 'application/json',
      }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() as { data?: Record<string, unknown>; error?: { code: string } } };
    }
    const item = (price: string, quantity = 1) => ({ productId: product.id, quantity, sellingPrice: price });
    const first = await post('/sales', { customerId: customer.id, items: [item('1000.00')] });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const s1 = first.body.data!.id as string;
    const employee = await prisma.user.create({ data: { username: `sale_employee_${suffix}`, name: 'Sale Test Employee',
      role: 'EMPLOYEE', passwordHash: await hashPassword('test-only-password') } });
    const employeeLogin = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: employee.username, password: 'test-only-password' }) });
    assert.equal(employeeLogin.status, 200);
    const employeeCookie = employeeLogin.headers.get('set-cookie')!.split(';')[0];
    const { data: { csrfToken: employeeCsrf } } = await employeeLogin.json() as { data: { csrfToken: string } };
    const employeeSale = await fetch(`${base}/sales/${s1}`, { headers: { Cookie: employeeCookie } });
    assert.equal(employeeSale.status, 200);
    const employeeSaleBody = await employeeSale.json() as { data: { items: Array<Record<string, unknown>> } };
    assert.equal(employeeSaleBody.data.items[0].purchaseCostAtSale, undefined);
    const employeeReport = await fetch(`${base}/reports/profit`, { headers: { Cookie: employeeCookie } });
    assert.equal(employeeReport.status, 403);
    const employeeVoid = await fetch(`${base}/sales/${s1}/void`, { method: 'POST', headers: { Cookie: employeeCookie,
      'X-CSRF-Token': employeeCsrf, 'Idempotency-Key': `employee-${suffix}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Not permitted', goodsReturnedConfirmed: true, fullRefundConfirmed: true }) });
    assert.equal(employeeVoid.status, 403);
    const correctionBody = { reason: 'Correct price', customerId: customer.id, items: [item('700.00')],
      cashDifferenceSettledConfirmed: true };
    const replacement = await post(`/sales/${s1}/replace`, correctionBody, `replace-${suffix}`);
    assert.equal(replacement.status, 201, JSON.stringify(replacement.body));
    assert.equal(replacement.body.data!.cashDelta, '-300');
    const s2 = replacement.body.data!.replacementSaleId as string;
    const replay = await post(`/sales/${s1}/replace`, correctionBody, `replace-${suffix}`);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.data!.replacementSaleId, s2);
    const stale = await post(`/sales/${s1}/replace`, correctionBody);
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error!.code, 'SALE_ALREADY_CORRECTED');
    const samePrice = await post(`/sales/${s2}/replace`, { ...correctionBody, reason: 'Correct customer note' });
    assert.equal(samePrice.status, 201, JSON.stringify(samePrice.body));
    assert.equal(samePrice.body.data!.cashDelta, '0');
    const s3 = samePrice.body.data!.replacementSaleId as string;
    const zeroCorrection = await prisma.saleCorrection.findUnique({ where: { replacementSaleId: s3 } });
    assert.ok(zeroCorrection);
    assert.equal(await prisma.cashTransaction.count({ where: { referenceType: 'SALE_CORRECTION', referenceId: zeroCorrection.id } }), 0);
    const refund = await post(`/sales/${s3}/void`, { reason: 'Full return', goodsReturnedConfirmed: true, fullRefundConfirmed: true });
    assert.equal(refund.status, 201, JSON.stringify(refund.body));
    assert.equal(refund.body.data!.cashDelta, '-700');
    const cashRows = await prisma.cashTransaction.findMany({ where: { OR: [
      { referenceType: 'SALE', referenceId: s1 },
      { referenceType: 'SALE_CORRECTION', referenceId: { in: [replacement.body.data!.id as string,
        samePrice.body.data!.id as string, refund.body.data!.id as string] } },
    ] } });
    const cashNet = cashRows.reduce((sum, row) => sum + (row.transactionType === 'CASH_OUT' ? -Number(row.amount) : Number(row.amount)), 0);
    assert.equal(cashNet, 0);
    const saleEvents = await prisma.financialEvent.findMany({ where: { metric: 'SALES_REVENUE', sourceId: { in: [s1, s2, s3] } } });
    assert.equal(saleEvents.reduce((sum, row) => sum + Number(row.amount), 0), 0);
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockQuantity, 10);
    assert.equal((await prisma.sale.findUniqueOrThrow({ where: { id: s3 } })).status, 'VOIDED');
    await assert.rejects(prisma.financialEvent.update({ where: { id: saleEvents[0].id }, data: { amount: '1.00' } }));
    await assert.rejects(prisma.financialEvent.delete({ where: { id: saleEvents[0].id } }));

    const lowStock = await prisma.product.create({ data: { productCode: `LOW-${suffix}`, name: 'Low stock',
      stockQuantity: 1, createdById: user.id } });
    const lowSale = await post('/sales', { customerId: customer.id, items: [{ productId: lowStock.id, quantity: 1, sellingPrice: '100.00' }] });
    assert.equal(lowSale.status, 201, JSON.stringify(lowSale.body));
    const lowId = lowSale.body.data!.id as string;
    const failed = await post(`/sales/${lowId}/replace`, { reason: 'Incorrect quantity', customerId: customer.id,
      items: [{ productId: lowStock.id, quantity: 2, sellingPrice: '100.00' }], cashDifferenceSettledConfirmed: true });
    assert.equal(failed.status, 409);
    assert.equal(failed.body.error!.code, 'INSUFFICIENT_STOCK');
    assert.equal((await prisma.sale.findUniqueOrThrow({ where: { id: lowId } })).status, 'COMPLETED');
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: lowStock.id } })).stockQuantity, 0);
    assert.equal(await prisma.saleCorrection.count({ where: { originalSaleId: lowId } }), 0);

    const competingBody = { reason: 'Concurrent price correction', customerId: customer.id,
      items: [{ productId: lowStock.id, quantity: 1, sellingPrice: '90.00' }], cashDifferenceSettledConfirmed: true };
    const competing = await Promise.all([
      post(`/sales/${lowId}/replace`, competingBody),
      post(`/sales/${lowId}/replace`, { ...competingBody, items: [{ productId: lowStock.id, quantity: 1, sellingPrice: '80.00' }] }),
    ]);
    assert.deepEqual(competing.map((result) => result.status).sort(), [201, 409]);
    assert.equal(await prisma.saleCorrection.count({ where: { originalSaleId: lowId } }), 1);

    const highSale = await post('/sales', { customerId: customer.id, items: [item('100.00')] });
    assert.equal(highSale.status, 201);
    const higher = await post(`/sales/${highSale.body.data!.id}/replace`, { reason: 'Correct higher price',
      customerId: customer.id, items: [item('150.00')], cashDifferenceSettledConfirmed: true });
    assert.equal(higher.status, 201, JSON.stringify(higher.body));
    assert.equal(higher.body.data!.cashDelta, '50');
    const higherCash = await prisma.cashTransaction.findFirst({ where: {
      referenceType: 'SALE_CORRECTION', referenceId: higher.body.data!.id as string,
    } });
    assert.equal(higherCash?.transactionType, 'CASH_IN');

    const cashFailureSale = await post('/sales', { customerId: customer.id, items: [item('200.00')] });
    assert.equal(cashFailureSale.status, 201);
    const cashFailureId = cashFailureSale.body.data!.id as string;
    const beforeFailureStock = (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockQuantity;
    const beforeFailureSales = await prisma.sale.count();
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION test_reject_correction_cash() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.reference_type = 'SALE_CORRECTION' AND NEW.reason LIKE '%intentional cash failure%'
      THEN RAISE EXCEPTION 'intentional cash failure'; END IF; RETURN NEW; END; $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER test_reject_correction_cash_trigger BEFORE INSERT ON cash_transactions
      FOR EACH ROW EXECUTE FUNCTION test_reject_correction_cash()`);
    try {
      const rejected = await post(`/sales/${cashFailureId}/replace`, { reason: 'intentional cash failure',
        customerId: customer.id, items: [item('150.00')], cashDifferenceSettledConfirmed: true });
      assert.equal(rejected.status, 500);
      assert.equal((await prisma.sale.findUniqueOrThrow({ where: { id: cashFailureId } })).status, 'COMPLETED');
      assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockQuantity, beforeFailureStock);
      assert.equal(await prisma.sale.count(), beforeFailureSales);
      assert.equal(await prisma.saleCorrection.count({ where: { originalSaleId: cashFailureId } }), 0);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS test_reject_correction_cash_trigger ON cash_transactions');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS test_reject_correction_cash()');
    }

    const historicalProduct = await prisma.product.create({ data: { productCode: `H-${suffix}`, name: 'Historical product',
      stockQuantity: 0, purchasePrice: '20.00', createdById: user.id } });
    const oldAt = new Date('2026-09-30T12:00:00.000Z');
    const oldDay = new Date('2026-09-30T00:00:00.000Z');
    const historical = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({ data: { salesCode: `S-20260930-${randomUUID().slice(0, 8)}`,
        customerId: customer.id, totalAmount: '1000.00', saleDate: oldAt, createdById: user.id,
        items: { create: { productId: historicalProduct.id, productNameAtSale: historicalProduct.name,
          quantity: 1, sellingPrice: '1000.00', purchaseCostAtSale: '20.00', lineTotal: '1000.00' } } },
        include: { items: true } });
      const cashRow = await tx.cashTransaction.create({ data: { transactionType: 'CASH_IN', amount: '1000.00',
        referenceType: 'SALE', referenceId: sale.id, reason: 'Historical sale', occurredAt: oldAt, createdById: user.id } });
      await tx.financialEvent.createMany({ data: [
        { eventKey: `historical:${sale.id}:revenue`, metric: 'SALES_REVENUE', eventKind: 'SALE_COMPLETED',
          sourceType: 'SALE', sourceId: sale.id, amount: '1000.00', businessDate: oldDay,
          occurredAt: oldAt, actorId: user.id, customerId: customer.id },
        { eventKey: `historical:${sale.items[0].id}:revenue`, metric: 'SALES_PRODUCT_REVENUE', eventKind: 'SALE_COMPLETED',
          sourceType: 'SALE_ITEM', sourceId: sale.items[0].id, amount: '1000.00', businessDate: oldDay,
          occurredAt: oldAt, actorId: user.id, customerId: customer.id, productId: historicalProduct.id },
        { eventKey: `historical:${sale.items[0].id}:cost`, metric: 'PRODUCT_COST', eventKind: 'SALE_COMPLETED',
          sourceType: 'SALE_ITEM', sourceId: sale.items[0].id, amount: '20.00', businessDate: oldDay,
          occurredAt: oldAt, actorId: user.id, customerId: customer.id, productId: historicalProduct.id },
        { eventKey: `historical:${cashRow.id}`, metric: 'CASH', eventKind: 'SALE',
          sourceType: 'CASH_TRANSACTION', sourceId: cashRow.id, amount: '1000.00', businessDate: oldDay,
          occurredAt: oldAt, actorId: user.id },
      ] });
      return sale;
    });
    const corrected = await post(`/sales/${historical.id}/replace`, { reason: 'Prior-month correction',
      customerId: customer.id, items: [{ productId: historicalProduct.id, quantity: 1, sellingPrice: '700.00' }],
      cashDifferenceSettledConfirmed: true });
    assert.equal(corrected.status, 201, JSON.stringify(corrected.body));
    const september = await fetch(`${base}/reports/sales-list?from=2026-09-30&to=2026-09-30`, { headers: { Cookie: cookie } });
    assert.equal(september.status, 200);
    const septemberBody = await september.json() as { data: { rows: Array<{ sourceId: string; amount: string }> } };
    assert.ok(septemberBody.data.rows.some((row) => row.sourceId === historical.id && row.amount === '1000'));
    const reversal = await prisma.financialEvent.findFirstOrThrow({ where: { sourceId: historical.id,
      metric: 'SALES_REVENUE', eventKind: 'SALE_REVERSED' } });
    assert.notEqual(reversal.businessDate.toISOString().slice(0, 10), '2026-09-30');
  } finally {
    server.close();
    await once(server, 'close');
    await prisma.$disconnect();
  }
});
