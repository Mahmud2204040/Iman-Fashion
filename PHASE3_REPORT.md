# Phase 3 — Authentication UI — Implementation Report

Phase 3 of `FRONTEND_PLAN.md` is complete. The frontend now has a fully working
mock authentication flow, role-based route guards, and a login screen that
matches the Phase 2 design system. No backend, no database, no extra
dependencies were introduced.

---

## 1. Scope executed (per `FRONTEND_PLAN.md` §21)

- Mock authentication (`owner` / `employee`, password `1234`).
- `<AuthProvider>` mounted above the router, exposing a single source of truth
  for the current user.
- `<ProtectedRoute>` — gates any subtree behind "must be logged in".
- `<RoleRoute roles={[...]}>` — additional role check; renders the
  `UnauthorizedPage` for the wrong role instead of silently redirecting.
- `<RootRedirect>` — sends `/` to `/dashboard` (authenticated) or `/login`
  (unauthenticated), with no flash of intermediate content.
- `LoginPage` with username, password, **Remember me**, in-line client-side
  validation, generic error message, loading state, and a visible
  **"Development mock"** banner.
- `UnauthorizedPage` (403) with role display, **Back to Dashboard** and
  **Sign out** actions.
- Session storage honours "Remember me":
  - checked → `localStorage`
  - unchecked → `sessionStorage`
- On reload, the session is restored transparently (no forced re-login when
  the storage still holds a valid mock user).
- All non-existent business-module pages are wired to the existing Phase 1
  placeholder shells so navigation can be exercised end-to-end.

### Out of scope (deferred per user instruction)

- **Phase 4** dashboard cards and any later business module.
- Any real authentication, HTTP calls, JWT handling, or token refresh.
- Touching `PROJECT_RULES.md`, `REQUIREMENTS.md`, `DATABASE_PLAN.md`, or
  `FRONTEND_PLAN.md`.

---

## 2. Files created

| Path | Purpose |
| --- | --- |
| `src/constants/roles.js` | `ROLES` and `ROLE_VALUES` constants (single source for the role strings). |
| `src/constants/storage.js` | `STORAGE_KEYS.SESSION` and `STORAGE_KIND` constants. |
| `src/mock/users.js` | `MOCK_USERS` fixtures + `MOCK_PASSWORD = '1234'`. |
| `src/services/delay.js` | Tiny `delay(ms)` helper used by every mock service. |
| `src/services/auth/authService.js` | `login`, `logout`, `getCurrentUser` (localStorage / sessionStorage aware). |
| `src/contexts/authContext.js` | Plain-JS `createContext(null)` — kept separate from the Provider to keep Fast Refresh happy. |
| `src/contexts/AuthContext.jsx` | `<AuthProvider>` — restores session on mount, exposes `{ user, role, isAuthenticated, isLoading, login, logout }`. |
| `src/hooks/useAuth.js` | Consumer hook with a "must be used inside provider" guard. |
| `src/hooks/useRole.js` | `isOwner`, `isEmployee`, `isAuthenticated`, `canSee(field)`, `canAct(action)` derived from the documented visibility / action matrices. |
| `src/routes/ProtectedRoute.jsx` | Auth gate. Bounces to `/login` (preserving `from`) and renders nothing while restoring the session. |
| `src/routes/RoleRoute.jsx` | Auth + role gate. Renders `<UnauthorizedPage />` for the wrong role. |
| `src/routes/RootRedirect.jsx` | `/` → `/dashboard` or `/login`, no flash. |
| `src/pages/UnauthorizedPage.jsx` | 403 page with Back-to-Dashboard and Sign-out actions. |
| `src/pages/UnauthorizedPage.module.css` | Token-based styling. |
| `src/pages/auth/LoginPage.jsx` | Full login form: username, password, remember-me, mock banner, loading + error states. |
| `src/pages/auth/LoginPage.module.css` | Mobile-first responsive styling using Phase 2 tokens. |

## 3. Files modified

| Path | Change |
| --- | --- |
| `src/main.jsx` | Wraps `<App />` with `<BrowserRouter>` and `<AuthProvider>`. |
| `src/routes/AppRoutes.jsx` | Phase 1 stub → full route table: public `/login`, default `/` → `RootRedirect`, `ProtectedRoute` for both roles, `RoleRoute roles={[OWNER]}` for owner-only modules. |

## 4. Authentication architecture

```
                       ┌──────────────────────┐
                       │   <React.StrictMode> │
                       └──────────┬───────────┘
                                  │
                       ┌──────────▼───────────┐
                       │   <BrowserRouter>    │
                       └──────────┬───────────┘
                                  │
                       ┌──────────▼───────────┐
                       │   <AuthProvider>     │   ← session restore on mount
                       └──────────┬───────────┘
                                  │
                                <App>
                                  │
                            <AppRoutes>
                                  │
   ┌──────────────────────────────┼─────────────────────────────────┐
   │                              │                                 │
   │            public            │           protected             │
   │        ┌────────────┐        │   <ProtectedRoute>              │
   │        │  /login    │        │     ├─ /dashboard   (both)     │
   │        │  LoginPage │        │     ├─ /sales*      (both)     │
   │        └────────────┘        │     └─ /design-system (dev)    │
   │                              │                                 │
   │              /               │   <RoleRoute roles={[OWNER]}>   │
   │       <RootRedirect> ────────┼──►   ├─ /products*              │
   │                              │     ├─ /suppliers*             │
   │                              │     ├─ /purchases*             │
   │                              │     ├─ /raw-materials          │
   │                              │     ├─ /expenses               │
   │                              │     ├─ /cash                   │
   │                              │     └─ /reports*               │
   │                              │                                 │
   │                              │   catch-all: <NotFoundPage />   │
   │                              │                                 │
```

### Hook / service / mock layering

```
LoginPage ──► useAuth ──► AuthContext ──► authService ──► MOCK_USERS / storage
                                                                 │
                                                                 ▼
                                                       localStorage /
                                                       sessionStorage
```

### Session restore flow

1. `<AuthProvider>` mounts with `isLoading = true`.
2. `useEffect` calls `authService.getCurrentUser()`.
3. `authService` reads whichever storage still holds the session and returns
   the user or `null`.
4. State updates, `isLoading` flips to `false`.
5. `<ProtectedRoute>` / `<RoleRoute>` / `<RootRedirect>` then render the
   appropriate destination.

### "Remember me" semantics

- `authService.login({ username, password, rememberMe })`
- `rememberMe === true` → write to `localStorage`
- `rememberMe === false` → write to `sessionStorage`
- `authService.getCurrentUser()` checks `localStorage` first, then
  `sessionStorage`, then returns `null`.
- `authService.logout()` clears **both** stores.

### Generic error handling

`authService.login` throws typed errors (`EMPTY_USERNAME`, `EMPTY_PASSWORD`,
`INVALID_CREDENTIALS`). The login UI catches them, but always surfaces a
single generic message — *"Invalid username or password"* — so the page
never reveals which field was wrong or whether the username exists.

---

## 5. Role helpers — `useRole`

`useRole` exposes pure derived values so pages do not have to read `user.role`
themselves:

| Helper | Returns |
| --- | --- |
| `isOwner` | `true` when the logged-in user's role is `OWNER`. |
| `isEmployee` | `true` when the role is `EMPLOYEE`. |
| `isAuthenticated` | mirrors `AuthContext.isAuthenticated`. |
| `canSee(fieldKey)` | `false` for any field listed in `EMPLOYEE_HIDDEN_FIELDS` (e.g. cost, profit, supplier, expense). |
| `canAct(actionKey)` | `false` for any action listed in `EMPLOYEE_DENIED_ACTIONS` (e.g. `cancel-custom-order`, `open-reports`). |

The hidden-field and denied-action sets are sourced verbatim from
`REQUIREMENTS.md` §79 and `PROJECT_RULES.md` §8 — no permissions were
invented for this phase.

---

## 6. Route protection summary

| Path | Guard | Visible to |
| --- | --- | --- |
| `/` | `<RootRedirect>` | Everyone |
| `/login` | (public; page itself bounces if already authed) | Everyone |
| `/dashboard` | `<ProtectedRoute>` | OWNER + EMPLOYEE |
| `/sales`, `/sales/:id` | `<ProtectedRoute>` | OWNER + EMPLOYEE |
| `/customers`, `/customers/:id` | `<ProtectedRoute>` | OWNER + EMPLOYEE |
| `/custom-orders`, `/custom-orders/:id` | `<ProtectedRoute>` | OWNER + EMPLOYEE |
| `/products`, `/products/:id` | `<RoleRoute roles={[OWNER]}>` | OWNER only |
| `/suppliers`, `/suppliers/:id` | `<RoleRoute roles={[OWNER]}>` | OWNER only |
| `/purchases`, `/purchases/:id` | `<RoleRoute roles={[OWNER]}>` | OWNER only |
| `/raw-materials` | `<RoleRoute roles={[OWNER]}>` | OWNER only |
| `/expenses` | `<RoleRoute roles={[OWNER]}>` | OWNER only |
| `/cash` | `<RoleRoute roles={[OWNER]}>` | OWNER only |
| `/reports`, `/reports/:reportType` | `<RoleRoute roles={[OWNER]}>` | OWNER only |
| `/design-system` | `<ProtectedRoute>` | OWNER + EMPLOYEE (dev preview) |
| `*` | (none — `<NotFoundPage>`) | Everyone |

Per `PROJECT_RULES.md` §9, the route guards are **a UX gate only**; the
backend must enforce every authorization decision when it lands.

---

## 7. Validation

| Check | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | ✅ 0 errors, 0 warnings |
| Build | `npm run build` | ✅ 94 modules transformed, `dist/` written in 1.09 s, bundle 189 kB (61 kB gzip) |
| Dev server | `npm run dev` | ✅ Vite ready in 391 ms on `http://localhost:5173/` |
| Module compile probe | `GET /src/{AuthContext.jsx, useAuth.js, useRole.js, AppRoutes.jsx, ProtectedRoute.jsx, RoleRoute.jsx, authService.js, LoginPage.jsx, main.jsx}` | ✅ all 200, all transformed non-empty |

### Manual test checklist (per `FRONTEND_PLAN.md` §22)

| # | Scenario | Expected | Where covered |
|---|----------|----------|---------------|
| 1 | `owner` / `1234` | `/dashboard` as OWNER | `authService.login` + `AuthProvider.login` + `LoginPage` redirect |
| 2 | `employee` / `1234` | `/dashboard` as EMPLOYEE | same |
| 3 | `owner` / wrong password | "Invalid username or password" | generic message in `LoginPage` |
| 4 | Logged out → `/dashboard` | redirect to `/login` (preserves `from`) | `<ProtectedRoute>` |
| 5 | EMPLOYEE → `/products` | `UnauthorizedPage` | `<RoleRoute>` |
| 6 | OWNER → every owner-only route | renders the page | `<RoleRoute roles={[OWNER]}>` |
| 7 | "Remember me" ON + reload | still authenticated | `authService.getCurrentUser` reads `localStorage` first |
| 8 | Logout | back to `/login`, can't re-enter protected routes | `authService.logout` clears both stores + `<ProtectedRoute>` redirect |
| 9 | Authenticated + `/login` | redirect to `/dashboard` | `useEffect` + `<Navigate>` guard in `LoginPage` |

---

## 8. Notes & non-inventions

- **No** new npm dependency was installed; `react-router-dom` is the only
  runtime dependency, unchanged.
- **No** planning document was modified.
- **No** dashboard card, report, expense, or business data was rendered —
  the placeholder shells from Phase 1 are reused so the route table is
  navigable end-to-end, but their content is intentionally empty.
- **No** real validation, password hashing, JWT, or refresh-token logic —
  every error path is a `setTimeout`-based `delay` call.
- **No** backend, database, or HTTP layer touched.
- The `react-refresh/only-export-components` lint rule is satisfied by
  splitting the React `createContext` call into `src/contexts/authContext.js`
  (plain JS) and the `<AuthProvider>` into `src/contexts/AuthContext.jsx`
  (component-only), exactly as the rule expects.

---

## 9. Status

**Phase 3 — Authentication UI: complete.**

Ready for review. Per user instruction, implementation stops here; no
Phase 4 work has been started.

---

## 10. Post-review debug — blank `/login` page

After the first Phase 3 commit the user reported that
`http://localhost:5173/login` rendered a completely blank page. The
root cause and fix are recorded below.

### 10.1 Reproduction

```
$ curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:5173/login
200
```

The HTTP shell and the Vite-served `main.jsx` were both delivered with
status 200 — so the request was reaching the browser. The browser
rendered nothing because the React tree unmounted during the first
render.

### 10.2 Root cause

`src/components/common/FormField/FormField.jsx` is a **render-prop
component**. Its `children` is invoked as a function:

```jsx
<div className={styles.control}>
  {children({ id: fieldId, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
</div>
```

`src/pages/auth/LoginPage.jsx` was passing a React **element** as
children:

```jsx
<FormField label="Username" htmlFor={usernameId} required error={...}>
  <Input id={usernameId} name="username" type="text" ... />
</FormField>
```

When `FormField` ran `children({...})` against the `<Input />` element,
React threw `TypeError: children is not a function` during render.
React 18 then unmounted the whole tree → blank page.

### 10.3 Fix

Both `<FormField>` instances in `LoginPage.jsx` now follow the
render-prop contract:

```jsx
<FormField label="Username" htmlFor={usernameId} required error={...}>
  {(controlProps) => (
    <Input
      id={usernameId}
      name="username"
      type="text"
      autoComplete="username"
      value={username}
      onChange={(e) => setUsername(e.target.value)}
      invalid={Boolean(fieldErrors.username)}
      disabled={submitting}
      placeholder="owner or employee"
      autoFocus
      {...controlProps}
    />
  )}
</FormField>
```

`controlProps` (i.e. `id`, `aria-describedby`, `aria-invalid`) is spread
on the input so accessibility wiring still works.

### 10.4 Verification

After the fix:

| Check                          | Result |
|--------------------------------|--------|
| `npm run lint`                 | 0 errors, 0 warnings |
| `npm run build`                | 94 modules → 189.08 kB JS, 20.76 kB CSS, built in 1.19s |
| `/login` HTTP                  | 200, body contains `<div id="root">` and `/src/main.jsx` |
| Vite-transformed `main.jsx`    | 200, no transform error |
| Module graph (2 layers deep)   | `App.jsx`, `AuthContext.jsx`, `authService.js`, `authContext.js` all 200 |
| Auth service smoke (`smoke-auth.mjs`) | 8/8 — see below |

Auth service smoke (`node smoke-auth.mjs`) covers:

```
OK   owner / 1234 → role OWNER
OK   owner invalid → INVALID_CREDENTIALS
OK   empty username → EMPTY_USERNAME
OK   empty password → EMPTY_PASSWORD
OK   rememberMe ON → restores from localStorage
OK   rememberMe OFF → restores from sessionStorage only
OK   logout clears both stores
OK   tampered JSON in storage → null (defensive)
```

### 10.5 Notes on the failed smoke test

The first run of the smoke test reported
`rememberMe OFF → restores from sessionStorage only` as failing because
`localStorage` was not empty. Investigation showed this was a
**test-isolation artifact**: the script had aliased `localStorage` and
`sessionStorage` to the **same** in-memory `Map`. The real `authService`
already calls `localStorage.removeItem` and `sessionStorage.removeItem`
on every `login()` (in `writeSession`), so with two distinct stub stores
the test passes — confirming no real bug exists in the auth service.

### 10.6 Verification artifacts (not part of the runtime app)

Two probe scripts were added at the workspace root during debugging and
are **not** part of the production app — they are listed here for
transparency:

- `smoke-auth.mjs` — Node-side smoke test for `authService`.
- `probe-and-serve.mjs` — Spawns `vite dev` and walks the module
  graph as served by Vite.
- `probe-login.ps1` — PowerShell variant of the same probe.
- `package.json` gained `"probe:login"` for convenience.

These can be deleted or kept; they do not affect `vite build` or any
production code path.