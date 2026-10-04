INSERT INTO "financial_events" (
  "id", "event_key", "metric", "event_kind", "source_type", "source_id",
  "amount", "business_date", "occurred_at", "actor_id", "customer_id"
)
SELECT gen_random_uuid(), 'custom-order:' || o.id || ':value', 'CUSTOM_ORDER_VALUE',
  'ORDER_CREATED', 'CUSTOM_ORDER', o.id, o.total_price,
  (o.order_date AT TIME ZONE 'Asia/Dhaka')::date, o.order_date, o.created_by, o.customer_id
FROM "custom_orders" o;

INSERT INTO "financial_events" (
  "id", "event_key", "metric", "event_kind", "source_type", "source_id",
  "amount", "business_date", "occurred_at", "actor_id", "customer_id"
)
SELECT gen_random_uuid(), 'custom-order:' || o.id || ':cancelled', 'CUSTOM_ORDER_VALUE',
  'ORDER_CANCELLED_DUE', 'CUSTOM_ORDER', o.id,
  -(o.total_price - COALESCE(p.paid, 0)),
  (o.cancelled_at AT TIME ZONE 'Asia/Dhaka')::date, o.cancelled_at, o.cancelled_by, o.customer_id
FROM "custom_orders" o
LEFT JOIN (SELECT custom_order_id, SUM(amount) paid FROM "custom_order_payments" GROUP BY custom_order_id) p
  ON p.custom_order_id = o.id
WHERE o.status = 'CANCELLED' AND o.cancelled_at IS NOT NULL
  AND o.total_price > COALESCE(p.paid, 0);
