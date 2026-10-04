> ARCHIVED on 2026-10-01. Historical reference only; this file is not an active specification.
> Read [the active documentation index](../../README.md) before using any rule or completion claim below.

# NI Fashion — Frontend

Mobile-responsive web application for **NI Fashion**, a clothing shop that sells school and college dresses and accessories (Shirt, Pant, Salwar, Kamiz, Orna, Frock, Shoe, Bag, etc.). The shop also manufactures some of its own clothing products.

> **Status:** Frontend with mock services and mock authentication. There is no backend or persistent database yet.

---

## Stack

- React 18
- Vite 5
- JavaScript (no TypeScript)
- CSS Modules / plain CSS
- React Router

The frontend includes shop screens and mock service modules. Docker serves its compiled output; it does not add a real API, authentication, or persistent business data.

## Scripts

```bash
npm install      # install dependencies
npm run dev      # start Vite dev server
npm run build    # production build
npm run preview  # preview the production build
npm run lint     # run ESLint
```

## Docker (current frontend)

With Docker running, build and start the frontend container:

```bash
docker compose up --build -d
```

Open <http://localhost:8080>. The web service binds to the local machine only. React Router pages also work when opened directly or refreshed.

```bash
docker compose ps          # inspect the container and health status
docker compose logs web    # inspect web server output
docker compose down        # stop and remove the container
```

The frontend still uses mock login and in-memory mock data. It should not be exposed as a production shop system. The planned Express/Prisma/PostgreSQL services are described in `DOCKER_PLAN.md` and will be added when the backend exists.

## Project layout

```text
.
├── index.html
├── package.json
├── vite.config.js
├── eslint.config.js
├── .gitignore
├── .dockerignore
├── Dockerfile
├── compose.yaml
├── docker/
│   └── nginx.conf
├── README.md
└── src/
    ├── main.jsx
    ├── pages/
    ├── services/
    ├── components/
    └── styles/
```

## Planning documents

All decisions and scope are governed by the following documents, in this priority order:

1. `PROJECT_RULES.md` — engineering constitution (highest priority).
2. `REQUIREMENTS.md` — software requirements specification.
3. `DATABASE_PLAN.md` — database schema (relevant once backend starts).
4. `FRONTEND_PLAN.md` — phase-by-phase frontend plan that drives this implementation.
5. `DOCKER_PLAN.md` — Docker implementation stages.

## What is intentionally NOT here yet

- No backend, database, Prisma schema, or Express API.
- No production authentication or persistent business data.
