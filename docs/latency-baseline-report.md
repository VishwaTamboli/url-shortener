# Phase 1 — Latency Baseline Report (MEASURED 2026-10-13)

> Plan ref: `docs/latency-redis-plan.md` Phase 1. Status: **measured with Postman CLI** (`postman collection run`, local collection, `--no-report-events` so nothing left the machine). No application code, packages, `.env`, or dev-database state was modified. All writes went to an isolated `url_shortener_phase1` database, dropped after the runs.

## 1. Endpoints inspected (source of truth)

| Endpoint | Source | Behavior |
|---|---|---|
| `GET /health` | `src/app.controller.ts:7-12` | 200 `{status:'ok'}`; must keep working (route order vs `GET /:code`) |
| `POST /api/urls` | `src/urls/urls.controller.ts:29-36` → `src/urls/urls.service.ts:46-73` | Body `{originalUrl}` trimmed, must match `^https?://`, max 2048 chars; 201 `{shortCode, shortUrl, originalUrl}`; 400 on invalid |
| `GET /:code` | `src/urls/redirect.controller.ts:22-30` → `src/urls/urls.service.ts:86-100` | Known code → 302 + `Location: <originalUrl>`, atomic `UPDATE clicks=clicks+1 … RETURNING`; unknown → generic 404, nothing incremented |
| `GET /api/urls/:code/stats` | `src/urls/urls.controller.ts:38-45` → `src/urls/urls.service.ts:102-113` | 200 `{shortCode, originalUrl, clicks, createdAt}` or 404 |

## 2. Environment (as run)

| Item | Value |
|---|---|
| Date / host | 2026-10-13, local Mac (darwin) |
| App | `npm start` (compiled Nest) on **PORT=3100**, `BASE_URL=http://localhost:3100`, env overrides inline only (`.env` untouched) |
| DB | Isolated **`url_shortener_phase1`** (created, migrated with `CreateUrls1791728225000`, dropped after runs). Dev `url_shortener` untouched |
| Postman | CLI v1.73.0, local collection run, `--no-report-events` (run stayed local; `--output` report file requires login, not used) |
| Node / psql | Node v24.21.0, psql 17.11 |
| Collection | `docs/postman/url-shortener-baseline.postman_collection.json` (has `followRedirects:false` on redirect requests + status assertions; runner also passed `--ignore-redirects`) |
| Seed code | `vQGtGaz` → `https://example.com/baseline/seed` (via `POST /api/urls` on test instance) |

## 3. Request settings (exact)

- Collection: `docs/postman/url-shortener-baseline.postman_collection.json` (import into Postman).
- Variables: `baseUrl=http://localhost:3000`; `shortCode` = value from one `POST /api/urls` seed call.
- `POST /api/urls`: method POST, header `Content-Type: application/json`, body `{"originalUrl":"https://example.com/very/long/url"}`. Expect 201.
- `GET /:code` (known + unknown): **must NOT auto-follow redirects.** Two layers:
  1. Per-request (already in the collection JSON): `"protocolProfileBehavior": {"followRedirects": false}` on requests 2 and 3.
  2. Manual check in Postman: select the redirect request → **Settings tab → Follow redirects → OFF** (global default is ON; verify per request). Expected: known → 302 with `Location` header visible, body empty; unknown (`/doesnotexist`) → 404 generic JSON (no SQL/driver text).
- `GET /api/urls/:code/stats`: plain GET, expect 200 with `clicks` number.

## 4. Measurement procedure (repeatable, n=30)

1. `npm run start:dev`; confirm `GET /health` → 200.
2. Seed **one** code: send request 1 once, copy `shortCode` into `shortCode` variable.
3. Warm-up: send request 2 twice, discard both (cold-start noise).
4. Create latency: send request 1 **30× sequentially** (use a distinct `originalUrl` per run, e.g. append `?r=<i>`; each creates a row — use an isolated test database if dev data must stay pristine). Record Postman's **Time** field per run.
5. Redirect latency: send request 2 **30× sequentially** against the seeded `shortCode`, redirects OFF. Record Time + status + `Location` per run.
6. Sanity: request 3 → 404; request 4 → 200 with `clicks` = number of redirect hits on the seeded code.
7. Compute min / median / p95 / max per endpoint (sort ascending; median = mean of 15th+16th values; p95 = 29th of 30, i.e. index `ceil(0.95*30)-1`).

Rules: same machine + network, nothing else loading the server, sequential runs only, note anything discarded.

## 5. Results — MEASURED (Postman CLI, n=30 each, sequential)

Commands used (from repo root, test instance on :3100):

```bash
# create x30, distinct URL per iteration from CSV (header: originalUrl)
postman collection run docs/postman/url-shortener-baseline.postman_collection.json \
  -i "1 - Create URL" -n 30 -d <tmp>/create-data.csv \
  --env-var "baseUrl=http://localhost:3100" --no-report-events
# redirect x30 against seeded code, never following 302
postman collection run docs/postman/url-shortener-baseline.postman_collection.json \
  -i "2 - Redirect (known code, do NOT follow)" -n 30 --ignore-redirects \
  --env-var "baseUrl=http://localhost:3100" --env-var "shortCode=vQGtGaz" --no-report-events
```

Warm-up (discarded): 2× `GET /vQGtGaz` → 302 (5.4 ms, 1.6 ms).

### Create `POST /api/urls` (n=30, all 201, 60/60 assertions pass)

Raw ms: `4 2 3 2 2 1 2 2 1 2 2 1 2 2 1 1 1 2 3 2 2 2 2 3 2 3 2 2 2 2`

| Metric | ms |
|---|---|
| min | 1 |
| median | 2 |
| p95 | 3 |
| max | 4 |

Note: an earlier identical run also passed 30/30 (avg 2 ms, min 1, max 8); the table above is the recorded run.

### Redirect `GET /:code` known code, follow-OFF (n=30, all 302, 60/60 assertions pass)

Raw ms: `8 2 2 2 2 1 2 2 2 1 1 2 2 2 1 2 2 2 1 2 1 2 2 1 1 1 2 2 2 2`

| Metric | ms |
|---|---|
| min | 1 |
| median | 2 |
| p95 | 2 |
| max | 8 |

Every run returned 302 with `Location: https://example.com/baseline/seed`.

### Sanity checks

| Check | Expected | Actual |
|---|---|---|
| `GET /doesnotexist` (follow OFF) | 404 generic JSON | 404 `{"message":"Short URL not found","error":"Not Found","statusCode":404}` — no SQL/driver text |
| `GET /api/urls/vQGtGaz/stats` clicks | 2 warm-up + 30 measured = 32 | 32 — exact |

## 6. Progress tracking (no `docs/roadmap-progress.md` exists — tracked here)

- [x] Phase 1 prepared: endpoints inspected, collection + instructions written.
- [x] Phase 1 measured: Postman CLI runs fill §5 tables (2026-10-13).
- [x] Phase 1 accepted: n=30 min/median/p95/max for create (1/2/3/4 ms) + redirect (1/2/2/8 ms) recorded with environment note.
- [x] Phase 2 complete (2026-10-13): evidence review only — no code change justified, see §8. No Postman re-run (no code changed). Jest 43/43 green on isolated DB; dev DB untouched (5 rows).
- [x] Phase 3 complete (2026-10-13): Redis cache implemented, see §9. Jest 48/48 green on isolated DB + throwaway Redis index 15; dev DB untouched (5 rows). No latency claim until Phase 4.
- [ ] STOP — Phase 4 (verification) explicitly not started.

## 8. Phase 2 — Optimization review outcome: no change (evidence-based)

Baseline to beat: create p95 3 ms, redirect p95 2 ms, median 2 ms (same-host, sequential, §5).

| Candidate (per plan) | Evidence | Decision |
|---|---|---|
| Redirect query shape | `EXPLAIN UPDATE urls SET clicks=clicks+1 WHERE shortCode=… RETURNING` → `Index Scan using "IDX_urls_shortCode"`, cost 0.15..8.17. Single atomic statement (`src/urls/urls.service.ts:86-100`); rewriting it risks concurrent click safety | Keep — no change |
| Stats query | `EXPLAIN SELECT … WHERE shortCode=…` → same index scan | Keep — no change |
| Create query | Single `save()` INSERT with ≤5 collision retries on `23505` (`src/urls/urls.service.ts:52-71`); 2 ms median leaves no waste to remove | Keep — no change |
| Missing index | `\d urls` shows `IDX_urls_shortCode` UNIQUE btree + PK; both hot paths index-scanned | No migration |
| Connection pool | No `pool`/`extra` in `src/app.module.ts:10-27` → pg defaults (max 10). Sequential traffic cannot queue; baseline shows no connection-wait signal. Tuning pool size cannot improve sequential latency | Keep defaults — speculative change rejected |
| Middleware/logging on `GET /:code` | Global `ValidationPipe` (no DTO on redirect → passthrough), CORS origin check only, Swagger bootstrap-only, TypeORM `logging:false`. Nothing removable without behavior risk | Keep — no change |

**Tests (isolated `url_shortener_phase2` DB, created/migrated/dropped for this run, `.env` untouched):** `npm test` → 8 suites, 43 tests, all pass. Dev `url_shortener` row count verified unchanged (5 rows before and after).

**Conclusion:** At 1–3 ms local p95 there is no provably wasteful work left on the hot path; any edit (pool knobs, query rewrite) would be speculative and is rejected per the plan's constraints. Application code intentionally unchanged. Phase 3 (Redis) remains the only lever with headroom, and only under concurrent/remote-DB load.

## 9. Phase 3 — Redis cache implementation (actual, 2026-10-13)

What was built (redirect path only; stats/create untouched):

- New `src/urls/url-cache.service.ts`: best-effort `url:{code} → originalUrl` wrapper (`GET`/`SETEX`/`DEL`). Every method fails open (never throws); `enableOfflineQueue:false` + 1 s connect timeout so a dead Redis fails fast; `error` handler prevents process crash.
- `UrlsService.resolve()` (`src/urls/urls.service.ts`): hit → return cached URL after awaiting the atomic PostgreSQL `UPDATE clicks=clicks+1` (new `incrementClicks()` without `RETURNING`); 0 rows → drop stale key + 404. Miss → existing atomic `UPDATE … RETURNING`, then `SETEX` on success; 404 rows cache nothing.
- Wiring: `UrlCacheService` in `src/urls/urls.module.ts` providers/exports. Config: `REDIS_URL` (default `redis://localhost:6379`), `REDIS_TTL_SECONDS` (default `3600`) in `.env.example` (`.env` untouched, no secrets). No migration, no entity change.
- Tests: new `src/urls/url-cache.spec.ts` (miss populates + TTL bounds, hit 302 + exact clicks=2, unknown 404 never cached, Redis-down fail-open incl. 404-not-500, service-level hit); `src/urls/urls-failure.spec.ts` gains a stub cache provider (test-only fix for the new constructor dep).

Results (isolated `url_shortener_phase3` DB + throwaway Redis index 15, both cleaned up after):

- `npm test`: **9 suites, 48/48 tests pass** (two consecutive full runs). One transient single-test failure occurred on the first full run after the change and did not reproduce in two reruns or in isolation (5/5); recorded here, not hidden.
- Dev `url_shortener` verified at 5 rows before and after; default Redis index 0 never written (tests used index 15, flushed).
- No latency comparison is claimed — measurement belongs to Phase 4.

## 10. Handoff

Phases 1–3 complete. Phase 4 may begin per `docs/latency-redis-plan.md`: rerun the §5 Postman collection same-host against the cached build and compare min/median/p95/max with §5 (create p95 3 ms, redirect p95 2 ms).
