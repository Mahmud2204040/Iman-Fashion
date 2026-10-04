INSERT INTO "financial_events" (
  "id", "event_key", "metric", "event_kind", "source_type", "source_id", "amount",
  "business_date", "occurred_at", "actor_id", "customer_id", "product_id"
)
SELECT gen_random_uuid(), 'sale-item:' || si.id || ':revenue:backfill',
  'SALES_PRODUCT_REVENUE', 'SALE_COMPLETED', 'SALE_ITEM', si.id, si.line_total,
  (s.sale_date AT TIME ZONE 'Asia/Dhaka')::date, s.sale_date, s.created_by, s.customer_id, si.product_id
FROM "sale_items" si JOIN "sales" s ON s.id = si.sale_id
WHERE NOT EXISTS (SELECT 1 FROM "financial_events" e WHERE e."event_key" = 'sale-item:' || si.id || ':revenue:completed');

INSERT INTO "financial_events" (
  "id", "event_key", "metric", "event_kind", "source_type", "source_id", "amount",
  "business_date", "occurred_at", "actor_id", "customer_id", "product_id"
)
SELECT gen_random_uuid(), 'sale-item:' || si.id || ':unknown-cost:backfill',
  'UNKNOWN_COST_COUNT', 'SALE_COMPLETED', 'SALE_ITEM', si.id, si.quantity,
  (s.sale_date AT TIME ZONE 'Asia/Dhaka')::date, s.sale_date, s.created_by, s.customer_id, si.product_id
FROM "sale_items" si JOIN "sales" s ON s.id = si.sale_id
WHERE si.purchase_cost_at_sale IS NULL
  AND NOT EXISTS (SELECT 1 FROM "financial_events" e WHERE e."event_key" = 'sale-item:' || si.id || ':unknown-cost:completed');
