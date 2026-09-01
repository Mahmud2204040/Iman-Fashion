# NI Fashion — Frontend

Mobile-responsive web application for **NI Fashion**, a clothing shop that sells school and college dresses and accessories (Shirt, Pant, Salwar, Kamiz, Orna, Frock, Shoe, Bag, etc.). The shop also manufactures some of its own clothing products.

> **Status:** Phase 0 — Project setup only.
> This phase contains **only** the Vite + React scaffold. No business modules, no auth, no backend.

---

## Stack

- React 18
- Vite 5
- JavaScript (no TypeScript)
- CSS Modules / plain CSS
- `react-router-dom` (the only runtime dependency installed)

No UI, state, icon, animation, or utility libraries have been added.

## Scripts

```bash
npm install      # install dependencies
npm run dev      # start Vite dev server
npm run build    # production build
npm run preview  # preview the production build
npm run lint     # run ESLint
```

## Project layout

```text
.
├── index.html
├── package.json
├── vite.config.js
├── eslint.config.js
├── .gitignore
├── README.md
└── src/
    ├── main.jsx
    ├── App.jsx
    └── styles/
        └── global.css
```

The full `src/` tree (components, pages, layouts, routes, hooks, services, utils, constants, mock) will be created in **Phase 1 — Frontend Architecture**.

## Planning documents

All decisions and scope are governed by the following documents, in this priority order:

1. `PROJECT_RULES.md` — engineering constitution (highest priority).
2. `REQUIREMENTS.md` — software requirements specification.
3. `DATABASE_PLAN.md` — database schema (relevant once backend starts).
4. `FRONTEND_PLAN.md` — phase-by-phase frontend plan that drives this implementation.

## What is intentionally NOT here yet

- No backend, no database, no Prisma, no Express.
- No authentication implementation (mock auth lands in Phase 3).
- No routing beyond what Vite needs.
- No dashboard, no sales, no business modules (Phases 4+).
