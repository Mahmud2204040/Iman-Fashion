ALTER TYPE "SaleStatus" ADD VALUE IF NOT EXISTS 'VOIDED';
CREATE TYPE "SaleSettlementSource" AS ENUM ('DIRECT_CASH', 'REPLACEMENT_NETTED');
CREATE TYPE "SaleCorrectionKind" AS ENUM ('VOID', 'REPLACE');

ALTER TABLE "sales" ADD COLUMN "settlement_source" "SaleSettlementSource" NOT NULL DEFAULT 'DIRECT_CASH';

CREATE TABLE "sale_corrections" (
  "id" UUID NOT NULL,
  "kind" "SaleCorrectionKind" NOT NULL,
  "original_sale_id" UUID NOT NULL,
  "replacement_sale_id" UUID,
  "original_total" DECIMAL(12,2) NOT NULL,
  "replacement_total" DECIMAL(12,2),
  "cash_delta" DECIMAL(12,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "corrected_by" UUID NOT NULL,
  "corrected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "request_key" VARCHAR(100) NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL,
  CONSTRAINT "sale_corrections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_sale_correction_shape" CHECK (
    btrim("reason") <> '' AND btrim("request_key") <> '' AND
    "original_total" > 0 AND (
      ("kind" = 'VOID' AND "replacement_sale_id" IS NULL AND "replacement_total" IS NULL
        AND "cash_delta" = -"original_total") OR
      ("kind" = 'REPLACE' AND "replacement_sale_id" IS NOT NULL AND "replacement_total" > 0
        AND "replacement_sale_id" <> "original_sale_id"
        AND "cash_delta" = "replacement_total" - "original_total")
    )
  )
);
CREATE UNIQUE INDEX "sale_corrections_original_sale_id_key" ON "sale_corrections"("original_sale_id");
CREATE UNIQUE INDEX "sale_corrections_replacement_sale_id_key" ON "sale_corrections"("replacement_sale_id");
CREATE UNIQUE INDEX "sale_corrections_corrected_by_request_key_key" ON "sale_corrections"("corrected_by", "request_key");
CREATE INDEX "sale_corrections_corrected_at_idx" ON "sale_corrections"("corrected_at");
ALTER TABLE "sale_corrections" ADD CONSTRAINT "sale_corrections_original_sale_id_fkey" FOREIGN KEY ("original_sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_corrections" ADD CONSTRAINT "sale_corrections_replacement_sale_id_fkey" FOREIGN KEY ("replacement_sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_corrections" ADD CONSTRAINT "sale_corrections_corrected_by_fkey" FOREIGN KEY ("corrected_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cash_transactions" DROP CONSTRAINT "ck_cash_transaction_shape";
ALTER TABLE "cash_transactions" ADD CONSTRAINT "ck_cash_transaction_shape" CHECK (
  btrim("reason") <> '' AND (
    ("transaction_type" = 'OPENING' AND "amount" >= 0 AND "reference_type" = 'INITIAL_SETUP' AND "reference_id" IS NULL)
    OR ("transaction_type" = 'CASH_IN' AND "amount" > 0 AND (
      ("reference_type" = 'MANUAL' AND "reference_id" IS NULL)
      OR ("reference_type" IN ('SALE', 'CUSTOM_ORDER_PAYMENT', 'SALE_CORRECTION') AND "reference_id" IS NOT NULL)))
    OR ("transaction_type" = 'CASH_OUT' AND "amount" > 0 AND (
      ("reference_type" = 'MANUAL' AND "reference_id" IS NULL)
      OR ("reference_type" = 'SALE_CORRECTION' AND "reference_id" IS NOT NULL)))
    OR ("transaction_type" = 'CASH_ADJUSTMENT' AND "amount" <> 0 AND "reference_type" = 'RECONCILIATION' AND "reference_id" IS NOT NULL)
  )
);
DROP INDEX "cash_one_automatic_source";
CREATE UNIQUE INDEX "cash_one_automatic_source" ON "cash_transactions"("reference_type", "reference_id")
  WHERE "reference_type" IN ('SALE', 'CUSTOM_ORDER_PAYMENT', 'SALE_CORRECTION', 'RECONCILIATION');

CREATE TABLE "financial_events" (
  "id" UUID NOT NULL,
  "event_key" VARCHAR(180) NOT NULL,
  "metric" VARCHAR(40) NOT NULL,
  "event_kind" VARCHAR(50) NOT NULL,
  "source_type" VARCHAR(50) NOT NULL,
  "source_id" UUID NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "business_date" DATE NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "actor_id" UUID NOT NULL,
  "customer_id" UUID,
  "product_id" UUID,
  "supplier_id" UUID,
  "category_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_financial_event_shape" CHECK (
    btrim("event_key") <> '' AND btrim("metric") <> '' AND btrim("event_kind") <> ''
    AND btrim("source_type") <> '' AND "amount" <> 0
  )
);
CREATE UNIQUE INDEX "financial_events_event_key_key" ON "financial_events"("event_key");
CREATE INDEX "financial_events_metric_business_date_idx" ON "financial_events"("metric", "business_date");
CREATE INDEX "financial_events_source_type_source_id_idx" ON "financial_events"("source_type", "source_id");
CREATE INDEX "financial_events_customer_id_business_date_idx" ON "financial_events"("customer_id", "business_date");
CREATE INDEX "financial_events_product_id_business_date_idx" ON "financial_events"("product_id", "business_date");
ALTER TABLE "financial_events" ADD CONSTRAINT "financial_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One-time canonical event backfill for data written before the event ledger existed.
INSERT INTO "financial_events" ("id", "event_key", "metric", "event_kind", "source_type", "source_id", "amount", "business_date", "occurred_at", "actor_id", "customer_id")
SELECT gen_random_uuid(), 'sale:' || s.id || ':revenue', 'SALES_REVENUE', 'SALE_COMPLETED', 'SALE', s.id,
  s.total_amount, (s.sale_date AT TIME ZONE 'Asia/Dhaka')::date, s.sale_date, s.created_by, s.customer_id
FROM "sales" s;
INSERT INTO "financial_events" ("id", "event_key", "metric", "event_kind", "source_type", "source_id", "amount", "business_date", "occurred_at", "actor_id", "customer_id", "product_id")
SELECT gen_random_uuid(), 'sale-item:' || si.id || ':cost', 'PRODUCT_COST', 'SALE_COMPLETED', 'SALE_ITEM', si.id,
  si.purchase_cost_at_sale * si.quantity, (s.sale_date AT TIME ZONE 'Asia/Dhaka')::date, s.sale_date, s.created_by, s.customer_id, si.product_id
FROM "sale_items" si JOIN "sales" s ON s.id = si.sale_id
WHERE si.purchase_cost_at_sale IS NOT NULL AND si.purchase_cost_at_sale > 0;
INSERT INTO "financial_events" ("id", "event_key", "metric", "event_kind", "source_type", "source_id", "amount", "business_date", "occurred_at", "actor_id")
SELECT gen_random_uuid(), 'cash:' || c.id, 'CASH', c.reference_type, 'CASH_TRANSACTION', c.id,
  CASE WHEN c.transaction_type = 'CASH_OUT' THEN -c.amount ELSE c.amount END,
  (c.occurred_at AT TIME ZONE 'Asia/Dhaka')::date, c.occurred_at, c.created_by
FROM "cash_transactions" c WHERE c.amount <> 0;
INSERT INTO "financial_events" ("id", "event_key", "metric", "event_kind", "source_type", "source_id", "amount", "business_date", "occurred_at", "actor_id", "category_id")
SELECT gen_random_uuid(), 'expense:' || e.id, 'EXPENSE', 'EXPENSE_RECORDED', 'EXPENSE', e.id,
  e.amount, e.expense_date, e.created_at, e.created_by, e.expense_category_id FROM "expenses" e;
INSERT INTO "financial_events" ("id", "event_key", "metric", "event_kind", "source_type", "source_id", "amount", "business_date", "occurred_at", "actor_id", "supplier_id")
SELECT gen_random_uuid(), 'purchase:' || p.id, 'PURCHASE', 'PURCHASE_RECORDED', 'PURCHASE', p.id,
  p.total_amount, (p.purchase_date AT TIME ZONE 'Asia/Dhaka')::date, p.purchase_date, p.created_by, p.supplier_id
FROM "purchases" p;
INSERT INTO "financial_events" ("id", "event_key", "metric", "event_kind", "source_type", "source_id", "amount", "business_date", "occurred_at", "actor_id", "supplier_id")
SELECT gen_random_uuid(), 'supplier-payment:' || p.id, 'SUPPLIER_PAYMENT', 'PAYMENT_RECORDED', 'SUPPLIER_PAYMENT', p.id,
  p.amount, (p.payment_date AT TIME ZONE 'Asia/Dhaka')::date, p.payment_date, p.created_by, p.supplier_id
FROM "supplier_payments" p;
INSERT INTO "financial_events" ("id", "event_key", "metric", "event_kind", "source_type", "source_id", "amount", "business_date", "occurred_at", "actor_id", "customer_id")
SELECT gen_random_uuid(), 'order-payment:' || p.id, 'CUSTOM_ORDER_PAYMENT', 'PAYMENT_RECORDED', 'CUSTOM_ORDER_PAYMENT', p.id,
  p.amount, (p.payment_date AT TIME ZONE 'Asia/Dhaka')::date, p.payment_date, p.created_by, o.customer_id
FROM "custom_order_payments" p JOIN "custom_orders" o ON o.id = p.custom_order_id;
INSERT INTO "financial_events" ("id", "event_key", "metric", "event_kind", "source_type", "source_id", "amount", "business_date", "occurred_at", "actor_id")
SELECT gen_random_uuid(), 'raw-material:' || r.id, 'RAW_MATERIAL_COST', 'RAW_MATERIAL_RECORDED', 'RAW_MATERIAL', r.id,
  r.purchase_cost, r.date, r.created_at, r.created_by FROM "raw_materials" r WHERE r.purchase_cost IS NOT NULL AND r.purchase_cost > 0;

CREATE FUNCTION reject_financial_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'financial_events is append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER financial_events_immutable BEFORE UPDATE OR DELETE ON "financial_events"
  FOR EACH ROW EXECUTE FUNCTION reject_financial_event_mutation();
