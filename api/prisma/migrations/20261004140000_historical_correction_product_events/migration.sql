-- Some pilot correction rows may predate the product-level revenue metric.
-- Restore their product reversal on the original correction date, never by
-- altering or deleting the original immutable events.
INSERT INTO "financial_events" (
  "id", "event_key", "metric", "event_kind", "source_type", "source_id", "amount",
  "business_date", "occurred_at", "actor_id", "customer_id", "product_id"
)
SELECT gen_random_uuid(), 'sale-item:' || si.id || ':revenue:correction:' || c.id || ':reverse:backfill',
  'SALES_PRODUCT_REVENUE', 'SALE_REVERSED', 'SALE_ITEM', si.id, -si.line_total,
  (c.corrected_at AT TIME ZONE 'Asia/Dhaka')::date, c.corrected_at, c.corrected_by,
  s.customer_id, si.product_id
FROM "sale_corrections" c
JOIN "sales" s ON s.id = c.original_sale_id
JOIN "sale_items" si ON si.sale_id = s.id
WHERE NOT EXISTS (
  SELECT 1 FROM "financial_events" e
  WHERE e.metric = 'SALES_PRODUCT_REVENUE' AND e.event_kind = 'SALE_REVERSED'
    AND e.source_type = 'SALE_ITEM' AND e.source_id = si.id
);

INSERT INTO "financial_events" (
  "id", "event_key", "metric", "event_kind", "source_type", "source_id", "amount",
  "business_date", "occurred_at", "actor_id", "customer_id", "product_id"
)
SELECT gen_random_uuid(), 'sale-item:' || si.id || ':unknown-cost:correction:' || c.id || ':reverse:backfill',
  'UNKNOWN_COST_COUNT', 'SALE_REVERSED', 'SALE_ITEM', si.id, -si.quantity,
  (c.corrected_at AT TIME ZONE 'Asia/Dhaka')::date, c.corrected_at, c.corrected_by,
  s.customer_id, si.product_id
FROM "sale_corrections" c
JOIN "sales" s ON s.id = c.original_sale_id
JOIN "sale_items" si ON si.sale_id = s.id
WHERE si.purchase_cost_at_sale IS NULL AND NOT EXISTS (
  SELECT 1 FROM "financial_events" e
  WHERE e.metric = 'UNKNOWN_COST_COUNT' AND e.event_kind = 'SALE_REVERSED'
    AND e.source_type = 'SALE_ITEM' AND e.source_id = si.id
);
