import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Client } from 'pg';

const testDatabaseUrl = process.env.NI_API_TEST_DATABASE_URL;

test('business schema and PostgreSQL invariants', { skip: !testDatabaseUrl }, async () => {
  const parsed = new URL(testDatabaseUrl!);
  assert.ok(['127.0.0.1', 'localhost'].includes(parsed.hostname), 'Tests may only use a local database');
  assert.equal(parsed.pathname, '/ni_fashion', 'Unexpected test database');
  const client = new Client({ connectionString: testDatabaseUrl });
  await client.connect();
  await client.query('BEGIN');

  async function rejectsConstraint(sql: string, values: unknown[], constraint: string, code = '23514') {
    await client.query('SAVEPOINT rejected_write');
    await assert.rejects(
      client.query(sql, values),
      (caught: unknown) => {
        const error = caught as { code?: string; constraint?: string };
        return error.code === code && error.constraint === constraint;
      },
      `Expected ${constraint} to reject the write`,
    );
    await client.query('ROLLBACK TO SAVEPOINT rejected_write');
    await client.query('RELEASE SAVEPOINT rejected_write');
  }

  try {
    const tables = await client.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        AND table_name <> '_prisma_migrations' ORDER BY table_name
    `);
    assert.deepEqual(tables.rows.map((row) => row.table_name), [
      'cash_reconciliations', 'cash_transactions', 'children', 'custom_order_payments',
      'custom_orders', 'customers', 'expense_categories', 'expenses', 'financial_events', 'products',
      'purchase_items', 'purchase_receipts', 'purchases', 'raw_materials', 'sale_corrections',
      'sale_items', 'sales', 'sessions', 'stock_adjustments', 'supplier_payments', 'suppliers', 'users',
    ]);

    const userId = randomUUID();
    const customerId = randomUUID();
    const productId = randomUUID();
    const saleId = randomUUID();
    const supplierId = randomUUID();
    const purchaseId = randomUUID();
    const otherPurchaseId = randomUUID();
    const paymentId = randomUUID();
    const orderId = randomUUID();
    await client.query(`INSERT INTO users (id, username, name, password_hash, role, updated_at)
      VALUES ($1, $2, 'Schema Test', 'test-only-hash', 'OWNER', now())`, [userId, `schema_${Date.now()}`]);
    await client.query(`INSERT INTO customers (id, customer_code, name, phone, created_by, updated_at)
      VALUES ($1, $2, 'Test Customer', '0123456789', $3, now())`, [customerId, `C-${Date.now()}`, userId]);
    await client.query(`INSERT INTO products (id, product_code, name, created_by, updated_at)
      VALUES ($1, $2, 'Test Product', $3, now())`, [productId, `P-${Date.now()}`, userId]);
    await rejectsConstraint(`UPDATE products SET stock_quantity = -1 WHERE id = $1`, [productId], 'ck_products_values');
    await client.query(`INSERT INTO sales (id, sales_code, customer_id, total_amount, sale_date, created_by, updated_at)
      VALUES ($1, $2, $3, 100, now(), $4, now())`, [saleId, `S-${Date.now()}`, customerId, userId]);
    await rejectsConstraint(`INSERT INTO sale_items (id, sale_id, product_id, product_name_at_sale, quantity, selling_price, line_total)
      VALUES ($1, $2, $3, 'Test Product', 2, 50, 99)`, [randomUUID(), saleId, productId], 'ck_sale_items_values');
    await rejectsConstraint(`INSERT INTO expense_categories (id, name, normalized_name, created_by, updated_at)
      VALUES ($1, '  Rent  ', 'wrong', $2, now())`, [randomUUID(), userId], 'ck_expense_category_name');

    const opening = `INSERT INTO cash_transactions
      (id, transaction_type, amount, reference_type, reason, occurred_at, created_by)
      VALUES ($1, 'OPENING', 0, 'INITIAL_SETUP', 'Initial cash', now(), $2)`;
    await client.query(opening, [randomUUID(), userId]);
    await rejectsConstraint(opening, [randomUUID(), userId], 'cash_one_opening', '23505');
    await rejectsConstraint(`INSERT INTO cash_transactions
      (id, transaction_type, amount, reference_type, reason, occurred_at, created_by)
      VALUES ($1, 'CASH_OUT', 10, 'EXPENSE', 'Wrong source', now(), $2)`, [randomUUID(), userId], 'ck_cash_transaction_shape');
    const saleCash = `INSERT INTO cash_transactions
      (id, transaction_type, amount, reference_type, reference_id, reason, occurred_at, created_by)
      VALUES ($1, 'CASH_IN', 100, 'SALE', $2, 'Sale payment', now(), $3)`;
    await client.query(saleCash, [randomUUID(), saleId, userId]);
    await rejectsConstraint(saleCash, [randomUUID(), saleId, userId], 'cash_one_automatic_source', '23505');

    await client.query(`INSERT INTO suppliers (id, supplier_code, name, created_by, updated_at)
      VALUES ($1, $2, 'Test Supplier', $3, now())`, [supplierId, `SUP-${Date.now()}`, userId]);
    await client.query(`INSERT INTO purchases (id, purchase_code, supplier_id, total_amount, purchase_date, created_by, updated_at)
      VALUES ($1, $2, $3, 100, now(), $4, now()), ($5, $6, $3, 50, now(), $4, now())`,
    [purchaseId, `PUR-A-${Date.now()}`, supplierId, userId, otherPurchaseId, `PUR-B-${Date.now()}`]);
    await client.query(`INSERT INTO supplier_payments
      (id, supplier_id, purchase_id, amount, payment_date, created_by)
      VALUES ($1, $2, $3, 20, now(), $4)`, [paymentId, supplierId, purchaseId, userId]);
    await rejectsConstraint(`INSERT INTO purchase_receipts
      (id, purchase_id, supplier_payment_id, storage_key, file_name, mime_type, size_bytes, uploaded_by)
      VALUES ($1, $2, $3, 'key', 'proof.jpg', 'image/jpeg', 100, $4)`,
    [randomUUID(), otherPurchaseId, paymentId, userId], 'purchase_receipts_supplier_payment_id_purchase_id_fkey', '23503');
    await rejectsConstraint(`INSERT INTO purchase_receipts
      (id, purchase_id, storage_key, file_name, mime_type, size_bytes, uploaded_by)
      VALUES ($1, $2, 'key', 'proof.pdf', 'application/pdf', 100, $3)`,
    [randomUUID(), purchaseId, userId], 'ck_receipt_metadata');

    await client.query(`INSERT INTO custom_orders
      (id, order_code, customer_id, product_name, quantity, total_price,
       expected_delivery_date, order_date, created_by, updated_at)
      VALUES ($1, $2, $3, 'Uniform', 1, 100, current_date, now(), $4, now())`,
    [orderId, `ORD-${Date.now()}`, customerId, userId]);
    await rejectsConstraint(`UPDATE custom_orders SET status = 'READY' WHERE id = $1`,
      [orderId], 'ck_order_status_milestones');
    await client.query(`UPDATE custom_orders SET status = 'READY', ready_at = now(), ready_by = $2,
      status_changed_at = now(), status_changed_by = $2 WHERE id = $1`, [orderId, userId]);
    await rejectsConstraint(`INSERT INTO cash_reconciliations
      (id, business_date, counted_at, expected_cash, physical_cash, difference,
       ledger_sequence_at_count, reconciled_by)
      VALUES ($1, current_date, now(), 10, 11, 0, 0, $2)`,
    [randomUUID(), userId], 'ck_reconciliation_values');
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
});
