# Latency + Redis Cache Plan (planning only, no implementation)

> Scope: existing basic URL shortener only (`POST /api/urls`, `GET /:code` → 302, `GET /api/urls/:code/stats`, `GET /health`). Verified in `src/urls/urls.service.ts`, `src/urls/redirect.controller.ts`, `src/urls/urls.controller.ts`, `src/urls/entities/url.entity.ts`, `src/app.module.ts`, `src/data-source.ts`, `src/migrations/1791728225000-CreateUrls.ts`, existing Jest+Supertest specs. Do not assume any other features exist.

## Current-state findings (what the plan is based on)

- Redirect path: `RedirectController.redirect()` → `UrlsService.resolve()` → single `UPDATE urls SET clicks=clicks+1 WHERE "shortCode"=:code RETURNING "originalUrl"`; zero rows → generic 404 (`src/urls/urls.service.ts:86-100`).
- Create path: `UrlsService.create()` → trim + `^https?://` guard → random 7-char Base62 `INSERT`, retry ≤5 on `23505` (`src/urls/urls.service.ts:46-73`).
- Stats path: `findOneBy({ shortCode })` (`src/urls/urls.service.ts:102-113`).
- DB: single `urls` table, unique index `IDX_urls_shortCode` on `shortCode` (`src/migrations/1791728225000-CreateUrls.ts:11-16`). No cache, no pool tuning in `src/app.module.ts:10-27` (TypeORM defaults). `synchronize=false`, `GET /health` must keep working (route order).
- Tests: Jest + Supertest against real local PostgreSQL, `--runInBand` (`package.json:12-16`, `src/urls/redirect.controller.spec.ts:46-48` deletes all rows in `afterEach`).

## Constraints (apply to all phases)

- Planning only: no code changes, no package installs, no `.env` edits, no destructive DB ops, no deploy, no git push.
- Keep plan small / limited-context-AI friendly: one phase at a time, touch as few files as possible.
- Postman for all latency checks; no separate benchmarking tool unless Phase 1 proves Postman insufficient.
- Out of scope: load balancing, authentication, analytics, QR codes, unrelated features.
- PostgreSQL stays source of truth; keep data safe; any test that writes/deletes uses an isolated test database (never the dev/prod `url_shortener`).

---

## Phase 1 — Baseline

- **Goal:** Record repeatable current latency for `POST /api/urls` and `GET /:code` before changing anything.
- **Scope:** Measure only; local `npm run start:dev` + local PostgreSQL. No code or config changes.
- **Dependencies:** App runs, migrations applied, Postman installed, one known-good short code seeded via `POST /api/urls`.
- **Steps (repeatable):**
  1. Start app, confirm `GET /health` → 200.
  2. In Postman, create a collection `url-shortener-baseline` with requests: `POST /api/urls`, `GET /:code` (known code), `GET /:code` (unknown code e.g. `/doesnotexist`), `GET /api/urls/:code/stats`.
  3. Turn off Postman auto-follow-redirects for `GET /:code` so the 302 + `Location` header is observable.
  4. Record `n=30` sequential runs each for create and redirect (same machine, same network, no other load); note Postman response-time field per run.
  5. Record: min / median / p95 / max for each endpoint, plus status codes and `Location` header values.
- **Expected files:** None changed. New Postman collection export (optional, stored outside repo or under `docs/` only if the team agrees).
- **Tests:** Manual Postman runs only; no Jest changes.
- **Acceptance criteria:** Table with n=30 min/median/p95/max for create + redirect, environment noted (port, `BASE_URL`, DB host), steps reproducible by a second person.
- **Risks:** Cold-start noise; Wi-Fi variance → run locally, sequential, discard first 2 warm-up runs and note it.

## Phase 2 — Latency optimization (no Redis yet)

> **Outcome (2026-10-13, see `docs/latency-baseline-report.md` §8): no code change.** `EXPLAIN` confirms both hot paths index-scan `IDX_urls_shortCode`; pool defaults show no queueing signal at 2 ms p95; no removable middleware. Jest 43/43 green on isolated DB.

- **Goal:** Remove only provably wasteful work on the hot redirect path.
- **Scope:** Read-only review + recommendations. Candidates justified by current source: confirm `shortCode` unique index is used (`EXPLAIN` on the `UPDATE … WHERE "shortCode"`), check TypeORM pool defaults in `src/app.module.ts` against observed p95 (recommend explicit small pool only if connections queue), check for unnecessary middleware/logging/extra queries on `GET /:code` (there are currently none — do not add any).
- **Dependencies:** Phase 1 baseline numbers.
- **Expected files (future implementation, not this plan):** Possibly `src/app.module.ts` (pool options), possibly `src/urls/urls.service.ts` (query shape) — only if Phase 1 + `EXPLAIN` justify it.
- **Tests:** Re-run Phase 1 Postman collection; existing Jest specs (`redirect.controller.spec.ts`, `urls.service.spec.ts`) must still pass unmodified.
- **Acceptance criteria:** Each recommendation cites a file:line or a measurement; no change that risks atomic clicks or 404 behavior; redirect p95 not regressed.
- **Risks:** Over-tuning pool settings without evidence; touching the atomic `UPDATE … RETURNING` and breaking concurrent click safety — forbid rewriting it without a concurrency test.

## Phase 3 — Redis cache for code→URL lookups

> **Outcome (2026-10-13, see `docs/latency-baseline-report.md` §9): implemented as designed.** `src/urls/url-cache.service.ts` (new) + `resolve()` hit/miss paths + `REDIS_URL`/`REDIS_TTL_SECONDS` in `.env.example`. Jest 48/48 green on isolated DB + throwaway Redis index 15. No latency claim until Phase 4.

- **Goal:** Cache `shortCode → originalUrl` reads to cut redirect latency while keeping PostgreSQL authoritative and clicks exact.
- **Scope:** Redirect path only. Stats and create paths keep hitting PostgreSQL directly.
- **Dependencies:** Phases 1–2 done; local Redis available for dev/test; new env vars documented (e.g. `REDIS_URL`, `REDIS_TTL_SECONDS`) via `.env.example` only at implementation time (not now).
- **Design (to implement later):**
  - Key: `url:{shortCode}` → value: `originalUrl` string. TTL: fixed short value (e.g. 1h; confirm from Phase 1 traffic — short enough to bound staleness, long enough to get hits). No TTL on negative cache: unknown codes are never cached, every unknown code hits PostgreSQL and returns generic 404 (preserves current `resolve()` behavior).
  - Read path: Redis `GET` → hit: use URL for 302, still increment clicks in PostgreSQL (see below); miss: run existing atomic `UPDATE … RETURNING`, on success `SETEX` the key, on zero rows throw 404 and cache nothing.
  - Click counting stays atomic in PostgreSQL: keep the single `UPDATE clicks=clicks+1 … RETURNING` as the increment. Do not count clicks in Redis. Optional later micro-optimization (fire-and-forget increment after serving redirect) is explicitly deferred — it risks lost counts and is out of scope for the small plan.
  - Invalidation: URLs are immutable (no update/delete endpoints exist), so no invalidation path is needed. If a delete endpoint is ever added, it must `DEL url:{code}` in the same operation.
  - Redis failure behavior: fail-open to PostgreSQL. Any Redis error/timeout → log once, run the existing PostgreSQL `resolve()` path, still return correct 302/404. Redis outage must never cause a 500 for a code PostgreSQL could serve, and must never serve a URL PostgreSQL does not have.
- **Expected files (future):** New small cache wrapper (e.g. `src/urls/url-cache.service.ts` or Redis module), edits to `src/urls/urls.service.ts` (`resolve()` only), `src/urls/urls.module.ts` (provider wiring), `.env.example` (new vars), Jest specs for hit/miss/failure. No migration, no entity change.
- **Tests:** New unit/integration specs use isolated test DB + throwaway Redis DB index (flush only that index); never flush shared Redis or delete dev-table rows outside the test DB.
- **Acceptance criteria:** PostgreSQL is the only writer of truth; click counts identical with cache on/off; unknown codes → 404 with no cache write; Redis stopped → all redirects still correct via PostgreSQL.
- **Risks:** Stale cache if mutability is added later; double-counting if increment is ever moved out of the atomic statement; limited-context overflow — keep the cache wrapper to one file with `get/set` only.

## Phase 4 — Verification

- **Goal:** Prove the optimization + cache helped without breaking correctness, using the same Postman setup fairly.
- **Scope:** Postman comparisons + existing Jest suite; isolated test DB for write/delete checks.
- **Dependencies:** Phases 1–3 implemented in order; same machine/network as baseline.
- **Postman tests:**
  1. Baseline vs. optimized: re-run the Phase 1 collection (same n=30, same code, redirects not followed); compare min/median/p95/max. Fairness rules: same server mode (`start:dev`), warmed up (discard first 2), sequential, no other load, record env alongside results.
  2. Cache miss then hit: `GET /:code` new code → first response is a miss (slower, DB-backed), second immediate response is a hit (faster); confirm identical 302 + `Location`.
  3. Correct redirects: known code → 302 + exact `Location`; unknown code → 404 generic body (no SQL/driver text).
  4. Click counts: `GET /:code` ×3 → `GET /api/urls/:code/stats` shows `clicks` increased by exactly 3 (run against isolated test DB or a throwaway code).
  5. Redis unavailable: stop Redis, repeat known + unknown redirect checks → same 302/404 as with Redis up (slower is acceptable, wrong is not).
- **Expected files:** Updated results table in this doc or a `docs/latency-results.md` note; no app-code changes in this phase.
- **Tests:** Full `npm test` green on isolated test DB; Postman collection saved with run summaries.
- **Acceptance criteria:** Optimized p95 ≤ baseline p95; hit faster than miss; clicks exact; 404s unchanged; Redis-down run fully correct.
- **Risks:** Comparing different environments (dev vs. prod) or parallel runs — invalid; always sequential same-host; writing click-test data into the real DB — use isolated test DB only.

---

## Summary and recommended implementation order

1. **Phase 1 first** — baseline with Postman (n=30, create + redirect, 302 observed with redirect-following off). Nothing else can be judged without it.
2. **Phase 2 second** — apply only evidence-backed micro-fixes (index confirmation via `EXPLAIN`, pool settings only if needed). Re-measure with the same collection.
3. **Phase 3 third** — add `url:{code} → originalUrl` Redis cache with `SETEX` on miss, never cache 404s, keep the atomic PostgreSQL click increment, fail open to PostgreSQL.
4. **Phase 4 last** — same-collection fair comparison (baseline vs. optimized, hit vs. miss, clicks +3 exact, 404s generic, Redis-down correctness) plus green Jest suite on an isolated test DB.

Smallest safe slice for a limited-context model: do Phase 1 alone, then Phase 2 alone, then Phase 3's cache wrapper + `resolve()` edit alone, then Phase 4 verification — never combine phases in one change.
