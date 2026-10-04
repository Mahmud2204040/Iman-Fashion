# Iman Fashion

Iman Fashion is an internal clothing-shop management application for an Owner and Employees.

**Current state:** React/Vite login, session restore, sign-out, profile passwords and Owner-managed Employee accounts use the Express/Prisma API in [`api/`](api/README.md). The backend has first-pass business APIs, migrations and local database tests; sales, customers, stock, cash and report screens still use in-memory mock services rather than those APIs. Hosted deployment and real-data acceptance remain open.

Start with [the documentation index](document/README.md). It contains the current requirements, workflows, permissions, schema, delivery plan and known implementation gaps. Documentation completion does not mean the application is complete.

## Run locally

~~~sh
npm install
npm run dev
npm run lint
npm run build
~~~

Use `npm ci` for a reproducible installation from the lockfile. Start PostgreSQL and the API using the [API local setup](api/README.md) before signing in. Bootstrap an Owner with your own password; the old `owner / 1234` and `employee / 1234` mock credentials do not work in the active frontend. The frontend defaults to an API on the same hostname at port `4440`; override it at build time with `VITE_API_BASE_URL` if needed.

## Run the current Docker frontend

~~~sh
docker compose up --build -d
docker compose ps
docker compose logs web
docker compose down
~~~

Open [the local application](http://127.0.0.1:8080). Docker serves the compiled frontend only; PostgreSQL and the API must be started separately. Business data still uses mock services. Rebuild the image after source changes. For a different API address, pass `VITE_API_BASE_URL` during the frontend build (Vite embeds it into the bundle).

## Project map

| Path | Purpose |
| --- | --- |
| `document/` | Active project documentation |
| `document/archive/` | Historical specifications and reports; not current authority |
| `src/` | Frontend pages, components, routes, services and mock data |
| `api/` | Express/Prisma auth, business APIs, reporting, receipt handling and migrations |
| `scripts/` | Existing mock business-service smoke tests; the legacy auth smoke test does not exercise API login |
| `Dockerfile`, `compose.yaml`, `docker/` | Current frontend container |

See [Project Status](document/PROJECT_STATUS.md) for verified versus unverified work and [Implementation Plan](document/IMPLEMENTATION_PLAN.md) for the next milestones.
