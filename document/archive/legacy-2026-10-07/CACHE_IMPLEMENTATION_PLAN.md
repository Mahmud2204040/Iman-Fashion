# Iman Fashion — detailed cache implementation plan

Status: **implementation plan only; caching is not implemented by this document**. Read [CACHE_ARCHITECTURE_PLAN.md](CACHE_ARCHITECTURE_PLAN.md), the active business documents, root `AGENTS.md`, and the current repository before changing code. The architecture plan defines the agreed cache policy; this file defines an implementation sequence and verification gates. PostgreSQL remains the source of truth throughout.

## 1. Current baseline and non-negotiable boundaries

At the time this plan was saved (2026-10-06, Asia/Dhaka), `main` was at `a663447`. `e6294cd` had already changed TanStack Query's `cacheTime` to `gcTime` and removed one invalid 5,000-row Sales lookup. `a663447` changed the custom-order form to server-side customer search and changed Sales List and Customer List report service calls from `pageSize: 5000` to `pageSize: 100`. This avoids two API validation failures but may truncate reports to their first 100 records; verify the intended report behavior and affected consumers before adding cache. An exported `listCustomersForCustomOrders()` helper still contains `pageSize: 5000`, even though the current form no longer imports it. Do not assume it is safe to cache or silently delete it. The existing Sales and Customers list pages use TanStack Query; most other GET consumers still call services directly. There is no IndexedDB, L4, or L5 response cache in the repository.

Before implementation, inspect `git status`, relevant diffs, the actual deployment revision, and current provider resources. At this snapshot, `document/CACHE_ARCHITECTURE_PLAN.md`, `lint.tap`, and four `patch_*.js` files were untracked. Preserve them and recheck their status; they may represent user or concurrent work. The `.ai/` handoff/status documents contain older implementation claims and are not proof of current provider or frontend behavior.

Scope is cache architecture and the pagination/freshness correctness work needed to make it safe. Out of scope: changing business rules, permissions, report formulas, financial history, receipt storage, provider topology, or live-data release. Sales, stock, cash, payment, purchase-status, and correction write-side validation must continue to use PostgreSQL inside the existing transactions. Cache hits never bypass authentication, authorization, CSRF, or role-specific field filtering. A cache failure falls through to the next layer. No PostgreSQL schema migration is planned.

## 2. Contracts and module layout

### Frontend L1/L2 contracts

Create a small `src/cache/` module group for query keys/policies, account cache lifecycle, IndexedDB storage, mutation effects, and offline/cache metadata. Keep domain DTO conversion in existing `src/services/*` modules; the application-managed cache stores the raw successful API JSON envelope, so the current `apiRequest(..., { raw: true })` and default unwrapped return shapes remain unchanged.

Put an account-scoped QueryClient/cache boundary **inside** `AuthProvider`, which itself must remain inside `BrowserRouter`. On a cold load, await an online `/api/v1/auth/me` success before mounting protected views or reading protected IndexedDB entries. Create/clear the QueryClient for the verified user ID and role; clear L1 and L2 on logout, 401/session expiry, account switch, and role change. Query keys have the form:

```text
[cacheSchemaVersion, verifiedUserId, role, domain, resource, normalizedParameters]
```

The browser includes user ID deliberately for local account isolation. Backend cache keys have different sharing rules. Normalize page, pageSize, search, date, sort, and report filters consistently with the outgoing request. Use TanStack Query `staleTime`, 10-minute inactive `gcTime` initially, server-side pagination, `AbortSignal`, at most one next-page prefetch, and targeted invalidation. Do **not** build a custom browser MiB-accounting manager for L1. Use the architecture plan's per-data freshness values rather than the current Sales/Customers five-minute override or a blanket two-minute default. Keep `keepPreviousData` behavior where it helps pagination, but show fetching/staleness accurately.

Extend `src/services/api/apiClient.js` with optional `signal`, `cacheMode: 'default' | 'bypass' | 'no-store'`, and `onCacheMeta({ source, fetchedAt, stale, offline })`, without breaking existing callers. `default` may return a still-fresh eligible IndexedDB GET; otherwise it fetches the API and persists a successful eligible JSON response. `bypass` skips IndexedDB lookup and sends `X-Cache-Bypass: 1` to force a DB-backed backend read. `no-store` bypasses application-cache reads and writes for auth and excluded payloads. Preserve `credentials: 'include'`, `fetch(cache: 'no-store')`, CSRF, idempotency keys, current error codes, and raw/unwrapped response semantics. Add `X-Cache-Bypass` to the API's allowed CORS request headers; it never bypasses authentication.

Use an **independent IndexedDB read cache**, not whole-QueryClient persistence. A small IndexedDB wrapper (for example `idb`) should support transactions and indexes over entries containing account namespace, API environment/base identity, normalized request key, raw JSON response, cache tags, `fetchedAt`, `lastAccessAt`, estimated bytes, and cache-schema version. Start at configurable 50 MiB target, 60 MiB ceiling, and eight-hour maximum retention. Remove expired and least-recently-used entries; handle browser quota and IndexedDB failures by continuing to network. L2 retention is **not** freshness. Authenticated successful JSON GETs are eligible unless explicitly excluded; never persist auth/session/CSRF responses, credentials, receipt bytes, signed URLs, or non-JSON data. Inspect nested response fields before enrolling an endpoint.

An already-open tab with a previously verified session may show retained data offline with a visible **offline, read-only, last-fetched** indicator. Disable mutation controls and do not queue writes. A cold offline load cannot verify identity and must not reveal protected cached data. On reconnect, verify the session before refreshing critical views. On logout, purge local caches immediately. If server logout/revocation fails, do not claim it succeeded: block protected UI and retry revocation after connectivity returns.

Implement one frontend mutation-effect registry: after a successful committed mutation response, invalidate the specified L1 query families, delete matching L2 tags, notify other same-origin tabs with `BroadcastChannel`, and mark related GET families for a 30-second bypass window. Failed or rolled-back mutations must not run success effects. Avoid broad invalidation of unrelated data.

### Backend L4/L5 contracts

Create focused modules under `api/src/cache/`: policy registry, normalized key builder, size-aware RAM LRU, disk store, read-through helper, tag invalidation, and aggregate metrics. Add an allowlisted cached-GET helper to the existing business-route structure, adapting only selected GET handlers. The path is:

```text
authenticate → authorize → validate/normalize request → derive response scope/key
→ L4 RAM lookup → L5 disk lookup → PostgreSQL loader → optional cache writes → response
```

Do not globally monkey-patch `res.json`, cache every GET, or alter report calculations while extracting loaders. Store the exact JSON envelope the uncached endpoint would emit. Cache only successful JSON responses no larger than 2 MiB. Keep API responses `Cache-Control: no-store`; L4/L5 are private application stores, not HTTP/CDN caches. An entry contains at least `{ schemaVersion, payload, tags, createdAt, expiresAt, estimatedBytes }`. L4 and L5 share the **original DB read's absolute expiry**; disk-to-RAM promotion does not renew TTL. Deduplicate concurrent misses by key. Capture tag generations before a DB load and recheck before insertion so an in-flight pre-mutation read cannot refill stale cache after invalidation.

Build L4/L5 keys from cache-schema version, a stable single-shop/deployment namespace, endpoint/resource, and validated normalized pagination/search/sort/filters. Include role/permission scope **only when the response differs by role** and user ID **only when it truly differs between users of the same role**. The current application has one shop; do not invent a tenant DB identifier. Owner-only products, suppliers, purchases, reports, dashboard and reference data need no redundant user ID or role component if all authorized payloads are identical. Customers and catalog can be shared across authorized roles if handler review confirms identical fields. Sales history **must include role** because Owner receives purchase-cost data and Employee must not. `/auth/me` is uncached. Review each handler's filters and serialization before enrollment; when uncertain, leave it uncached. Hash full keys for disk filenames and never log raw customer search text or identifiers.

Use a size-aware RAM LRU at **75 MiB maximum stored payload**, filled on demand rather than preallocated. Measure full-process heap and RSS, and trim or stop cache insertion under memory pressure. For L5, use private hashed files, restrictive file permissions, atomic temporary-write/rename, and a bounded/recoverable index. Start at **450 MiB soft target, 550 MiB hard cap**, and keep at least **300 MiB** free on the filesystem actually holding the cache directory. The path must be writable by the Docker image's `node` user. Corruption, missing files, permission errors, full filesystem, or ephemeral restart loss are cache misses/degraded-cache events, not API failures. No SQLite cache database, durable volume, Redis, or PostgreSQL migration is required for the first rollout.

Use `API_RESPONSE_CACHE_ENABLED=false` initially for L4 and independent `API_DISK_CACHE_ENABLED=false` for L5. Make cache directory/limits configurable and version policy keys to safely discard old formats. Feature-flag-off behavior must match today's DB-backed response shapes.

## 3. Endpoint policy and invalidation implementation

Apply the exact endpoint allowlist/exclusions and TTLs in [CACHE_ARCHITECTURE_PLAN.md](CACHE_ARCHITECTURE_PLAN.md). Enroll in small groups: reference categories; products/catalog/raw materials; customers/suppliers; eligible older/paginated Sales and purchase/supplier history; bounded report aggregates; then dashboard aggregates. Default newest Sales, sale detail, cash, current stock, dues, payments, corrections, auth/users, receipts, and detailed/current-sensitive reports stay out of L4/L5 initially. A response larger than 2 MiB bypasses L4/L5. Determine current/open versus explicitly closed report periods using **Asia/Dhaka business dates**, including midnight transition tests. Historical reports are not immutable: corrections can change their results.

For critical dashboard, cash, current-stock, due, payment and correction-dependent views, use `staleTime: 0`. While visible and online, refetch every **30 seconds**, immediately on focus/reconnect, and on manual refresh. These requests use `cacheMode: 'bypass'` and reach PostgreSQL. Do not poll hidden tabs. Successful related writes trigger an immediate DB-backed refresh. Noncritical GETs may use the architecture plan's short L4/L5 TTLs. A bypass may refresh an allowlisted cache from its fresh DB result, but must never read an existing entry.

Invalidate locally **after successful transaction commit and before acknowledging the mutation**. Use tags rather than clearing whole stores. Other replicas are not assumed to receive an invalidation event in v1; immediate own-device reads use the 30-second bypass window, critical views on other devices poll DB directly, and noncritical cross-replica staleness is bounded by the configured TTL.

| Successful mutation | Targeted read families |
| --- | --- |
| Customer/child create or edit; customer status | Customers, affected customer sales/orders/due, customer-dependent search and applicable dashboard activity |
| Product create/edit; stock adjustment | Products, catalog, stock/history, inventory reports and dashboard stock |
| Expense category or expense | Categories, expenses, expense reports, dashboard expense; **no implied cash movement** |
| Supplier create/edit; purchase create/status/payment | Suppliers, purchases, supplier history/dues/reports and applicable dashboard; supplier payment does **not** automatically change shop cash |
| Receipt upload | Purchase detail and receipt metadata only; never receipt bytes or signed URLs |
| Raw-material create/edit | Raw materials and raw-material cost reports |
| Custom-order create/edit/status/payment | Orders, customer orders/dues, relevant reports/dashboard; cash only when a payment actually creates an inflow |
| Sale create/void/replace | Sales/history, affected customer, stock/catalog, cash, financial reports/events and dashboard |
| Cash opening, manual in/out, reconciliation | Cash/reports/dashboard as applicable; a reconciliation **observation** is not a cash movement unless a separate adjustment succeeds |
| Auth/account/role/session change | Browser-account purge and renewed authorization; no backend auth-response cache |

## 4. Ordered delivery slices and gates

1. **Baseline and correctness.** Inventory worktree and deployed revision; capture performance/resource baseline. Verify the current 100-row Sales/Customer report change does not silently omit required records, and audit the still-invalid exported custom-order helper. Fix only correctness issues required to establish a trustworthy baseline. Run both roles and representative reports **with caches off**. Gate: response shapes and report meaning are known and tested.
2. **L1 foundation.** Add account query boundary, key factory, per-domain freshness, cancellation, limited prefetch, critical polling and central mutation effects. Migrate screens incrementally: existing Sales/Customers first, then dashboard/critical views, then remaining domain GET consumers. Gate: no account crossover, correct pagination, direct-DB critical refresh, targeted invalidation and no unnecessary full-directory loads.
3. **L2 IndexedDB.** Add schema, freshness bridge, retention/quota eviction, offline stale display, purge and reconnect behavior behind `VITE_BROWSER_CACHE_ENABLED`. Gate: verified warm offline tab is read-only, cold offline load reveals nothing protected, logout/401/account switch purge, and IndexedDB failure does not break network reads.
4. **L3 static CDN.** Configure/check immutable caching for hashed Vite assets and revalidation for HTML. Preserve the `/api/v1/*` external rewrite before SPA fallback and keep authenticated API CDN caching off. Gate: deployed deep-link refresh, asset headers, HTML headers, and API `no-store` verified. A later selected safe/shared API CDN pilot is a separate decision.
5. **L4 RAM.** Enable allowlisted endpoints one group at a time behind `API_RESPONSE_CACHE_ENABLED`. Gate per endpoint: authorization before hit, correct sharing scope, Owner/Employee isolation, TTL, bypass, tag invalidation, in-flight race protection and 75 MiB bound.
6. **L5 disk.** Enable only after L4 is stable, behind `API_DISK_CACHE_ENABLED`. Gate: same keys/expiry, atomic writes, restart/corruption/read-only/full-disk tests, eviction and reserve protection; no API correctness or readiness regression.
7. **Pilot and measured expansion.** Local integration → synthetic-data Northflank pilot → limited production endpoint groups. Keep flags independently reversible. Observe at least seven representative days before raising limits or enrolling additional endpoints. Never infer live-data readiness from a build or health check.

## 5. Tests, observability and acceptance

Extend the API's existing `node:test` suite against **dedicated local PostgreSQL only**. Test anonymous/forbidden requests even when a shared entry is warm; two users of one role sharing an identical response; Owner-warmed Sales never leaking cost to Employee; validated key normalization; TTL and midnight behavior; post-write bypass; tag invalidation for every mutation family; concurrent misses; stale in-flight insertion race; rollback and idempotent retries; and financial/report results identical with cache on versus off. Never point destructive tests at hosted Aiven.

Add IndexedDB unit/integration tests (for example with `fake-indexeddb`) and real-browser E2E tests for offline cold/warm states, quota failure, logout/session expiry, account switch, cross-tab invalidation, visible 30-second polling, focus/manual refresh and reconnect. Keep older mock-oriented smoke checks separate from real API acceptance. At each slice run root `npm run lint` and `npm run build`, API `npm run build` and `npm test`, plus relevant browser tests. Record revision/environment and precisely which checks passed, failed or skipped.

Collect per-layer hit/miss/bypass/eviction/error counts, entry bytes/age, response p50/p95, DB load, Node heap/RSS/GC, filesystem free space and sampled critical-view age. Emit aggregate diagnostics only—no raw cache keys, search strings, customer data or secrets. Consider **75 → 90 MiB RAM** only after seven representative days with p95 RSS under 65% of pod limit, peak under 75%, GC-pause p95 under 25 ms, no OOM/restarts, sustained capacity eviction pressure and measurable DB-load/latency benefit. Consider **450 → 500 MiB disk soft target** only if p95 free space exceeds 350 MiB, observed minimum exceeds 300 MiB, cache-write p95 stays below 20 ms, no ENOSPC/I/O errors occur, and L5 provides measurable benefit. The **550 MiB hard cap never rises automatically**; under pressure trim or stop cache writes.

Assumptions: one shop today; trusted devices for L2; eight-hour L2 retention; no offline writes; no cross-replica invalidation bus in the first rollout; direct-DB 30-second refresh for visible critical views; authenticated API CDN caching disabled initially; PostgreSQL remains authoritative.

## References

- [TanStack Query important defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)
- [TanStack Query invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)
- [Vercel rewrite caching](https://vercel.com/docs/routing/rewrites)
- [Northflank ephemeral storage](https://northflank.com/docs/v1/application/scale/increase-storage)
