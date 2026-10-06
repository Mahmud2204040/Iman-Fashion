# Iman Fashion — multi-layer cache architecture plan

Status: **planning only; not implemented**. This document records the agreed implementation plan for a future coding agent. It does not authorize changes to locked business rules or use of real shop data.

## 1. Core policy

The layers are selective: **L1 TanStack Query → L2 IndexedDB → L3 Vercel CDN where appropriate → L4 Northflank RAM LRU → L5 Northflank ephemeral disk → L6 PostgreSQL**. Not every request must traverse every cache. PostgreSQL remains authoritative; cache failures fall through.

Every backend request must authenticate and authorize **before** an L4/L5 lookup, including when the entry is shared between users. Sales, stock, cash, payment, purchase-status and correction write-side validation must read PostgreSQL inside the existing transaction. Caches cannot decide whether a mutation is permitted or valid. Preserve CSRF, idempotency, role-based field filtering and financial-event history.

Before implementation, re-check the current repository and provider state. At planning time, TanStack Query is mainly used on Sales and Customers; there is no IndexedDB or backend response cache. The API sets `Cache-Control: no-store`, and the Vercel API rewrite precedes the SPA fallback. Four frontend service calls request `pageSize: 5000` while the API permits at most 100; fix those callers before caching their results. Replace TanStack Query v5's ineffective `cacheTime` option with `gcTime`. Do not treat old `.ai/` status prose as current implementation evidence.

## 2. Starting capacity and management

| Layer | Initial capacity and management |
| --- | --- |
| **L1 — TanStack Query** | **No custom MiB limit or browser-side byte accounting initially.** Control growth with scoped query keys, per-type `staleTime`, `gcTime` for inactive queries, server pagination, at most one next-page prefetch, reasonable page sizes, targeted invalidation and removal of unnecessary full-list fetches. Measure browser memory before considering a size manager. |
| **L2 — IndexedDB** | Configurable **50 MiB target**, **60 MiB ceiling**, eight-hour maximum age; size/age eviction and graceful handling of browser quota. This is independent of L1 garbage collection, so L1 need not retain queries for eight hours. |
| **L3 — Vercel CDN** | Provider-managed capacity. Initially cache hashed static assets only; revalidate HTML. Authenticated API CDN caching is deferred, not permanently ruled out. |
| **L4 — backend RAM LRU** | Size-aware **75 MiB maximum stored payload**, filled on demand—not preallocated. Consider increasing to **90 MiB** only after production measurements; do not begin at 100 MiB. |
| **L5 — ephemeral disk** | **450 MiB soft target**, **550 MiB hard cap** on the described 1 GiB volume. Size-aware LRU/age eviction; maintain at least 300 MiB filesystem free for runtime and temporary files. Consider a 500 MiB soft target only after measurements. |
| **L6 — PostgreSQL** | Source of truth; no cache allocation. |

### Backend L4/L5 cache-key scope

Keys are scoped to the **response**, not automatically to the user:

```text
cache-schema-version
+ tenant/shop scope, if applicable
+ role/permission scope, only when payload or field visibility differs
+ endpoint/resource
+ normalized pagination, search, sorting and filters
+ userId, only when the payload actually differs between users of the same role
```

The current API appears to serve one shop; do not invent a tenant ID. Use a stable deployment/shop namespace now, and add a real tenant identifier if multi-tenancy is introduced. Normalize only validated request parameters and hash the completed key for disk filenames; never put customer search text or identifiers in filenames or logs.

| Current backend GET category | L4/L5 key scope **after authorization** |
| --- | --- |
| Owner-only products, raw materials, suppliers, purchases, expense categories, reports and dashboard | Shop + endpoint/parameters. No redundant `OWNER` or user ID where every authorized response is identical. |
| Customers and catalog products, available to both roles with identical current response shapes | Shop + endpoint/parameters. No role or user ID. |
| Sales history, whose serializer includes purchase cost for Owner but not Employee | Shop + **role** + endpoint/parameters. Never share an Owner sale response with an Employee. |
| A future endpoint with user-specific preferences or current-user filtering | Shop + user ID, plus role only if it also changes the payload. |
| `/api/v1/auth/me` | **Uncached**, regardless of key design. |

Do not infer sharing solely from the URL: review the handler's field filtering and query predicates when adding each endpoint to the allowlist. If that review is inconclusive, leave the endpoint uncached. **L1 and L2 remain account-isolated** using the verified user ID because they live on the user's device; backend sharing of an identical authorized response does not relax browser account isolation.

## 3. Endpoint and freshness policy

L4 and L5 use the **same absolute expiry timestamp** from the original database read; an L5-to-L4 promotion never restarts TTL. Cache successful JSON responses only, with a 2 MiB per-entry ceiling. All critical-view 30-second polls, focus/manual refreshes and immediate post-write refreshes bypass L4/L5 and read PostgreSQL.

| Data type and current endpoint category | L1 online freshness | L4/L5 TTL | Backend policy |
| --- | ---: | ---: | --- |
| `GET /api/v1/expense-categories` | 5 min | 60 sec | Cacheable reference data |
| `GET /api/v1/products`, `/products/:id`, `/catalog/products`, `/raw-materials` | 15 sec | 10 sec | Cacheable **display** data; mutation validation always queries DB |
| `GET /api/v1/customers`, `/customers/:id`, `/suppliers`, `/suppliers/:id` | 30 sec | 20 sec | Cacheable pages/details |
| `GET /api/v1/sales` with `sort=oldest` or an explicit past date | 30 sec | 30 sec | Cacheable older/paginated history, **role-scoped** |
| `GET /api/v1/purchases` and report history types `supplier-purchases`, `supplier-payments` | 15 sec | 15 sec | Cacheable display history; status/payment checks use DB |
| Bounded report aggregates: `sales-summary`, `sales-monthly`, `sales-by-product`, `expenses-monthly`, `expenses-yearly`, `expenses-by-category`, `supplier-totals`, `custom-order-status`, `profit` under `/api/v1/reports/:type` | Current period: 0 sec; closed period: 60 sec | Current period: 10 sec; closed period: 60 sec | Cacheable only at ≤2 MiB; critical/manual refresh bypasses cache. Historical results can still change after corrections. |
| `GET /api/v1/dashboard/summary`, `/dashboard` | 0 sec | **5 sec** | Cacheable ordinary display; critical refresh bypasses backend cache |
| Cash, current stock, dues, payments and corrections | 0 sec | None initially | L1/L2 read-only display caching may apply; online critical refresh uses DB |

**Not allowlisted for L4/L5:** non-GET requests; `/api/v1/auth/*`, `/api/v1/users*`, `/health/*`, receipt content/upload, `/cash/*`, `/financial-events`, `/customers/:id/due`, `/customers/:id/sales`, `/customers/:id/orders`, `/purchases/:id/payments`, `/purchases/:id/receipts`, `/sales/:id`, default newest `/sales`, and detailed/current-sensitive report types including `inventory-current`, `stock-adjustments`, `custom-order-dues`, `supplier-dues`, `cash-*`, `sales-list`, `customer-list`, `expenses-list` and `custom-order-payments`. Any unlisted GET remains uncached until reviewed.

L2 may retain successful authenticated JSON GETs for up to eight hours, but that is **retention, not freshness**. Exclude auth/session/CSRF responses, credentials, receipt bytes, signed URLs and non-JSON data. An already-open, verified tab may show offline data **read-only with a stale timestamp**; a cold offline reload cannot reveal protected data until online session verification succeeds. Clear L1/L2 on logout, 401/session expiry or account switch. No offline write queue.

The existing API `Cache-Control: no-store` remains for browser HTTP and CDN caches; application-managed L1/L2 and private L4/L5 are separate. The current Vercel authenticated rewrite remains CDN-uncached. A later L3 API pilot requires a demonstrably safe/shared endpoint and isolation tests; do not broadly enable external-rewrite caching.

## 4. Mutation invalidation

After a **successful committed** mutation, invalidate affected L1 queries and L2 entries and evict matching L4/L5 entries on that replica. Send a cache-bypass header on related GETs for 30 seconds after the write, so another replica cannot return its still-valid copy. Use `BroadcastChannel` to invalidate other tabs. Critical views on other devices refetch directly from DB every 30 seconds while visible, and immediately on focus/manual refresh. Noncritical cross-replica staleness is bounded by TTL. A failed or rolled-back mutation does not trigger success invalidation.

| Mutation | Targeted read families |
| --- | --- |
| Customer/child create or edit; customer status | Customer pages/details, affected customer orders/sales/due, customer-dependent searches and applicable dashboard activity |
| Product create/edit; stock adjustment | Product pages, catalog, stock/history, inventory reports and dashboard stock |
| Expense-category create/edit | Categories, affected expense views and category-name aggregates |
| Expense create/edit | Expenses, expense reports and dashboard expense aggregates; **no implied cash movement** |
| Supplier create/edit | Supplier pages, purchase entries embedding supplier data and supplier-name aggregates |
| Purchase create/status/payment | Purchases, supplier history/due/reports and applicable dashboard data; **supplier payment does not automatically change shop cash** |
| Receipt upload | Purchase detail and receipt metadata; never receipt bytes or signed URLs |
| Raw-material create/edit | Raw-material pages and cost reports |
| Custom-order create/edit/status/payment | Orders, customer orders/due, custom-order reports and dashboard; cash reads only when a payment actually creates cash inflow |
| Sale create/void/replace | Sales/history, affected customer sales, product stock/catalog, cash, financial reports/events and dashboard |
| Cash opening, manual in/out, reconciliation | Cash views/reports and dashboard as applicable. A reconciliation **observation** does not become a cash movement; a separate successful adjustment does. |
| Login/logout, password/username change, session expiry, user deactivation or role change | Clear the affected browser account cache; every backend request rechecks authorization before any shared-cache lookup |

## 5. Implementation and rollout order

Use independent flags `VITE_BROWSER_CACHE_ENABLED` and `API_RESPONSE_CACHE_ENABLED`, plus a backend cache-policy version for key busting.

1. Verify the actual Vercel deployment and baseline performance. Fix the four current `pageSize: 5000` callers against the API's 100-row limit. Replace TanStack v5 `cacheTime` with `gcTime`; avoid a custom L1 memory manager.
2. Standardize account-scoped L1 query keys, paginated reads, limited next-page prefetch, targeted invalidation, critical refreshes and cross-tab behavior.
3. Add independent L2 IndexedDB persistence behind its flag; authenticate online before restoration and test trusted-device/offline/account-switch rules.
4. Confirm static-only L3 and authenticated API `no-store` behavior on deployed Vercel.
5. Introduce the reviewed L4 endpoint allowlist behind its flag. Test each endpoint's **actual key scope**, authentication-before-lookup, Owner/Employee response differences, expiry and bypass.
6. Add L5 with the same keys/expiry, private hashed files, atomic writes, eviction, free-space guard and fail-open behavior. Ephemeral disk loss must simply cause cache misses.
7. Pilot by endpoint, then widen after representative monitoring. Evaluate RAM increase, disk increase and optional safe/shared L3 API caching as separate decisions.

Measure per-layer hit/miss/bypass/eviction/error counts, bytes stored, response p50/p95, DB query load, Node heap/RSS/GC, filesystem free space and sampled critical-view data age—without logging customer data, raw cache keys or secrets. Consider **75 → 90 MiB RAM** only after seven representative days with p95 RSS below 65% of the pod limit, peak below 75%, GC-pause p95 below 25 ms, no OOM/restarts, sustained capacity evictions and meaningful latency/DB-load improvement. Consider **450 → 500 MiB disk soft target** only if p95 free space stays above 350 MiB, observed minimum above 300 MiB, cache-write p95 below 20 ms, no ENOSPC/I/O errors and L5 has measurable benefit. The 550 MiB hard cap never rises automatically. Under pressure, trim or disable cache writes rather than jeopardizing the API.

Acceptance tests cover key-scope sharing and isolation, authentication on cache hits, both roles, all allowlist exclusions, post-write and cross-replica freshness, authoritative sale/stock/cash/payment/correction validation, rollback/idempotent retry, reports after corrections, offline cold reload, quota/disk failure and Vercel routing/headers. Database integration tests use a dedicated local database, never hosted Aiven.

## References

- [TanStack Query v5 migration (`cacheTime` → `gcTime`)](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5)
- [TanStack Query persistence guidance](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient)
- [Vercel external rewrite caching](https://vercel.com/docs/routing/rewrites)
- [Northflank ephemeral storage guidance](https://northflank.com/docs/v1/application/scale/increase-storage)
