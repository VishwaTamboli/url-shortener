# URL Shortener

A minimal URL shortener API built with **NestJS**, **TypeScript**, **PostgreSQL**, and **TypeORM**.
Create short URLs, redirect visitors with HTTP 302, and track click counts.

## Technology stack

- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: TypeORM (migrations; `synchronize` stays `false`)
- Validation: `class-validator` + `class-transformer`
- Tests: Jest + Supertest (43 tests, real local PostgreSQL)
- API docs: Swagger at `/api/docs`

## Prerequisites

- Node.js 24+ and npm
- PostgreSQL 17 running locally (Homebrew: `brew services start postgresql`)

## Installation

```bash
npm install
cp .env.example .env   # then adjust values if needed
```

## Database creation and configuration

Create the database once (default owner `vishwa`, no password on local trust auth):

```bash
psql -h localhost -U vishwa -d postgres -c "CREATE DATABASE url_shortener;"
```

Connection settings live in `.env` (see `.env.example` as the source of truth):

| Variable      | Default               | Purpose                              |
|---------------|-----------------------|--------------------------------------|
| `PORT`        | `3000`                | HTTP port                            |
| `BASE_URL`    | `http://localhost:3000` | Prefix used to build `shortUrl`    |
| `DB_HOST`     | `localhost`           | Postgres host                        |
| `DB_PORT`     | `5432`                | Postgres port                        |
| `DB_USERNAME` | `vishwa`              | Postgres user                        |
| `DB_PASSWORD` | *(empty)*             | Postgres password, if required       |
| `DB_NAME`     | `url_shortener`       | Database name                        |
| `TYPEORM_SYNC`| `false`               | Must stay `false`; use migrations    |
| `REDIS_URL`   | `redis://localhost:6379` | Redis for short-code cache (fail-open to PostgreSQL) |
| `REDIS_TTL_SECONDS` | `3600`           | Cache TTL for `url:{code}` entries   |
| `DB_SSL`      | `false`               | Set `true` for hosted TLS Postgres (Neon) |
| `FRONTEND_URL`| *(empty)*             | Comma-separated CORS origin(s) for production frontend |

Never commit `.env` (it is git-ignored). Never enable `TYPEORM_SYNC=true` outside throwaway experiments.

## Migrations

Schema changes go through TypeORM migrations in `src/migrations/`. Apply pending migrations:

```bash
npm run migration:run
```

Other helpers:

```bash
npm run migration:generate -- src/migrations/DescribeChange   # generate from entities
npm run migration:revert                                       # revert last migration
```

The CLI data source is `src/data-source.ts`.

## Running the app

```bash
npm run start:dev   # watch mode
npm run start       # single run (after build)
npm run start:prod  # production: runs compiled dist/main (use on hosts)
```

Frontend (`client/`, separate terminal):

```bash
cd client
npm install
cp .env.example .env   # VITE_API_BASE_URL=http://localhost:3000
npm run dev            # Vite at http://localhost:5173
```

- Health: `GET http://localhost:3000/health` → `{"status":"ok"}`
- Swagger UI: `http://localhost:3000/api/docs`
- Swagger JSON: `http://localhost:3000/api/docs-json`

## Tests and build

```bash
npm test        # Jest (uses --experimental-vm-modules for Nest ESM packages, --runInBand so suites share one DB safely)
npm run build   # production build to dist/
```

## API endpoints

### POST /api/urls — create a shortened URL

```bash
curl -X POST http://localhost:3000/api/urls \
  -H 'Content-Type: application/json' \
  -d '{"originalUrl":"https://example.com/very/long/url"}'
```

`201`:

```json
{"shortCode":"aB3x9Qz","shortUrl":"http://localhost:3000/aB3x9Qz","originalUrl":"https://example.com/very/long/url"}
```

`400` for missing/invalid URLs (protocol `http(s)` required), unknown fields, or overlong input.
Creation never counts as a click.

### GET /:code — redirect

```bash
curl -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://localhost:3000/aB3x9Qz
# 302 -> https://example.com/very/long/url
```

Known code → `302 Found` with `Location: <originalUrl>`, and `clicks` increments atomically
(safe under concurrent requests). Unknown code → `404 {"message":"Short URL not found",...}`.

### GET /api/urls/:code/stats — click statistics

```bash
curl http://localhost:3000/api/urls/aB3x9Qz/stats
```

`200`:

```json
{"shortCode":"aB3x9Qz","originalUrl":"https://example.com/very/long/url","clicks":3,"createdAt":"2026-10-11T14:41:01.830Z"}
```

Unknown code → `404`. Error responses never include SQL, credentials, or stack traces.

## Deployment (Neon + Render + Vercel)

Nothing is deployed yet. Do the steps in order: database first, then backend, then frontend.
The backend reads `PORT` from the environment (Render injects it), serves compiled
`dist/main` via `npm run start:prod`, and builds `shortUrl` from `BASE_URL` — so each
environment just needs the right variables, no code changes.

### 1. Neon (PostgreSQL)

1. Create a Neon account/project, then create a database (e.g. `url_shortener`).
2. From the Neon dashboard connection details, copy: **host**, **port** (usually `5432`),
   **database**, **user**, **password**. Neon requires TLS.
3. Apply the schema from your local machine without touching `.env` (values inline only):

```bash
DB_HOST=<neon-host> DB_PORT=5432 DB_USERNAME=<user> DB_PASSWORD=<password> \
DB_NAME=url_shortener DB_SSL=true npm run migration:run
```

Expected output ends with `Migration CreateUrls1791728225000 has been executed successfully`
(or `No migrations are pending` on repeat runs). `migration:revert` rolls back one step
if ever needed — ask before running anything destructive against production data.

### 2. Render (NestJS backend)

Manual dashboard steps (no resources created by this repo):

1. Push this repository to GitHub (Vercel and Render both deploy from git).
2. Render → **New → Web Service** → select the repo. Settings:
   - **Root Directory:** *(blank — backend lives at the repo root)*
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start:prod`
   - **Health Check Path:** `/health`
3. Add environment variables (Render dashboard → Environment). Do **not** set `PORT`
   yourself — Render injects it and the app already listens on `process.env.PORT`:

| Variable       | Value                                              |
|----------------|----------------------------------------------------|
| `BASE_URL`     | `https://<your-service>.onrender.com` (no trailing slash) |
| `DB_HOST`      | Neon host                                          |
| `DB_PORT`      | `5432`                                             |
| `DB_USERNAME`  | Neon user                                          |
| `DB_PASSWORD`  | Neon password (secret)                             |
| `DB_NAME`      | `url_shortener`                                    |
| `DB_SSL`       | `true`                                             |
| `TYPEORM_SYNC` | `false`                                            |
| `FRONTEND_URL` | `https://<your-app>.vercel.app` (after step 3; then redeploy) |

4. Deploy, then verify against the Render URL:

```bash
curl https://<your-service>.onrender.com/health
curl -X POST https://<your-service>.onrender.com/api/urls \
  -H 'Content-Type: application/json' \
  -d '{"originalUrl":"https://example.com/smoke"}'
```

`BASE_URL` matters: it prefixes every returned `shortUrl`. If it still says
`localhost`, update the variable and redeploy.

### 3. Vercel (React frontend)

1. Vercel → **Add New → Project** → import the same GitHub repo. Settings:
   - **Root Directory:** `client`
   - **Framework Preset:** Vite (Build `npm run build`, Output `dist` — auto-detected)
   - **Environment Variable:** `VITE_API_BASE_URL=https://<your-service>.onrender.com`
2. Deploy. Vite bakes `VITE_API_BASE_URL` in at **build time**: any change requires
   setting the variable first, then **Redeploy** (no code change needed).
3. Open the Vercel URL, shorten a URL, open the short link in a new tab, and refresh
   statistics — clicks should increment.

### Production CORS notes

- `main.ts` allows local Vite origins plus exactly what `FRONTEND_URL` lists.
  Set it to the Vercel URL (comma-separated if several). Arbitrary origins are never allowed.
- The Vite dev server (`npm run dev`) keeps working locally regardless.

## Troubleshooting

- **`EADDRINUSE :::3000`**: a previous server still holds the port. Find it with
  `lsof -ti:3000`, confirm it is a `nest`/`dist/main` process with
  `ps -p <pid> -o command=`, then `kill <pid>`.
- **DB connection refused**: check Postgres is running (`pg_isready`), and that
  `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_NAME` in `.env` match `psql -l` output.
- **`database "url_shortener" does not exist`**: run the `CREATE DATABASE` step above, then `npm run migration:run`.
- **Migration CLI error "must contain only one export of DataSource instance"**:
  `src/data-source.ts` must keep exactly one `DataSource` export (default export).
- **Jest `ERR_REQUIRE_ESM` for `@nestjs/*`**: Nest 12 ships pure ESM; the `test`
  script already sets `NODE_OPTIONS=--experimental-vm-modules`. Do not remove it.
- **Flaky DB tests**: the suite runs `--runInBand` because all suites share one
  local database. Keep it serial unless each suite gets its own database.
