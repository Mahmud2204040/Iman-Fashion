ALTER TABLE "financial_events" DROP CONSTRAINT "ck_financial_event_shape";
ALTER TABLE "financial_events" ADD CONSTRAINT "ck_financial_event_shape" CHECK (
  btrim("event_key") <> '' AND btrim("metric") <> '' AND btrim("event_kind") <> ''
  AND btrim("source_type") <> ''
  AND ("amount" <> 0 OR ("metric" = 'CASH' AND "event_kind" = 'INITIAL_SETUP'))
);

INSERT INTO "financial_events" (
  "id", "event_key", "metric", "event_kind", "source_type", "source_id",
  "amount", "business_date", "occurred_at", "actor_id"
)
SELECT gen_random_uuid(), 'cash:' || c.id, 'CASH', 'INITIAL_SETUP', 'CASH_TRANSACTION', c.id,
  0, (c.occurred_at AT TIME ZONE 'Asia/Dhaka')::date, c.occurred_at, c.created_by
FROM "cash_transactions" c
WHERE c.transaction_type = 'OPENING' AND c.amount = 0
  AND NOT EXISTS (SELECT 1 FROM "financial_events" e WHERE e.event_key = 'cash:' || c.id);
