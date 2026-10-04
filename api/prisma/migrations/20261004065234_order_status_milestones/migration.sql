-- AlterTable
ALTER TABLE "custom_orders" ADD COLUMN     "cancelled_at" TIMESTAMPTZ(6),
ADD COLUMN     "cancelled_by" UUID,
ADD COLUMN     "delivered_at" TIMESTAMPTZ(6),
ADD COLUMN     "delivered_by" UUID,
ADD COLUMN     "ready_at" TIMESTAMPTZ(6),
ADD COLUMN     "ready_by" UUID;

-- CreateIndex
CREATE INDEX "custom_orders_ready_by_idx" ON "custom_orders"("ready_by");

-- CreateIndex
CREATE INDEX "custom_orders_delivered_by_idx" ON "custom_orders"("delivered_by");

-- CreateIndex
CREATE INDEX "custom_orders_cancelled_by_idx" ON "custom_orders"("cancelled_by");

-- AddForeignKey
ALTER TABLE "custom_orders" ADD CONSTRAINT "custom_orders_ready_by_fkey" FOREIGN KEY ("ready_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_orders" ADD CONSTRAINT "custom_orders_delivered_by_fkey" FOREIGN KEY ("delivered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_orders" ADD CONSTRAINT "custom_orders_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Allowed transitions are PENDING -> READY -> DELIVERED, or cancellation
-- from PENDING/READY. Milestones retain the actor/time after later changes.
ALTER TABLE "custom_orders" ADD CONSTRAINT "ck_order_status_milestones" CHECK (
    ("ready_at" IS NULL) = ("ready_by" IS NULL)
    AND ("delivered_at" IS NULL) = ("delivered_by" IS NULL)
    AND ("cancelled_at" IS NULL) = ("cancelled_by" IS NULL)
    AND ("status_changed_at" IS NULL) = ("status_changed_by" IS NULL)
    AND (
      ("status" = 'PENDING' AND "ready_at" IS NULL AND "delivered_at" IS NULL
        AND "cancelled_at" IS NULL AND "delivery_date" IS NULL
        AND "status_changed_at" IS NULL AND "status_changed_by" IS NULL)
      OR ("status" = 'READY' AND "ready_at" IS NOT NULL AND "delivered_at" IS NULL
        AND "cancelled_at" IS NULL AND "delivery_date" IS NULL AND "status_changed_at" IS NOT NULL
        AND "status_changed_at" = "ready_at" AND "status_changed_by" = "ready_by")
      OR ("status" = 'DELIVERED' AND "ready_at" IS NOT NULL AND "delivered_at" IS NOT NULL
        AND "cancelled_at" IS NULL AND "delivery_date" IS NOT NULL
        AND "delivery_date" = "delivered_at" AND "status_changed_at" IS NOT NULL
        AND "status_changed_at" = "delivered_at" AND "status_changed_by" = "delivered_by")
      OR ("status" = 'CANCELLED' AND "cancelled_at" IS NOT NULL AND "delivered_at" IS NULL
        AND "delivery_date" IS NULL AND "status_changed_at" IS NOT NULL AND "status_changed_at" = "cancelled_at"
        AND "status_changed_by" = "cancelled_by")
    )
);
