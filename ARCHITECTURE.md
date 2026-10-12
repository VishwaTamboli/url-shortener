# Architecture

Short, factual map of this project for safe incremental work. Backend: NestJS + TypeORM +
PostgreSQL. Frontend: React + Vite + Tailwind in `client/`. No auth, no caching, one database.

## Layout

- `src/main.ts` — bootstrap: global `ValidationPipe` (whitelist + transform), CORS
  (Vite dev origins + `FRONTEND_URL`), Swagger at `/api/docs`, listens on `PORT`.
- `src/app.module.ts` — `ConfigModule` (global) + `TypeOrmModule.forRootAsync` from
  `DB_*` env vars. `synchronize` is env-gated (default `false`); `DB_SSL=true` enables TLS.
- `src/app.controller.ts` — `GET /health` → `{status:'ok'}` (also the host health check).
- `src/urls/` — one feature module: `urls.controller.ts` (`POST /api/urls`,
  `GET /api/urls/:code/stats`), `redirect.controller.ts` (`GET /:code` → 302),
  `urls.service.ts` (business logic), `dto/` (validation + documented shapes),
  `entities/url.entity.ts` (single `urls` table model).
- `src/migrations/1791728225000-CreateUrls.ts` — the only migration; creates `urls`.
- `src/data-source.ts` — TypeORM CLI source (exactly one export; CLI requirement).
- `client/src/` — `services/api.ts` (sole API client, base URL from
  `VITE_API_BASE_URL`), `types/`, `components/` (Header, ShortenForm, ResultCard,
  StatsCard, RecentLinks, Footer), `App.tsx` (session state only).

## Request flows

- **Create:** `POST /api/urls {originalUrl}` → DTO trims + requires http(s) →
  service re-guards → random 7-char Base62 `INSERT`, retry ≤5 on unique violation
  (`23505`) → `201 {shortCode, shortUrl, originalUrl}` (`shortUrl` built from `BASE_URL`).
- **Redirect:** `GET /:code` → single `UPDATE … SET clicks=clicks+1 … RETURNING originalUrl`
  (atomic; zero rows → generic 404, nothing incremented) → Express `302`.
- **Stats:** `GET /api/urls/:code/stats` → indexed lookup → `{shortCode, originalUrl,
  clicks, createdAt}` or 404. Creation never counts as a click.
- All DB access is single indexed point queries on the `shortCode` unique index.

## Configuration (backend env truth: `.env.example`)

`PORT`, `BASE_URL`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`,
`TYPEORM_SYNC` (must stay `false`), `DB_SSL` (true for Neon), `FRONTEND_URL`
(prod CORS origin). Frontend: `VITE_API_BASE_URL` (baked in at Vite build time).

## Safe extension points (no schema change needed for these)

- New read endpoints on `UrlsService` + existing `Url` repository (e.g. validation,
  lookup variants).
- New frontend components calling the existing three API routes via `services/api.ts`.
- New Nest modules alongside `UrlsModule` (do not move `GET /:code`; route order
  keeps `/health` working — covered by a test).
- New migrations for schema changes (never `synchronize: true`; never edit the
  applied `CreateUrls` migration).

## Do-not-touch without review

- `src/migrations/1791728225000-CreateUrls.ts` (already applied), `shortCode`
  uniqueness/indexes, atomic click increment, CORS allowlist, `.env` contents.
- Test scripts: Jest needs `NODE_OPTIONS=--experimental-vm-modules` (Nest 12 is
  pure ESM) and `--runInBand` (all suites share one local database).
