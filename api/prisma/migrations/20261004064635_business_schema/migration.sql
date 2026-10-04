-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED');

-- CreateEnum
CREATE TYPE "CustomOrderStatus" AS ENUM ('PENDING', 'READY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CashTransactionType" AS ENUM ('OPENING', 'CASH_IN', 'CASH_OUT', 'CASH_ADJUSTMENT');

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "customer_code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "children" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "initial_class" SMALLINT NOT NULL,
    "school_name" VARCHAR(255) NOT NULL,
    "registered_date" DATE NOT NULL,
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "product_code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "purchase_price" DECIMAL(12,2),
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "sales_code" VARCHAR(50) NOT NULL,
    "customer_id" UUID NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "sale_date" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT,
    "request_key" VARCHAR(100),
    "request_fingerprint" CHAR(64),
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name_at_sale" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "selling_price" DECIMAL(12,2) NOT NULL,
    "purchase_cost_at_sale" DECIMAL(12,2),
    "line_total" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_orders" (
    "id" UUID NOT NULL,
    "order_code" VARCHAR(50) NOT NULL,
    "customer_id" UUID NOT NULL,
    "product_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "total_price" DECIMAL(12,2) NOT NULL,
    "expected_delivery_date" DATE NOT NULL,
    "order_date" TIMESTAMPTZ(6) NOT NULL,
    "delivery_date" TIMESTAMPTZ(6),
    "status" "CustomOrderStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "status_changed_at" TIMESTAMPTZ(6),
    "status_changed_by" UUID,
    "request_key" VARCHAR(100),
    "request_fingerprint" CHAR(64),
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "custom_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_order_payments" (
    "id" UUID NOT NULL,
    "custom_order_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_date" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT,
    "request_key" VARCHAR(100),
    "request_fingerprint" CHAR(64),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_order_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "supplier_code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(30),
    "address" TEXT,
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" UUID NOT NULL,
    "purchase_code" VARCHAR(50) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "purchase_date" TIMESTAMPTZ(6) NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "request_key" VARCHAR(100),
    "request_fingerprint" CHAR(64),
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "item_name" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "purchase_cost" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payments" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_date" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT,
    "request_key" VARCHAR(100),
    "request_fingerprint" CHAR(64),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_materials" (
    "id" UUID NOT NULL,
    "item_name" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "purchase_cost" DECIMAL(12,2),
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "raw_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "normalized_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "expense_category_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "expense_date" DATE NOT NULL,
    "description" TEXT,
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity_change" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "request_key" VARCHAR(100),
    "request_fingerprint" CHAR(64),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_transactions" (
    "id" UUID NOT NULL,
    "ledger_sequence" BIGINT GENERATED BY DEFAULT AS IDENTITY NOT NULL,
    "transaction_type" "CashTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference_type" VARCHAR(50) NOT NULL,
    "reference_id" UUID,
    "reason" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "request_key" VARCHAR(100),
    "request_fingerprint" CHAR(64),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipts" (
    "id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "supplier_payment_id" UUID,
    "storage_key" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_reconciliations" (
    "id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "counted_at" TIMESTAMPTZ(6) NOT NULL,
    "expected_cash" DECIMAL(12,2) NOT NULL,
    "physical_cash" DECIMAL(12,2) NOT NULL,
    "difference" DECIMAL(12,2) NOT NULL,
    "ledger_sequence_at_count" BIGINT NOT NULL,
    "notes" TEXT,
    "reconciled_by" UUID NOT NULL,
    "adjustment_transaction_id" UUID,
    "supersedes_id" UUID,
    "request_key" VARCHAR(100),
    "request_fingerprint" CHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_customer_code_key" ON "customers"("customer_code");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_created_by_idx" ON "customers"("created_by");

-- CreateIndex
CREATE INDEX "customers_updated_by_idx" ON "customers"("updated_by");

-- CreateIndex
CREATE INDEX "children_customer_id_idx" ON "children"("customer_id");

-- CreateIndex
CREATE INDEX "children_created_by_idx" ON "children"("created_by");

-- CreateIndex
CREATE INDEX "children_updated_by_idx" ON "children"("updated_by");

-- CreateIndex
CREATE UNIQUE INDEX "products_product_code_key" ON "products"("product_code");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "products_created_by_idx" ON "products"("created_by");

-- CreateIndex
CREATE INDEX "products_updated_by_idx" ON "products"("updated_by");

-- CreateIndex
CREATE UNIQUE INDEX "sales_sales_code_key" ON "sales"("sales_code");

-- CreateIndex
CREATE INDEX "sales_customer_id_sale_date_idx" ON "sales"("customer_id", "sale_date");

-- CreateIndex
CREATE INDEX "sales_sale_date_idx" ON "sales"("sale_date");

-- CreateIndex
CREATE INDEX "sales_updated_by_idx" ON "sales"("updated_by");

-- CreateIndex
CREATE UNIQUE INDEX "sales_created_by_request_key_key" ON "sales"("created_by", "request_key");

-- CreateIndex
CREATE INDEX "sale_items_product_id_idx" ON "sale_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "sale_items_sale_id_product_id_key" ON "sale_items"("sale_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_orders_order_code_key" ON "custom_orders"("order_code");

-- CreateIndex
CREATE INDEX "custom_orders_customer_id_status_idx" ON "custom_orders"("customer_id", "status");

-- CreateIndex
CREATE INDEX "custom_orders_expected_delivery_date_idx" ON "custom_orders"("expected_delivery_date");

-- CreateIndex
CREATE INDEX "custom_orders_updated_by_idx" ON "custom_orders"("updated_by");

-- CreateIndex
CREATE INDEX "custom_orders_status_changed_by_idx" ON "custom_orders"("status_changed_by");

-- CreateIndex
CREATE UNIQUE INDEX "custom_orders_created_by_request_key_key" ON "custom_orders"("created_by", "request_key");

-- CreateIndex
CREATE INDEX "custom_order_payments_custom_order_id_payment_date_idx" ON "custom_order_payments"("custom_order_id", "payment_date");

-- CreateIndex
CREATE UNIQUE INDEX "custom_order_payments_created_by_request_key_key" ON "custom_order_payments"("created_by", "request_key");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_supplier_code_key" ON "suppliers"("supplier_code");

-- CreateIndex
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "suppliers_phone_idx" ON "suppliers"("phone");

-- CreateIndex
CREATE INDEX "suppliers_created_by_idx" ON "suppliers"("created_by");

-- CreateIndex
CREATE INDEX "suppliers_updated_by_idx" ON "suppliers"("updated_by");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_purchase_code_key" ON "purchases"("purchase_code");

-- CreateIndex
CREATE INDEX "purchases_supplier_id_purchase_date_idx" ON "purchases"("supplier_id", "purchase_date");

-- CreateIndex
CREATE INDEX "purchases_purchase_date_idx" ON "purchases"("purchase_date");

-- CreateIndex
CREATE INDEX "purchases_status_idx" ON "purchases"("status");

-- CreateIndex
CREATE INDEX "purchases_updated_by_idx" ON "purchases"("updated_by");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_created_by_request_key_key" ON "purchases"("created_by", "request_key");

-- Keep payment supplier and purchase supplier in agreement.
CREATE UNIQUE INDEX "purchases_id_supplier_id_key" ON "purchases"("id", "supplier_id");

-- CreateIndex
CREATE INDEX "purchase_items_purchase_id_idx" ON "purchase_items"("purchase_id");

-- CreateIndex
CREATE INDEX "supplier_payments_supplier_id_payment_date_idx" ON "supplier_payments"("supplier_id", "payment_date");

-- CreateIndex
CREATE INDEX "supplier_payments_purchase_id_payment_date_idx" ON "supplier_payments"("purchase_id", "payment_date");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payments_created_by_request_key_key" ON "supplier_payments"("created_by", "request_key");

-- A receipt payment must belong to the same purchase as the receipt.
CREATE UNIQUE INDEX "supplier_payments_id_purchase_id_key" ON "supplier_payments"("id", "purchase_id");

-- CreateIndex
CREATE INDEX "raw_materials_date_idx" ON "raw_materials"("date");

-- CreateIndex
CREATE INDEX "raw_materials_item_name_idx" ON "raw_materials"("item_name");

-- CreateIndex
CREATE INDEX "raw_materials_created_by_idx" ON "raw_materials"("created_by");

-- CreateIndex
CREATE INDEX "raw_materials_updated_by_idx" ON "raw_materials"("updated_by");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_normalized_name_key" ON "expense_categories"("normalized_name");

-- CreateIndex
CREATE INDEX "expense_categories_created_by_idx" ON "expense_categories"("created_by");

-- CreateIndex
CREATE INDEX "expense_categories_updated_by_idx" ON "expense_categories"("updated_by");

-- CreateIndex
CREATE INDEX "expenses_expense_date_idx" ON "expenses"("expense_date");

-- CreateIndex
CREATE INDEX "expenses_expense_category_id_expense_date_idx" ON "expenses"("expense_category_id", "expense_date");

-- CreateIndex
CREATE INDEX "expenses_created_by_idx" ON "expenses"("created_by");

-- CreateIndex
CREATE INDEX "expenses_updated_by_idx" ON "expenses"("updated_by");

-- CreateIndex
CREATE INDEX "stock_adjustments_product_id_created_at_idx" ON "stock_adjustments"("product_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustments_created_by_request_key_key" ON "stock_adjustments"("created_by", "request_key");

-- CreateIndex
CREATE UNIQUE INDEX "cash_transactions_ledger_sequence_key" ON "cash_transactions"("ledger_sequence");

-- CreateIndex
CREATE INDEX "cash_transactions_occurred_at_ledger_sequence_idx" ON "cash_transactions"("occurred_at", "ledger_sequence");

-- CreateIndex
CREATE INDEX "cash_transactions_reference_type_reference_id_idx" ON "cash_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_transactions_created_by_request_key_key" ON "cash_transactions"("created_by", "request_key");

-- CreateIndex
CREATE INDEX "purchase_receipts_purchase_id_created_at_idx" ON "purchase_receipts"("purchase_id", "created_at");

-- CreateIndex
CREATE INDEX "purchase_receipts_supplier_payment_id_idx" ON "purchase_receipts"("supplier_payment_id");

-- CreateIndex
CREATE INDEX "purchase_receipts_uploaded_by_idx" ON "purchase_receipts"("uploaded_by");

-- CreateIndex
CREATE UNIQUE INDEX "cash_reconciliations_adjustment_transaction_id_key" ON "cash_reconciliations"("adjustment_transaction_id");

-- CreateIndex
CREATE INDEX "cash_reconciliations_business_date_counted_at_idx" ON "cash_reconciliations"("business_date", "counted_at");

-- CreateIndex
CREATE INDEX "cash_reconciliations_supersedes_id_idx" ON "cash_reconciliations"("supersedes_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_reconciliations_reconciled_by_request_key_key" ON "cash_reconciliations"("reconciled_by", "request_key");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_orders" ADD CONSTRAINT "custom_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_orders" ADD CONSTRAINT "custom_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_orders" ADD CONSTRAINT "custom_orders_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_orders" ADD CONSTRAINT "custom_orders_status_changed_by_fkey" FOREIGN KEY ("status_changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_order_payments" ADD CONSTRAINT "custom_order_payments_custom_order_id_fkey" FOREIGN KEY ("custom_order_id") REFERENCES "custom_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_order_payments" ADD CONSTRAINT "custom_order_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_purchase_id_supplier_id_fkey" FOREIGN KEY ("purchase_id", "supplier_id") REFERENCES "purchases"("id", "supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_expense_category_id_fkey" FOREIGN KEY ("expense_category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_supplier_payment_id_purchase_id_fkey" FOREIGN KEY ("supplier_payment_id", "purchase_id") REFERENCES "supplier_payments"("id", "purchase_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_reconciliations" ADD CONSTRAINT "cash_reconciliations_reconciled_by_fkey" FOREIGN KEY ("reconciled_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_reconciliations" ADD CONSTRAINT "cash_reconciliations_adjustment_transaction_id_fkey" FOREIGN KEY ("adjustment_transaction_id") REFERENCES "cash_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_reconciliations" ADD CONSTRAINT "cash_reconciliations_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "cash_reconciliations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma's schema expresses types, foreign keys and ordinary indexes. Keep
-- cross-field business invariants in this reviewed SQL migration.
ALTER TABLE "customers" ADD CONSTRAINT "ck_customers_identity" CHECK (
    btrim("customer_code") <> '' AND btrim("name") <> '' AND btrim("phone") <> ''
);
ALTER TABLE "children" ADD CONSTRAINT "ck_children_fields" CHECK (
    btrim("name") <> '' AND btrim("school_name") <> '' AND "initial_class" >= 0
);
ALTER TABLE "products" ADD CONSTRAINT "ck_products_values" CHECK (
    btrim("product_code") <> '' AND btrim("name") <> '' AND "stock_quantity" >= 0
    AND ("purchase_price" IS NULL OR "purchase_price" >= 0)
);
ALTER TABLE "sales" ADD CONSTRAINT "ck_sales_values" CHECK (
    btrim("sales_code") <> '' AND "total_amount" > 0
);
ALTER TABLE "sale_items" ADD CONSTRAINT "ck_sale_items_values" CHECK (
    btrim("product_name_at_sale") <> '' AND "quantity" > 0 AND "selling_price" > 0
    AND ("purchase_cost_at_sale" IS NULL OR "purchase_cost_at_sale" >= 0)
    AND "line_total" = "quantity" * "selling_price"
);
ALTER TABLE "custom_orders" ADD CONSTRAINT "ck_custom_orders_values" CHECK (
    btrim("order_code") <> '' AND btrim("product_name") <> ''
    AND "quantity" > 0 AND "total_price" > 0
    AND ("status_changed_by" IS NULL) = ("status_changed_at" IS NULL)
);
ALTER TABLE "custom_order_payments" ADD CONSTRAINT "ck_order_payment_amount" CHECK ("amount" > 0);
ALTER TABLE "suppliers" ADD CONSTRAINT "ck_suppliers_identity" CHECK (
    btrim("supplier_code") <> '' AND btrim("name") <> ''
);
ALTER TABLE "purchases" ADD CONSTRAINT "ck_purchases_values" CHECK (
    btrim("purchase_code") <> '' AND "total_amount" >= 0
);
ALTER TABLE "purchase_items" ADD CONSTRAINT "ck_purchase_items_values" CHECK (
    btrim("item_name") <> '' AND "quantity" > 0 AND "purchase_cost" >= 0
);
ALTER TABLE "supplier_payments" ADD CONSTRAINT "ck_supplier_payment_amount" CHECK ("amount" > 0);
ALTER TABLE "raw_materials" ADD CONSTRAINT "ck_raw_materials_values" CHECK (
    btrim("item_name") <> '' AND "quantity" > 0
    AND ("purchase_cost" IS NULL OR "purchase_cost" >= 0)
);
ALTER TABLE "expense_categories" ADD CONSTRAINT "ck_expense_category_name" CHECK (
    btrim("name") <> '' AND "normalized_name" = lower(btrim("name"))
);
ALTER TABLE "expenses" ADD CONSTRAINT "ck_expenses_amount" CHECK ("amount" > 0);
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "ck_stock_adjustment_values" CHECK (
    "quantity_change" <> 0 AND btrim("reason") <> ''
);
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "ck_receipt_metadata" CHECK (
    btrim("storage_key") <> '' AND btrim("file_name") <> ''
    AND "mime_type" IN ('image/jpeg', 'image/png', 'image/webp')
    AND "size_bytes" > 0 AND "size_bytes" <= 5242880
);
ALTER TABLE "cash_reconciliations" ADD CONSTRAINT "ck_reconciliation_values" CHECK (
    "physical_cash" >= 0 AND "difference" = "physical_cash" - "expected_cash"
    AND "ledger_sequence_at_count" >= 0
    AND ("adjustment_transaction_id" IS NULL OR "difference" <> 0)
    AND ("supersedes_id" IS NULL OR "supersedes_id" <> "id")
);

ALTER TABLE "cash_transactions" ADD CONSTRAINT "ck_cash_transaction_shape" CHECK (
    btrim("reason") <> '' AND (
      ("transaction_type" = 'OPENING' AND "amount" >= 0 AND "reference_type" = 'INITIAL_SETUP' AND "reference_id" IS NULL)
      OR ("transaction_type" = 'CASH_IN' AND "amount" > 0 AND (
        ("reference_type" = 'MANUAL' AND "reference_id" IS NULL)
        OR ("reference_type" IN ('SALE', 'CUSTOM_ORDER_PAYMENT') AND "reference_id" IS NOT NULL)
      ))
      OR ("transaction_type" = 'CASH_OUT' AND "amount" > 0 AND "reference_type" = 'MANUAL' AND "reference_id" IS NULL)
      OR ("transaction_type" = 'CASH_ADJUSTMENT' AND "amount" <> 0 AND "reference_type" = 'RECONCILIATION' AND "reference_id" IS NOT NULL)
    )
);
CREATE UNIQUE INDEX "cash_one_opening" ON "cash_transactions"("transaction_type") WHERE "transaction_type" = 'OPENING';
CREATE UNIQUE INDEX "cash_one_automatic_source" ON "cash_transactions"("reference_type", "reference_id")
    WHERE "reference_type" IN ('SALE', 'CUSTOM_ORDER_PAYMENT', 'RECONCILIATION');

-- A retry key and its fingerprint must be supplied together. PostgreSQL's
-- ordinary unique(actor, request_key) index permits multiple NULL keys.
ALTER TABLE "sales" ADD CONSTRAINT "ck_sales_retry" CHECK (("request_key" IS NULL) = ("request_fingerprint" IS NULL) AND ("request_key" IS NULL OR btrim("request_key") <> ''));
ALTER TABLE "custom_orders" ADD CONSTRAINT "ck_orders_retry" CHECK (("request_key" IS NULL) = ("request_fingerprint" IS NULL) AND ("request_key" IS NULL OR btrim("request_key") <> ''));
ALTER TABLE "custom_order_payments" ADD CONSTRAINT "ck_order_payments_retry" CHECK (("request_key" IS NULL) = ("request_fingerprint" IS NULL) AND ("request_key" IS NULL OR btrim("request_key") <> ''));
ALTER TABLE "purchases" ADD CONSTRAINT "ck_purchases_retry" CHECK (("request_key" IS NULL) = ("request_fingerprint" IS NULL) AND ("request_key" IS NULL OR btrim("request_key") <> ''));
ALTER TABLE "supplier_payments" ADD CONSTRAINT "ck_supplier_payments_retry" CHECK (("request_key" IS NULL) = ("request_fingerprint" IS NULL) AND ("request_key" IS NULL OR btrim("request_key") <> ''));
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "ck_stock_adjustments_retry" CHECK (("request_key" IS NULL) = ("request_fingerprint" IS NULL) AND ("request_key" IS NULL OR btrim("request_key") <> ''));
ALTER TABLE "cash_transactions" ADD CONSTRAINT "ck_cash_transactions_retry" CHECK (("request_key" IS NULL) = ("request_fingerprint" IS NULL) AND ("request_key" IS NULL OR btrim("request_key") <> ''));
ALTER TABLE "cash_reconciliations" ADD CONSTRAINT "ck_cash_reconciliations_retry" CHECK (("request_key" IS NULL) = ("request_fingerprint" IS NULL) AND ("request_key" IS NULL OR btrim("request_key") <> ''));
