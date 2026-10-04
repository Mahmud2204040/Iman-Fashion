> ARCHIVED on 2026-10-01. Historical reference only; this file is not an active specification.
> Read [the active documentation index](../../README.md) before using any rule or completion claim below.

# NI Fashion Docker Containerization Plan

**Status:** Stage A implemented and verified on 30 Sep 2026. Stage B is planned for when the backend exists.

## 1. Current state and target

The repository currently contains a React 18 / Vite 5 frontend. Its services and login are mocks. There is no Express application, Prisma schema, PostgreSQL integration, or existing Docker configuration. The project rules specify JavaScript, Express, Prisma, PostgreSQL, and JWT for the eventual application.

The Docker work therefore has two stages:

| Stage | Runnable services | Outcome |
| --- | --- | --- |
| A: current repository | `web` | Implemented: the existing compiled frontend runs locally in one container. This remains a mock application. |
| B: after backend exists | `web`, `api`, `db` | Run the application with persistent PostgreSQL data and uploaded receipt images. |

## 2. Stage A: frontend container

1. Add a root `Dockerfile` with a Node build stage. Copy `package.json` and `package-lock.json`, run `npm ci`, copy the frontend source, then run `npm run build`.
2. Use a small static web server image for the runtime stage. Copy only `dist/` into it; do not ship Node dependencies or source files in the runtime image. Use an unprivileged runtime and a nonprivileged port such as `8080` if supported by the selected image.
3. Add `docker/nginx.conf` (if Nginx is selected) to serve assets and fall back to `index.html` for React Router paths such as `/login` and `/sales/123`.
4. Add `.dockerignore` to exclude `node_modules`, `dist`, `.git`, `.env*`, logs, generated reports, and temporary files. Keep an example environment file if one is later added.
5. Add `compose.yaml` with a single `web` service, a local host mapping such as `127.0.0.1:8080:8080`, and a restart policy appropriate for local use. Do not add an empty API or database service before those applications exist.
6. Document `docker compose up --build -d`, `docker compose logs web`, and `docker compose down` in `README.md` when Stage A is implemented.

**Stage A completion checks:** `npm run build` succeeds inside the image; the home page and a nested route both load after direct navigation and browser refresh; static assets return successfully; the container restarts cleanly. The mock user/data behavior must be described accurately: Docker does not provide backend authentication or durable business data.

**Verification on 30 Sep 2026:** `docker compose config --quiet` and `docker compose build web` passed. `docker compose up --build -d web` started a healthy container. HTTP checks returned 200 for `/`, `/login`, `/sales/123`, `/custom-orders/new`, a compiled JavaScript asset, and the logo favicon. A missing compiled asset returned 404. After `docker compose restart web`, the container returned to healthy and a nested route returned 200. Browser interaction has not been separately tested.

## 3. Stage B: full application Compose stack

After the Express API and Prisma schema are implemented:

1. Add an API Dockerfile that installs locked dependencies, runs any required Prisma client generation, and starts the production Express command. The API must listen on the container network interface and provide a health endpoint.
2. Extend `compose.yaml` with `api` and `db` services on a private Compose network. The API connects to PostgreSQL using `db` as the hostname in `DATABASE_URL`. Expose only the web entry point publicly. Publish the database port only for a deliberate local development override.
3. Give PostgreSQL a named volume for its data. Add a database health check and start the API only when the database is healthy. Apply versioned Prisma migrations with `prisma migrate deploy` through a controlled one-shot migration step before serving traffic; do not run development migrations against production data.
4. Route `/api/` from the web server to the API service on the same origin. This avoids a hardcoded browser URL and lets the frontend use relative `/api/...` calls. Update the frontend service layer to call the real API as part of backend integration.
5. Persist uploaded supplier receipt images in a dedicated volume or object storage; define one canonical upload path and a matching public/authenticated retrieval route. Back up both the database and uploaded files.
6. Pass database credentials, `JWT_SECRET`, and storage credentials through deployment environment or secrets management. Commit only `.env.example`; keep actual secrets out of Git and images. Never use the frontend's mock credentials as production authentication.
7. Add production-specific Compose overrides only when deployment details are known (domain, TLS termination, backup destination, and host). No application source bind mounts in production.

**Stage B completion checks:** migrations succeed on an empty database and on an existing test database; API readiness waits for PostgreSQL; sale, cash, and stock writes remain atomic; receipt uploads and database records survive container recreation; backup and restore are tested; owner-only API routes reject employee users; direct and refreshed frontend routes work through the same web entry point.

## 4. File sequence

| Order | File/change | Stage |
| --- | --- | --- |
| 1 | `.dockerignore` | A |
| 2 | `Dockerfile` | A |
| 3 | `docker/nginx.conf` | A |
| 4 | `compose.yaml` with `web` | A |
| 5 | `README.md` run instructions | A |
| 6 | Backend Dockerfile and API health endpoint | B |
| 7 | Extend `compose.yaml` with `api`, `db`, network, volumes, health checks | B |
| 8 | `.env.example`, migration procedure, backup/restore instructions | B |

## 5. Boundary to keep clear

Stage A is a deployable container for the current UI, not a production shop management system. The current frontend uses mock services and mock login, so it cannot satisfy the database, security, and persistence requirements until Stage B backend work is completed.

## References

- [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker Node.js containerization guide](https://docs.docker.com/guides/nodejs/)
- [Docker Compose production guidance](https://docs.docker.com/compose/how-tos/production/)
