-- Seed the event valuation to the current product balance. This is an explicit
-- migration-time opening observation, not a reconstruction of past movements.
INSERT INTO "financial_events" (
  "id", "event_key", "metric", "event_kind", "source_type", "source_id", "amount",
  "business_date", "occurred_at", "actor_id", "product_id"
)
SELECT gen_random_uuid(), 'inventory:product:' || p.id || ':backfill',
  'INVENTORY_VALUE', 'INVENTORY_MIGRATION_OPENING', 'PRODUCT', p.id,
  (p.stock_quantity * p.purchase_price) - COALESCE(e.recorded, 0),
  (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::date, CURRENT_TIMESTAMP, p.created_by, p.id
FROM "products" p
LEFT JOIN (
  SELECT product_id, SUM(amount) recorded FROM "financial_events"
  WHERE metric = 'INVENTORY_VALUE' GROUP BY product_id
) e ON e.product_id = p.id
WHERE p.purchase_price IS NOT NULL
  AND (p.stock_quantity * p.purchase_price) - COALESCE(e.recorded, 0) <> 0;
