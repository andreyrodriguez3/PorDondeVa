# TuBus — MVP Implementation Roadmap

Derived from [`SPECS.md`](SPECS.md) (read in full). Section references of the form §N point to it. Code conventions are governed by [`CODESTYLE.md`](CODESTYLE.md).
Scope: a minimal but production-quality MVP satisfying §43 _Definition of Done_, deployable to a single VPS.

Guiding constraint applied throughout: **no microservices, no Kubernetes, no AWS, no Redis, no message broker, no third-party paid infrastructure.** One Postgres, one NestJS process, one Next.js process, one reverse proxy, one Android app.

---

## 0. Executive summary

| Item                 | Decision                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------- |
| Repository           | Single Git monorepo, pnpm workspaces + a sibling Gradle project for Android                   |
| Backend              | NestJS (modular monolith), TypeScript, Prisma, PostgreSQL 16                                  |
| Real-time            | Socket.IO gateway inside the same NestJS process (in-memory rooms)                            |
| Web                  | Next.js App Router (passenger + admin in one app, separated by host and route group)          |
| Map                  | MapLibre GL JS, tile style URL injected by env var                                            |
| Android              | Kotlin, Jetpack Compose, Hilt, Room, WorkManager, FusedLocationProvider, foreground service   |
| Live state           | A single Postgres row per active trip (`trip_live_states`), upserted on ingest                |
| Tenancy              | Shared DB, `company_id` on every tenant entity, explicit scoping + a fail-closed Prisma guard |
| TLS / custom domains | Caddy with on-demand TLS + an `ask` endpoint — no DNS automation needed                       |
| Estimated effort     | ~41–56 developer-days for one full-stack developer (see §12)                                  |

The single highest-risk item is the end-to-end pipeline (device → API → DB → WebSocket → map). It is therefore built **first**, driven by the GPS simulator (§29), before any UI polish and before Android exists.

> **Revision 2 — consistency review against SPECS.md, README.md and CODESTYLE.md.**
> Four gaps were found and closed: no surface existed for creating a company (DoD step 1), drivers had no usable login identifier, an offline flush would have broadcast one WebSocket event per queued point, and there was no password recovery path. Four items of unnecessary complexity were removed: a deferrable unique constraint Prisma cannot manage, a refresh-token family chain, a live-state counter that its own guard clause made incorrect, and a contract-fixture generator. `CODESTYLE.md` now exists, resolving **A13** and **A11**; the specification was renamed to `SPECS.md`, resolving **A18**. Details in §2, §4, §5 and §15.

---

## 1. Architectural decisions

### 1.1 Decisions taken (with rationale)

**D1 — Monorepo, not multi-repo.**

```
tubus/
  apps/
    api/          NestJS
    web/          Next.js
  packages/
    contracts/    Zod schemas + inferred TS types shared by api and web
  tools/
    simulator/    GPS simulator CLI (§29)
    seed/         dev data seeding
  android/        standalone Gradle project
  docker/         Dockerfiles, Caddyfile
  docker-compose.yml
  docker-compose.prod.yml
```

`packages/contracts` holds Zod schemas for every request/response DTO. The API validates with them; the web infers types from them. This gives compile-time contract safety without adding OpenAPI codegen. Android is a separate build and consumes the same contract via hand-written Kotlin data classes plus contract tests (§9.3).

**D2 — Modular monolith, one process.**
Backend and WebSocket gateway share a process. Rooms are in-memory. This is correct for "dozens of buses" (§33) and it is the only design that avoids Redis. The scale-out path (`@socket.io/redis-adapter`, one added line + one container) is documented in `docs/scaling.md` but **not** built.

**D3 — Prisma as the ORM.**
Best-in-class migrations, first-class NestJS integration, good enough raw-SQL escape hatch for the two hot queries (location batch insert, live-state upsert). Those two go through `$executeRaw` with `ON CONFLICT` clauses.

**D4 — No PostGIS in the MVP.**
The MVP does not do map matching, snapping, or ETA. Route geometry is a GeoJSON `LineString` in a `jsonb` column, drawn verbatim by MapLibre. Stops are `double precision` lat/lng columns. Adding PostGIS later is `CREATE EXTENSION postgis;` plus a generated `geometry` column backfilled from the existing jsonb — no data migration, no model rewrite. Postgres data directories are compatible across the `postgres:16` and `postgis/postgis:16` images, so the image swap is a one-line change if it is ever needed.

**D5 — The admin dashboard lives on one fixed host; company hosts serve passengers only.**

```
admin.tubus.example          → admin dashboard (auth, cookies, CSRF)
tuanrl.tubus.example         → passenger surface only
rutas.tuanrl.com             → passenger surface only
```

Reason: authentication cookies must never be set on a hostname the customer controls (DNS can be repointed), cookie scoping across wildcard + arbitrary custom domains is a security minefield, and CSRF/CORS become trivial with one origin. The spec does not state where the dashboard lives — this is a decision, flagged again in §2 as **A1**.

**D6 — Route variants are directional.**
A "round trip" is two variants (`OUTBOUND`, `INBOUND`), each with its own stop sequence and its own `headsign` ("Toward Palmares"). Passenger direction text (§5) comes from the trip's variant headsign — a stored fact — never from inferring heading from GPS bearing, which is unreliable at low speed and on curves.

**D7 — Drivers are users, not a parallel identity system.**
One `users` table with a `role` column; a `driver_profiles` table (1:1) carries phone, license, status, and default bus assignment. One password hasher, one token issuer, one revocation path. §16's "authentication credentials" on the driver entity is satisfied without a second auth stack.

**D8 — Location ingestion is a batched, idempotent REST endpoint.**

```
POST /api/v1/driver/trips/:tripId/locations
{ "points": [ { "clientPointId": "<uuid>", "lat": …, "lng": …, "accuracyM": …,
                "speedMps": …, "bearingDeg": …, "deviceTimestamp": "…Z" }, … ] }
```

One endpoint serves both the live single-point case and the offline flush (§9). Deduplication is a `UNIQUE (trip_id, client_point_id)` index plus `INSERT … ON CONFLICT DO NOTHING`, so a retried request after a lost response is a no-op. Response returns per-point accepted/duplicate/rejected so the client can safely delete acknowledged rows from its queue. The driver uplink is REST, not WebSocket — REST is trivially retryable, works with WorkManager, and survives process death.

**D9 — Live state is a Postgres table, and `connection_status` is derived at read time, never stored.**
§19 lists `connection_status` as a stored field. Stored status is wrong by construction: a bus that stops transmitting never writes a row again, so a stored status would remain `LIVE` forever. `trip_live_states` stores the latest position and timestamps; status is computed per request from `now() − device_timestamp` against the company's thresholds.

**D10 — Live status is derived from `device_timestamp`, not `server_timestamp`.**
This is the offline-correctness decision. If a bus is dark for 10 minutes and then flushes its queue, `server_timestamp` is _now_ for every flushed point — using it would display a 10-minute-old position as `LIVE`. Using the newest `device_timestamp` yields the honest answer, and correctly flips back to `LIVE` the moment fresh positions land. `server_timestamp` is retained for operator diagnostics ("received 240 points in one batch after a 10-minute gap").

**D11 — The live state only advances on newer device timestamps.**
The upsert is guarded: `WHERE excluded.device_timestamp > trip_live_states.device_timestamp`. Without this, an offline flush containing older points would drag the marker backwards.

**D12 — Device clocks are not trusted.**
On ingest: reject points with `device_timestamp > server_now + 60s` (future), reject points before `trip.started_at − 5 min`, reject points older than 24h. Rejections are counted and logged per trip, never silently dropped. Accuracy above a configurable ceiling (default 200 m) is stored but flagged `low_confidence` so the UI can widen the uncertainty circle rather than lie (§21).

**D13 — Interpolation animates between two known points only.**
The marker tweens from the previously rendered position to the newly received one over the observed inter-update interval (capped at ~6 s). It **never** extrapolates ahead of the last known fix. When status leaves `LIVE`, the tween stops and the marker visibly settles — satisfying §5's smoothness requirement without violating §21's honesty requirement.

**D14 — Tenant isolation: explicit scoping + a fail-closed runtime guard + a conformance test suite.**
Three layers:

1. Every service method that touches a tenant entity takes `companyId` as an explicit parameter. No repository reads it from ambient request state.
2. A Prisma client extension intercepts every query against a tenant-scoped model and **throws** if no `companyId` appears in the `where` clause. It does not silently inject one — silent injection hides bugs; throwing surfaces them in development and in tests.
3. A parametrized integration test enumerates every tenant-scoped endpoint and asserts that Company A's token receives **404** (not 403 — 403 leaks existence) for Company B's resources.
   Postgres RLS was considered and rejected for the MVP: it requires every request to run inside a transaction with `SET LOCAL`, which fights Prisma's pooling and adds latency to the hot ingest path for a guarantee layers 1–3 already provide.

_Known limits of layer 2, stated so it does not create false confidence:_ the extension cannot inspect nested writes, and it cannot see the two raw-SQL statements on the ingest path (§4.2), which are scoped by hand and covered by tests instead. Layer 2 catches the common mistake — a forgotten `where` on a normal query — and nothing more. Layer 3 is the actual guarantee.

**D15 — Emails are globally unique.**
Scoping login by company would require the user to disambiguate at the login screen (there is no tenant in the admin host). Global uniqueness removes that entire class of UX and account-takeover bugs. Consequence: one human cannot be an admin at two companies — acceptable for the MVP, and the migration path (a `company_memberships` join table) is additive.

**D16 — Trips are created when the driver starts one; there is no nightly trip-generation job.**
The driver picks (or is auto-assigned) bus + route variant, and the backend optionally links the nearest schedule departure within a window (default ±45 min) to populate `scheduled_departure_at`. This keeps the trip lifecycle to one state machine with no background generator. Consequence: the admin dashboard shows _actual_ trips, not "expected but not started" trips. Flagged as **A6**.

**D17 — Caddy with on-demand TLS.**
Custom domains (§4) need HTTPS without DNS automation. Caddy's `on_demand_tls` with an `ask` endpoint that calls `GET /api/v1/public/domains/allowed?domain=…` issues a certificate only for hostnames present in `company_domains` and marked verified. This also covers `*.tubus.example` per-subdomain, so **no wildcard certificate and no DNS provider API token are required**. Caddy replaces nginx+certbot and is one container with a ~15-line config.

**D18 — Structured JSON logs to stdout only.**
`nestjs-pino`, request-scoped correlation id, redaction of `authorization`/`password`. Docker's json-file driver with size/rotation caps. No log shipper, no ELK (§35).
§35 lists "location received" as a loggable event, but logging it per point would produce roughly 8 lines/second at 40 buses and fill a small VPS disk. Ingest logs **one line per accepted batch** at `debug` level, carrying counts (accepted / duplicate / rejected) rather than coordinates. Everything else in §35's list logs at `info`.

**D19 — One WebSocket broadcast per accepted batch, emitted after the transaction commits.**
A naïve implementation would emit one event per stored point. An offline flush of 200 queued points would then spam every subscribed passenger with 200 events and replay 20 minutes of history across their screen in a second. Instead, ingest writes the batch, and emits **at most one** `bus:update` carrying the resulting live state — and only if the live state actually advanced (D11). Emitting after commit, not inside the transaction, prevents broadcasting a position that then rolls back. The intervening points still land in `location_points` and appear in trip playback; they simply are not streamed.

**D20 — Drivers authenticate with company code + username; web users authenticate with email.**
§16 gives a driver a name, phone and status but **no email**, while D15 makes email the global login identifier. Bus drivers frequently have no work email, and minting synthetic addresses (`driver24@tuanrl.local`) is a smell that leaks into every screen. Resolution: `users.email` is nullable and globally unique when present; `users.username` is unique per company. The admin surface logs in with email; the driver app logs in with company code + username + password, where the company code is entered once at first launch (or scanned from a QR the company prints) and stored thereafter. This also gives the driver app its tenant context, which it otherwise lacks — the app talks to the platform host, so unlike a browser it has no company-bearing hostname. See **A19**.

### 1.2 Decisions deliberately deferred (do not build)

Redis, any queue/broker, PostGIS, tile self-hosting, horizontal scaling, ETA, map matching, geofencing, PWA, i18n framework, feature flags, multi-region, S3/object storage (logos are stored on a mounted volume and served by the backend, with a documented one-file swap to object storage later).

---

## 2. Ambiguities, contradictions and gaps in the specification

Ordered by how much they block implementation. A19–A23 were added by the revision-2 review; A11, A13 and A18 are now resolved.

| #       | Issue                                                                                                                                                                                                                                   | Where         | Resolution proposed                                                                                                                                                                                                                                                                  | Needs your input?           |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| **A1**  | The spec never says where the admin dashboard is served from. Serving it on company/custom domains would place auth cookies on customer-controlled hostnames.                                                                           | §4, §24, §41  | Admin on a single fixed host (`admin.tubus.example`); company + custom hosts serve passengers only.                                                                                                                                                                                  | **Yes** — product decision  |
| **A2**  | **Direct contradiction.** §13 says a stop has `route_variant_id` (stop belongs to one variant) _and_ "a stop may exist in multiple route variants".                                                                                     | §13           | Split into `stops` (company-owned physical place: name, lat, lng) and `route_variant_stops` (join carrying `sequence`). Satisfies both readings; matches the GTFS mental model.                                                                                                      | No — resolved               |
| **A3**  | §5 demands interpolated movement; §21 forbids implying precision the GPS does not have.                                                                                                                                                 | §5 vs §21     | D13: interpolate between known fixes only, never extrapolate; freeze on stale; render an accuracy circle when accuracy is poor.                                                                                                                                                      | No — resolved               |
| **A4**  | Live-status thresholds are specified but the reference clock is not. Using server time makes an offline flush look live.                                                                                                                | §19, §20      | D10: derive from newest `device_timestamp`.                                                                                                                                                                                                                                          | No — resolved               |
| **A5**  | Two vocabularies for the same concept: §5 says live / recently updated / stale / unavailable; §20 says LIVE / STALE / OFFLINE / COMPLETED.                                                                                              | §5 vs §20     | Canonical enum = §20. UI copy maps onto it (`LIVE`→"En vivo", `STALE`→"Actualizado hace 2 min", `OFFLINE`→"Sin señal desde hace 5 min").                                                                                                                                             | No — resolved               |
| **A6**  | §17 lists Schedule as part of a trip, but the DoD has the driver simply starting a trip. Are trips pre-generated from schedules?                                                                                                        | §14, §17, §43 | D16: `schedule_id` nullable, trips created on start, nearest departure auto-linked.                                                                                                                                                                                                  | Confirm                     |
| **A7**  | §24 defines `SUPER_ADMIN`, which by definition crosses the tenant boundary that §4 declares inviolable.                                                                                                                                 | §4 vs §24     | SUPER_ADMIN is a platform user (`company_id IS NULL`) restricted in the MVP to company lifecycle + domain management. It **cannot** read operational data (trips, locations, drivers) without an explicit, time-boxed, audit-logged impersonation grant — which is out of MVP scope. | Confirm                     |
| **A8**  | §14 says schedules belong to "the company and route/route variant as appropriate" — ambiguous attachment point.                                                                                                                         | §14           | Attach to `route_variant`. A departure follows a physical path; a route-level schedule would be undefined when the route has two variants.                                                                                                                                           | Confirm                     |
| **A9**  | §16 says drivers should not have to pick arbitrary buses "if the company has configured an assignment", but no assignment model is specified.                                                                                           | §6, §16, §24  | MVP: `driver_profiles.default_bus_id`, pre-selected in the app, overridable at trip start (buses break down). A dated `bus_assignments` table is deferred.                                                                                                                           | Confirm                     |
| **A10** | **No timezone anywhere in the spec**, yet schedules are wall-clock times and the target market is Costa Rica.                                                                                                                           | §14           | `companies.timezone` (default `America/Costa_Rica`). Schedules store `time` + `days_of_week`; all resolution to instants happens in the company timezone. All other timestamps are `timestamptz` in UTC.                                                                             | No — resolved               |
| **A11** | **Passenger UI language is never stated.** The spec is English; every example is Spanish (San José, Grecia, Naranjo).                                                                                                                   | §5, §23       | **Resolved by `CODESTYLE.md`:** code, identifiers, filenames and technical docs in English; user-facing passenger/company text may be Spanish. Ship es-CR for passenger, driver and admin UI, with all copy in one `lib/copy.ts` dictionary — no i18n framework.                     | Resolved                    |
| **A12** | §27 requires "no paid third-party infrastructure", but MapLibre needs a tile source, and OSM's public tile servers forbid production application use.                                                                                   | §27 vs §28    | `NEXT_PUBLIC_MAP_STYLE_URL` env var. Dev default: OSM raster (acceptable at dev volume). Production: MapTiler/Stadia/Protomaps free tier, or self-hosted `pmtiles` for Costa Rica (~200 MB, static file, zero recurring cost). Decide before launch, not before coding.              | **Yes** — before production |
| **A13** | §37 requires the project to follow `CODESTYLE.md`.                                                                                                                                                                                      | §37           | **Resolved:** [`CODESTYLE.md`](CODESTYLE.md) now exists and is authoritative. Phase 0 adds only the mechanical enforcement (ESLint/Prettier config, commitlint) — it does not restate the rules.                                                                                     | Resolved                    |
| **A14** | §32 requires configurable retention but gives no default.                                                                                                                                                                               | §32           | `LOCATION_RETENTION_DAYS=90` for raw points; trips/live-state kept indefinitely. Nightly job deletes in bounded batches.                                                                                                                                                             | Confirm number              |
| **A15** | Nothing defines what happens when a driver forgets to end a trip. Trips would stay `ACTIVE` forever and appear on the passenger map.                                                                                                    | §17, §20      | Sweeper job: a trip with no new points for `TRIP_AUTO_END_MINUTES` (default 90) is auto-completed with `end_reason = AUTO_TIMEOUT`, and admins may end a trip manually.                                                                                                              | Confirm                     |
| **A16** | §24 says "assign" for buses and drivers without defining the semantics.                                                                                                                                                                 | §24           | Interpreted as: assign a default bus to a driver (A9), and assign a driver+bus to a trip at start. No standing shift-roster model in the MVP.                                                                                                                                        | Confirm                     |
| **A17** | §33 targets "dozens of buses" while §10 mandates WebSockets; a single in-memory-room process is implied but never stated as a constraint.                                                                                               | §10, §33      | Stated explicitly as D2, with the documented (unbuilt) Redis-adapter path.                                                                                                                                                                                                           | No — resolved               |
| **A18** | The specification filename did not match the name used to reference it.                                                                                                                                                                 | —             | **Resolved:** the file is now `SPECS.md`, and `README.md` / `ROADMAP.md` link to it under that name.                                                                                                                                                                                 | Resolved                    |
| **A19** | **Gap.** §16 gives a driver `phone` but no email, yet the auth model (D15) makes email the login identifier. Bus drivers often have no work email.                                                                                      | §16, §25      | D20: nullable `email` (globally unique when present) + `username` (unique per company); driver app logs in with company code + username + password.                                                                                                                                  | Confirm                     |
| **A20** | **Gap.** DoD step 1 is "an administrator creates a company", but no surface existed for it — only the API and the seed script. Company creation is a `SUPER_ADMIN` action, and A7 keeps `SUPER_ADMIN` off the company-scoped dashboard. | §24, §43      | A small platform section at `admin.tubus.example/platform`, visible only to `SUPER_ADMIN`: create/suspend a company, set slug and timezone, create its first `COMPANY_ADMIN`, manage hostnames. Four screens, no separate app. Added to Phase 5.                                     | Confirm                     |
| **A21** | **Gap.** No password recovery exists anywhere, and the MVP deliberately has no SMTP dependency. A driver who forgets a password would be unrecoverable.                                                                                 | §25           | Administrator-issued resets, no email needed: `COMPANY_ADMIN` resets operators and drivers, `SUPER_ADMIN` resets a company admin, and the one-time password is displayed once at issue and must be changed at next login. Self-service reset by email is deferred until SMTP exists. | Confirm                     |
| **A22** | `SCHEDULED` is one of §17's four trip statuses, but D16 removes trip pre-generation, so nothing in the MVP can ever produce it.                                                                                                         | §17           | Keep the enum value for forward compatibility, and state explicitly that it is unreachable in the MVP. The state machine is `→ ACTIVE → COMPLETED \| CANCELLED`. No UI, query or test may assume a `SCHEDULED` trip can exist.                                                       | No — documented             |
| **A23** | D6 makes variants directional, so a route has buses travelling both ways — but §5's route page mockup shows a single direction and never mentions choosing one.                                                                         | §5, §11       | The route page shows a direction selector built from the variants' headsigns, defaulting to the direction that currently has active buses (or the default variant when none do). Subscribing to a route joins the rooms of all its variants; the selector filters what is drawn.     | Confirm                     |

---

## 3. Dependencies

### 3.1 Build-order dependencies (what blocks what)

```
Phase 0  tooling, lint config, compose, CI
   └─► Phase 1  schema + migrations + auth + tenancy
          ├─► Phase 2  fleet/route/stop/schedule CRUD  ──┐
          └─► Phase 3  ingest + live state + WS + simulator
                          ├─► Phase 4  passenger web  ◄──┘
                          │                              (needs routes/stops from P2)
                          ├─► Phase 5  admin dashboard ◄─┘
                          └─► Phase 6  Android app
                                 └─► Phase 7  offline sync hardening
                                        └─► Phase 8  branding, QR, domains, retention
                                               └─► Phase 9  hardening + deploy
```

Critical path: **1 → 3 → 4**. Phase 5 (admin UI) and Phase 6 (Android) are parallelizable if a second developer is available; the simulator (Phase 3) removes Android from the critical path entirely.

### 3.2 External runtime dependencies

| Dependency                  | Purpose                             | Cost                               | Replaceable?                                     |
| --------------------------- | ----------------------------------- | ---------------------------------- | ------------------------------------------------ |
| PostgreSQL 16               | Everything                          | Free, self-hosted                  | No (by design)                                   |
| Map tile style              | MapLibre basemap                    | Free tier or self-hosted (**A12**) | Yes — one env var                                |
| VPS (2 vCPU / 4 GB / 80 GB) | Production host                     | ~$12–24/mo                         | Yes                                              |
| Domain + DNS                | `tubus.example` + wildcard A record | ~$15/yr                            | Yes                                              |
| Let's Encrypt               | TLS via Caddy                       | Free                               | Yes (ZeroSSL fallback built into Caddy)          |
| Google Play Console         | Driver app distribution             | $25 one-time                       | Internal-testing track or direct APK for the MVP |
| Google Play Services        | `FusedLocationProviderClient`       | Free                               | Yes — AOSP `LocationManager` fallback if needed  |

### 3.3 Key libraries

**Backend:** `@nestjs/{common,core,platform-express,config,jwt,passport,websockets,platform-socket.io,schedule,throttler}`, `prisma`/`@prisma/client`, `zod`, `argon2`, `nestjs-pino`/`pino`, `qrcode`, `helmet`.
**Web:** `next`, `react`, `maplibre-gl`, `socket.io-client`, `@tanstack/react-query`, `zod`, `tailwindcss`, `react-hook-form`.
**Android:** Compose BOM, `hilt`, `room`, `work-runtime-ktx`, `play-services-location`, `retrofit`+`okhttp`+`kotlinx-serialization`, `security-crypto`, `datastore-preferences`.
**Tooling:** `eslint`, `prettier`, `vitest` (web), `jest` (api), `playwright`, `commitlint` + `husky` (conventional commits, §38).

Rejected on the "minimal dependencies" principle: state-management libraries beyond React Query, a component library, an i18n framework, an OpenAPI generator, a DI container for Android beyond Hilt, `class-validator` (Zod already covers validation and is shared with the web).

---

## 4. Database design

PostgreSQL 16. All ids `uuid` (`gen_random_uuid()`) except `location_points`, which uses `bigserial` for insert locality on the hot path. All timestamps `timestamptz` (UTC). `citext` extension for case-insensitive hostnames, emails, and slugs.

### 4.1 Tables

**`companies`** — `id`, `name`, `slug` (citext unique), `timezone` (default `America/Costa_Rica`), `logo_path`, `brand_primary_color`, `status` (ACTIVE|SUSPENDED), `live_threshold_seconds` (30), `stale_threshold_seconds` (180), `created_at`, `updated_at`.
Per-company thresholds satisfy §20's "must be configurable" without a settings service.

**`company_domains`** — `id`, `company_id`→companies, `hostname` (citext **unique globally**), `kind` (PLATFORM_SUBDOMAIN|CUSTOM), `is_primary`, `verified_at`, `created_at`. Index on `hostname`. This is the table Caddy's on-demand-TLS `ask` endpoint queries.

**`users`** — `id`, `company_id`→companies **nullable** (null ⇒ platform SUPER_ADMIN), `email` (citext, **nullable**, unique globally when present — D15), `username` (citext, nullable), `password_hash` (argon2id), `must_change_password` (bool, default false), `name`, `role` (SUPER_ADMIN|COMPANY_ADMIN|OPERATOR|DRIVER), `status` (ACTIVE|DISABLED), `last_login_at`, timestamps.
Index `(company_id, role)`. Unique `(company_id, username)`. Check constraint: `email IS NOT NULL OR username IS NOT NULL` — a user must have some way to log in (D20). Web roles are created with an email; drivers are created with a username.

**`driver_profiles`** — `user_id` PK→users, `company_id`→companies, `phone`, `license_number`, `default_bus_id`→buses (nullable), `status` (ACTIVE|INACTIVE). Index `(company_id, status)`.

**`refresh_tokens`** — `id`, `user_id`→users, `token_hash` (sha-256, unique), `device_label`, `expires_at`, `revoked_at`, `created_at`. Index `(user_id)`. Rotation on use: the presented token is revoked and a new one issued. Presenting an already-revoked token revokes **every** token for that user — the correct response to a suspected theft, and it needs no token-family column or chain walk.

**`buses`** — `id`, `company_id`, `label` ("Bus 24"), `license_plate`, `status` (ACTIVE|INACTIVE|MAINTENANCE|RETIRED), timestamps. Unique `(company_id, label)`.

**`routes`** — `id`, `company_id`, `name`, `origin_label`, `destination_label`, `public_slug` (citext), `status` (ACTIVE|INACTIVE), timestamps. Unique `(company_id, public_slug)`. `public_slug` drives passenger URLs and QR targets.

**`route_variants`** — `id`, `company_id`, `route_id`, `name` ("Vía Grecia"), `direction` (OUTBOUND|INBOUND), `headsign` ("Hacia Palmares"), `geometry` **jsonb** (GeoJSON LineString, `[lng, lat]` order), `is_default`, `status`, timestamps. Index `(route_id, status)`. Check constraint: `geometry->>'type' = 'LineString'`.

**`stops`** — `id`, `company_id`, `name`, `latitude` (double precision), `longitude`, timestamps. Index `(company_id)`. Company-scoped physical places, reusable across variants (**A2**).

**`route_variant_stops`** — `id`, `company_id`, `route_variant_id`, `stop_id`, `sequence` (int). Unique `(route_variant_id, stop_id)`. Index `(route_variant_id, sequence)`.
`sequence` is deliberately **not** unique. A deferrable unique constraint would need raw SQL that Prisma cannot manage and that its migration diffing would fight on every later change, and the worst consequence of a duplicate is a non-deterministic display order — not corruption. The reorder endpoint takes the full ordered array of stop ids and rewrites `1..N` in one transaction; a test asserts the result is contiguous and gap-free. Correctness lives in one service method plus one test instead of in exotic DDL.

**`schedules`** — `id`, `company_id`, `route_variant_id`, `departure_time` (`time`), `days_of_week` (`smallint[]`, 0=Sunday, check: values 0–6, non-empty), `active` (bool), timestamps. Index `(route_variant_id, active)`. One row per departure time; §14's "multiple departures per day" is multiple rows.

**`trips`** — `id`, `company_id`, `route_id`, `route_variant_id`, `schedule_id` (nullable, **A6**), `bus_id`, `driver_user_id`, `status` (SCHEDULED|ACTIVE|COMPLETED|CANCELLED — `SCHEDULED` unreachable in the MVP, **A22**), `scheduled_departure_at`, `started_at`, `ended_at`, `end_reason` (DRIVER|ADMIN|AUTO_TIMEOUT, nullable), `rejected_point_count` (int, default 0 — incremented only when a batch contains points failing D12's clock checks, so operators can see a misconfigured device), timestamps.
Indexes: `(company_id, status)`, `(route_variant_id, status)`, `(company_id, started_at DESC)`, `(driver_user_id, started_at DESC)`.
**Partial unique indexes** (the integrity backbone):

```sql
CREATE UNIQUE INDEX trips_one_active_per_bus    ON trips (bus_id)         WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX trips_one_active_per_driver ON trips (driver_user_id) WHERE status = 'ACTIVE';
```

These make "two trips on one bus" impossible at the database level rather than by convention.

**`location_points`** — `id` (bigserial), `trip_id`, `company_id`, `client_point_id` (uuid), `latitude`, `longitude`, `accuracy_m` (real), `speed_mps` (real), `bearing_deg` (real), `device_timestamp`, `server_timestamp` (default now()).
Unique `(trip_id, client_point_id)` — the idempotency key (D8).
Index `(trip_id, device_timestamp)` — serves trip playback and history.
Index `(server_timestamp)` — serves retention cleanup. Not prefixed with `company_id`: retention deletes by age across all companies, and a leading `company_id` would make the index useless for that scan.
Table partitioning is **not** used in the MVP; at 40 buses × 1 pt/6 s × 14 h/day ≈ 3.4 M rows/month, a plain table with a 90-day retention job stays comfortably small. Partitioning is noted in `docs/scaling.md` as the next step.

**`trip_live_states`** — `trip_id` PK→trips (ON DELETE CASCADE), `company_id`, `route_id`, `route_variant_id`, `bus_id` (denormalized so the passenger query needs no joins), `latitude`, `longitude`, `accuracy_m`, `speed_mps`, `bearing_deg`, `device_timestamp`, `server_timestamp`, `updated_at`.
No point counter: D11's guard clause skips the whole `UPDATE` when a batch does not advance the position, so a counter here would silently undercount out-of-order flushes. Trip point totals come from `COUNT(*)` on `location_points` when an operator opens a trip — a query that runs once per page view, not once per GPS fix.
Index `(route_variant_id)`, index `(company_id)`.
**No `connection_status` column** (D9). The passenger "active buses on this route" query is a single index scan over at most a few rows.

**`trip_incidents`** (optional §6 feature) — `id`, `company_id`, `trip_id`, `reported_by_user_id`, `category` (VEHICLE|TRAFFIC|VEHICLE_CHANGE|OTHER), `note`, `created_at`.

**`audit_logs`** (§26) — `id` (bigserial), `company_id` (nullable), `actor_user_id` (nullable), `action` (`bus.create`, `route.delete`, `user.role_change`…), `entity_type`, `entity_id`, `metadata` (jsonb), `ip` (inet), `created_at`. Index `(company_id, created_at DESC)`. Written by a NestJS interceptor on all mutating admin routes; never written on the ingest hot path.

### 4.2 Hot-path SQL

Ingest (one statement per batch, D8/D11):

```sql
INSERT INTO location_points (trip_id, company_id, client_point_id, latitude, longitude,
                             accuracy_m, speed_mps, bearing_deg, device_timestamp)
SELECT * FROM UNNEST($1::uuid[], …)
ON CONFLICT (trip_id, client_point_id) DO NOTHING
RETURNING client_point_id;

INSERT INTO trip_live_states AS s (trip_id, company_id, …, device_timestamp, server_timestamp)
VALUES (…)                       -- the newest accepted point of the batch, once
ON CONFLICT (trip_id) DO UPDATE
  SET latitude = EXCLUDED.latitude, …
  WHERE EXCLUDED.device_timestamp > s.device_timestamp
RETURNING trip_id;               -- empty result ⇒ position did not advance ⇒ no broadcast (D19)
```

Both statements run in one transaction; the WebSocket broadcast happens after it commits, and only if the second statement returned a row (D19).

Passenger "buses on this route" (no joins, no history scan — §19):

```sql
SELECT trip_id, bus_id, latitude, longitude, bearing_deg, accuracy_m, speed_mps, device_timestamp
FROM trip_live_states WHERE route_variant_id = ANY($1);
```

### 4.3 Retention and background jobs (`@nestjs/schedule`)

| Job                  | Cadence                   | Action                                                                                                  |
| -------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `purgeOldLocations`  | daily 03:00 company-local | `DELETE FROM location_points WHERE server_timestamp < now() - interval '90 days'` in 10 000-row batches |
| `sweepStaleTrips`    | every 5 min               | Auto-complete `ACTIVE` trips with no point for `TRIP_AUTO_END_MINUTES` (**A15**)                        |
| `purgeExpiredTokens` | daily                     | Delete refresh tokens past `expires_at`                                                                 |

---

## 5. Backend modules (NestJS)

```
apps/api/src/
  main.ts                      helmet, trust proxy (1 hop), global validation & exception filters
  app.module.ts
  common/
    config/                    typed env loading, fail-fast on missing vars (§39)
    prisma/                    PrismaService + the fail-closed tenancy extension (D14)
    logging/                   pino, request id, redaction (§35)
    http/                      global exception filter, error envelope, pagination
    zod/                       ZodValidationPipe bridging packages/contracts
  auth/                        login, refresh (rotating), logout, argon2id, JwtStrategy,
                               RolesGuard, @Roles/@Public decorators, throttled endpoints
  tenancy/                     HostResolutionMiddleware (Host/X-Forwarded-Host → company),
                               CompanyContext (AsyncLocalStorage), CompanyScopeGuard
  platform/                    SUPER_ADMIN only (A20): create/suspend companies, set slug
                               and timezone, create a company's first admin, manage hostnames
  companies/                   profile, branding, logo upload, thresholds, domains CRUD
  users/                       admin user CRUD, role assignment, disable, admin-issued
                               password reset (A21)
  drivers/                     driver profile CRUD, default-bus assignment
  buses/                       CRUD, status
  routes/                      routes + variants (geometry validation, default variant)
  stops/                       stop CRUD + variant-stop attach/detach/reorder (transactional)
  schedules/                   CRUD, activate/deactivate, next-departure resolution
  trips/                       start/end/cancel state machine, admin listing, detail, history
  locations/                   batch ingest, validation & clamping (D12), trip playback query
  live/                        live-state read model, status derivation, LiveGateway (Socket.IO)
  public/                      unauthenticated passenger API — separate controllers and
                               separate DTOs; nothing here can reference a driver or a plate
  qr/                          PNG/SVG QR generation for company & route URLs
  audit/                       AuditInterceptor + query API
  maintenance/                 scheduled jobs (§4.3)
  health/                      /healthz (liveness), /readyz (db ping)
```

Three cross-cutting rules that are easy to omit and expensive to retrofit:

- **Logo upload** (§42) accepts PNG, JPEG and WebP only, validated by magic bytes rather than by filename or content-type, capped at 1 MB, and stored under a generated name. **SVG is rejected** — it is a script-execution vector served from the company's own origin. Files land on a mounted volume served by the backend behind a `Content-Type` it sets itself.
- **The public WebSocket namespace is unauthenticated**, so it is rate-limited like any public endpoint: a per-IP connection cap, a cap on rooms per socket, and a bounded `subscribe` rate. Without these, one client can open unlimited sockets against a single-process gateway.
- **A driver may only post to their own active trip.** Ingest verifies `trip.driver_user_id = sub` **and** `trip.status = 'ACTIVE'` before accepting a batch. §26 calls this out by name ("a malicious user must not be able to submit arbitrary locations for another company's buses"), and it is a _within_-tenant check that the cross-tenant conformance suite would not catch — so it gets its own tests (§9.1).

### 5.1 API surface (v1)

**Auth** — `POST /auth/login` (`{ email, password }`, web) · `POST /auth/driver/login` (`{ companyCode, username, password }`, D20) · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` · `POST /auth/change-password` (also the forced path when `must_change_password` is set, A21).

**Platform** (JWT, SUPER_ADMIN only — A20) — `/platform/companies` (create/list/suspend), `POST /platform/companies/:id/admins` (create the first COMPANY_ADMIN, returns a one-time password), `/platform/companies/:id/domains`, `POST /platform/users/:id/reset-password`.

**Admin** (JWT + role, company-scoped) — `/companies/me`, `/companies/me/domains`, `/users` (+ `POST /users/:id/reset-password`), `/drivers`, `/buses`, `/routes`, `/routes/:id/variants`, `/variants/:id/stops` (+ `PUT /variants/:id/stops/order`), `/stops`, `/schedules` (incl. `DELETE`, per §14), `/trips`, `/trips/:id/locations` (playback), `/live/fleet`, `/audit-logs`, `/qr/company`, `/qr/route/:id`.
`GET /trips` implements §24's "search trips": filters for date range, status, route, variant, bus and driver, keyset-paginated on `started_at`.

**Driver** (JWT, role DRIVER) — `GET /driver/assignment` (bus + routes available to me), `POST /driver/trips` (start), `POST /driver/trips/:id/locations` (**ingest**), `POST /driver/trips/:id/end`, `POST /driver/trips/:id/incidents`, `GET /driver/trips/active` (crash recovery).

**Public** (no auth, host-scoped, rate-limited) — `GET /public/company`, `GET /public/routes` (each with `activeBusCount`, for §5's "active routes" on the landing page), `GET /public/routes/:slug` (variants with headsigns, stops, geometry, schedule), `GET /public/routes/:slug/live` (initial snapshot + polling fallback), `GET /public/domains/allowed?domain=` (Caddy `ask`).

**WebSocket** — namespace `/live`, room `company:{companyId}:variant:{routeVariantId}` (§31 suggests route-level rooms; variant-level is finer and strictly cheaper). Clients emit `subscribe { routeSlug }` and the server joins them to the rooms of **all** of that route's variants, so a passenger sees both directions and can filter locally (**A23**). The company is resolved **from the socket's Host header**, never from client-supplied ids. The server emits `bus:update` with the public DTO only, at most once per accepted batch and only when the position advanced (**D19**). A client receiving an unknown `tripId` adds a marker; `bus:ended` on trip completion removes it deliberately rather than by timeout (§5: "the bus should not simply disappear without explanation").

### 5.2 Authorization matrix

| Capability                                        |     SUPER_ADMIN     |           COMPANY_ADMIN           |      OPERATOR       |  DRIVER   |
| ------------------------------------------------- | :-----------------: | :-------------------------------: | :-----------------: | :-------: |
| Create/suspend companies, manage domains          |         ✅          |            own domains            |          —          |     —     |
| Create a company's first admin                    |         ✅          |                 —                 |          —          |     —     |
| Manage users & roles                              |       — (A7)        |                ✅                 |          —          |     —     |
| Reset another user's password (A21)               | company admins only | own company's operators & drivers |          —          |     —     |
| Change own password                               |         ✅          |                ✅                 |         ✅          |    ✅     |
| Buses / drivers / routes / stops / schedules CRUD |          —          |                ✅                 | read + trip control |     —     |
| Live fleet map, trip history                      |          —          |                ✅                 |         ✅          | own trips |
| End/cancel any trip                               |          —          |                ✅                 |         ✅          | own trip  |
| Start trip, submit locations                      |          —          |                 —                 |          —          |    ✅     |

Enforced by `RolesGuard` + `CompanyScopeGuard`; every table row above becomes a test case in the conformance suite (§9.1).

---

## 6. Frontend modules (Next.js, App Router)

```
apps/web/
  middleware.ts          Host → surface. Admin host ⇒ /admin/*. Otherwise rewrite to the
                         public surface and pass the resolved host downstream.
  app/
    (public)/
      layout.tsx         server component: fetch company branding by host, set theme vars
      page.tsx           company landing: name, logo, route list, live-route badges
      r/[slug]/page.tsx  route page: SSR shell (route, stops, geometry, schedule)
                         + direction selector (A23) + <LiveLayer/> client island
      not-found.tsx      unknown host / unknown route
    (admin)/admin/
      login/  dashboard/  buses/  drivers/  routes/[id]/  stops/  schedules/
      live/   trips/[id]/  settings/{company,domains,users}/  qr/
      platform/          SUPER_ADMIN only (A20): companies, new-company wizard, domains
    api/health/route.ts
  components/
    map/                 MapContainer (dynamic import, ssr:false), RouteLine, StopMarkers,
                         BusMarker (rAF interpolation, D13), AccuracyCircle, GeometryEditor
    live/                LiveStatusBadge, RelativeTime (client-only), ConnectionBanner
    admin/               DataTable, EntityForm, ConfirmDialog, StopOrderEditor (drag)
  lib/
    api.ts               typed fetch wrapper over packages/contracts
    useLiveBuses.ts      socket.io subscribe + reconnect + REST resnapshot on reconnect
                         + automatic 10 s polling fallback if WS never connects (§10)
    liveStatus.ts        shared threshold logic — same source of truth as the backend
    copy.ts              all user-facing Spanish strings (A11)
```

Frontend specifics that matter:

- **Passenger initial load (§33)** — the route page is server-rendered with geometry, stops, and a live snapshot already in the HTML. The map and socket hydrate afterwards. The passenger sees the route before any JavaScript executes.
- **Relative timestamps** render `—` on the server and fill in on mount, avoiding hydration mismatch and preventing a cached page from displaying a frozen "hace 4 segundos".
- **Reconnect correctness** — on socket reconnect, the client refetches the REST snapshot before resuming the stream; missed events during the gap cannot leave a stale marker on screen.
- **Branding** (§42) — company colors applied as CSS custom properties on the public layout; a small "Powered by TuBus" footer that does not compete with company identity.
- **Admin geometry editor** — draw/edit a LineString on MapLibre plus a paste-GeoJSON textarea. The paste path is the escape hatch that keeps the drawing tool simple.
- **No cookies on the public surface** (§23) — no analytics, no consent banner, no personalization.
- **React Query is scoped to the admin surface and live views only.** Public pages are server components with no client data layer, so the passenger bundle stays small (§33). This is a scoping rule, not a preference: adopting a client cache on the public pages would undo the SSR-first decision above.
- **The CSP must accommodate MapLibre** — `worker-src blob:`, plus the configured tile host in `connect-src` and `img-src`. Worth settling in Phase 4 rather than discovering it during the Phase 9 security pass.

---

## 7. Android modules (Kotlin / Compose)

Single Gradle module with layered packages — a multi-module split would be premature abstraction at this size (§37).

```
android/app/src/main/java/com/tubus/driver/
  di/                Hilt modules
  data/
    local/           Room: QueuedPointEntity, TripSessionEntity, DAOs
    remote/          Retrofit API, AuthInterceptor, TokenAuthenticator (401 → refresh → retry)
    secure/          EncryptedSharedPreferences token store
    repo/            AuthRepository, TripRepository, LocationRepository
  location/          LocationEngine (FusedLocationProviderClient),
                     TrackingService (foreground, type=location)
  sync/              SyncWorker (WorkManager), SyncScheduler, batching + backoff
  ui/                LoginScreen, HomeScreen (assigned bus/route, Start/End),
                     StatusPanel (GPS / network / queue depth / last sync), IncidentSheet
  system/            PermissionCoordinator, BatteryOptimizationHelper, BootReceiver
```

### 7.1 Tracking design (§7)

1. Driver taps **Start trip** while the app is in the foreground → `POST /driver/trips` → `startForegroundService()`.
2. `TrackingService` runs with `foregroundServiceType="location"` and an ongoing, non-dismissible notification ("Viaje activo — transmitiendo ubicación") that satisfies §7's "clearly indicate when tracking is active".
3. `FusedLocationProviderClient` with `Priority.HIGH_ACCURACY`, `intervalMillis = 5 s`, `minUpdateIntervalMillis = 3 s`, `minUpdateDistanceMeters = 10` (§8's 5–10 s target, with the distance filter suppressing updates at a bus stop to save battery).
4. Every fix is written to Room **first**, with a locally generated `clientPointId` UUID. Nothing is sent before it is durably stored.
5. `SyncWorker` (expedited, `NetworkType.CONNECTED`, exponential backoff from 10 s) uploads unsent rows in chronological batches of ≤200 and deletes rows the server acknowledges.

**Location services disabled is a distinct failure from permission denied**, and §7 names both. Permission granted with the device's location toggle off yields no fixes at all and no error — the silent failure mode that makes a driver believe they are being tracked when they are not. Before starting a trip the app checks settings with `SettingsClient`/`LocationSettingsRequest` and shows the system resolution dialog; while tracking, losing location services raises the §34 message ("Ubicación desactivada. Actívala para continuar el rastreo") in the notification and on the home screen. The trip is not silently ended.

**Permissions — an important simplification.** `ACCESS_BACKGROUND_LOCATION` is **not requested**. A foreground service of type `location`, started while an activity is visible, may access location while the driver uses other apps — which is exactly the §7 requirement. Avoiding the background-location permission removes the Play Store sensitive-permission review and its declaration video requirement. Requested permissions: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS` (API 33+), `INTERNET`, `ACCESS_NETWORK_STATE`, `RECEIVE_BOOT_COMPLETED`.

**Device reboot (§7, "where technically appropriate").** Android 12+ forbids starting a location foreground service from a `BOOT_COMPLETED` receiver. The honest implementation: on boot, if a trip was active, post a high-priority notification asking the driver to reopen the app to resume; tapping it restores the session and the service. Silent auto-resume is not technically possible and will not be faked.

**OEM battery killers.** Aggressive OEM task-killing (Xiaomi, Huawei, Oppo, Samsung) is the top real-world reliability risk. Mitigation: prompt once for battery-optimization exemption, detect service death via a `WorkManager` heartbeat that alerts the driver if the service stopped while a trip is active, and ship a short per-OEM setup guide.

### 7.2 Offline behavior (§9)

GPS acquisition and network transport are fully independent: the location engine writes to Room regardless of connectivity, and `SyncWorker` drains the queue independently. The UI shows queue depth and last successful sync. The queue is capped (default 25 000 points ≈ 40 h) with oldest-first eviction and a logged warning. Timestamps are the device fix times, preserved verbatim — the server distinguishes them from receipt time (§18, D10).

---

## 8. GPS simulator (§29) — built in Phase 3, not last

`tools/simulator` — a Node CLI that speaks the **same public API contract as Android** and therefore validates the real pipeline.

```bash
pnpm simulate --route sanjose-palmares --bus "Bus 24" --speed 60 \
              --interval 5 --drop-network-after 60 --reconnect-after 120
```

Capabilities: authenticate as a driver, start a trip, walk the variant's LineString at a configurable km/h with linear interpolation between vertices, emit points with realistic jitter and bearing, simulate a network outage (buffer locally exactly as Android does), then reconnect and flush the buffer in order. Running several instances gives a multi-bus fleet for testing the admin live map.

This is what makes DoD steps 19–23 (offline interruption and resync) testable in CI without a physical phone, and it is what unblocks the passenger web work before Android exists.

---

## 9. Testing strategy (§36)

### 9.1 Backend

| Layer                   | Tool                                                                                                                            | Coverage                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                    | Jest                                                                                                                            | Live-status derivation across thresholds and clock skew; timestamp clamping (D12); batch dedup rules; schedule day/time resolution in company timezone; geometry validation; permission matrix                                  |
| Integration             | Jest + Postgres (a `tubus_test` database in the dev compose; CI uses the GitHub Actions `postgres` service — no new dependency) | Every controller against a real database, with a per-file truncate-and-reseed                                                                                                                                                   |
| **Tenancy conformance** | Jest, parametrized                                                                                                              | Every tenant-scoped endpoint × {other company's token, no token, wrong role}. Asserts **404** for cross-tenant, 401 unauth, 403 wrong-role. This suite is the enforcement mechanism for §26 and is a required CI gate.          |
| Pipeline e2e            | Jest                                                                                                                            | Boot the Nest app + a socket client, drive the simulator programmatically, assert: points persisted, live state advanced, WS event received, duplicate replay is a no-op, out-of-order flush does not move the marker backwards |

Explicit test cases required by §36 that are easy to miss: duplicate location handling (send the same batch twice), offline synchronization (200 points with timestamps 10 minutes old arriving at once), and active-bus retrieval performance (the live query must not touch `location_points`).

Two further cases the conformance suite structurally cannot cover, so they are written by hand:

- **Cross-driver ingest within one tenant** — driver A posting to driver B's trip must be rejected, as must posting to a `COMPLETED` trip. Both are same-company requests, so tenant scoping passes and only the ownership check stands between them and §26's stated requirement.
- **Broadcast amplification** — a 200-point flush must produce exactly one `bus:update`, and a batch that does not advance the position must produce none (**D19**).

### 9.2 Frontend

Vitest + Testing Library: route page renders stops and geometry; live status badge transitions LIVE→STALE→OFFLINE at threshold boundaries; a `bus:update` event moves the marker; a `bus:ended` event removes it; socket failure falls back to polling. MapLibre is mocked at the module boundary — asserting on rendered map tiles is not worth the cost.

Playwright: two smoke flows only — (1) passenger opens a company host, opens a route, sees a simulated bus move; (2) admin logs in, creates a route + variant + stops, and it appears on the public surface.

### 9.3 Android

JUnit + coroutines-test/Turbine: queue write-before-send ordering, batch chunking, dedup after a failed-then-retried upload, token refresh on 401, backoff schedule. Room tested in-memory. Instrumented tests (a single API level in CI, plus manual matrix testing): permission grant/deny paths, foreground service starts and posts its notification, service survives the app being backgrounded, trip end stops the service.

A **contract test** in the Android suite asserts the request/response JSON shape against fixture files checked into `packages/contracts/fixtures/`. The API's integration tests validate the _same_ files against their Zod schemas, so a contract change that breaks Android breaks the backend build too. Both sides read committed fixtures — there is no generator, no codegen step and no build-order coupling between the Gradle and pnpm projects.

### 9.4 Manual test plan

A written checklist covering what automation cannot: real device on a real drive, tunnel/dead-zone behavior, airplane-mode toggling mid-trip, phone reboot mid-trip, battery drain over a 4-hour shift, screen-off for 30+ minutes, and the OEM battery-killer matrix.

---

## 10. Local development setup (§28)

```bash
git clone … && cd tubus
cp .env.example .env
docker compose up -d          # postgres, api (watch), web (dev)
pnpm db:migrate && pnpm db:seed
pnpm simulate --route sanjose-palmares    # a bus starts moving
```

`docker-compose.yml` services: `postgres` (named volume, healthcheck), `api` (bind-mounted source, hot reload, port 8080), `web` (Next dev, port 3000). Caddy is **not** in the dev compose — it is only in the prod compose, keeping local startup fast.

**Multi-tenant hosts locally.** `tuanrl.localhost:3000` and `admin.localhost:3000` resolve to 127.0.0.1 natively in Chrome, Edge, and Firefox. A documented `hosts`-file fallback is provided for other clients. Non-browser tooling can override the tenant with an `X-Tenant-Host` header, honored **only when `NODE_ENV !== 'production'`**.

**Android against the local backend.** Physical device over USB: `adb reverse tcp:8080 tcp:8080`, then `API_BASE_URL=http://localhost:8080`. Emulator: `http://10.0.2.2:8080`. Cleartext HTTP is permitted by a `network_security_config.xml` scoped to `localhost`/`10.0.2.2` and applied **to the debug build only**.

**Seed data** (`tools/seed`) creates: a platform SUPER_ADMIN, company _Tuan RL_ (`tuanrl.localhost`, company code `tuanrl`), a COMPANY_ADMIN, an OPERATOR, two drivers with usernames (D20), three buses, the route _San José → Palmares_ with two directional variants carrying real polyline geometry, five stops, and a weekday schedule — i.e. DoD steps 1–7 are satisfied by one command, so every subsequent test starts from a realistic state. Credentials are printed on completion and are development-only.

`.env.example` (§39) documents every variable with a comment: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `PLATFORM_DOMAIN`, `ADMIN_HOST`, `PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_MAP_STYLE_URL`, `LOCATION_RETENTION_DAYS`, `TRIP_AUTO_END_MINUTES`, `LOG_LEVEL`, `RATE_LIMIT_*`. The API fails to boot with a clear message if a required variable is missing — no silent defaults for secrets.

---

## 11. Deployment (§40)

```
Internet
   ↓ :80 / :443
Caddy  ── automatic HTTPS, on-demand TLS for custom domains (ask → API)
   ├─ admin.tubus.example, *.tubus.example, custom domains → web:3000
   ├─ /api/*                                               → api:8080
   └─ /socket.io/*                          → api:8080 (WebSocket upgrade)
Docker Compose (single VPS, 2 vCPU / 4 GB)
   ├─ web        Next.js standalone build, non-root
   ├─ api        NestJS, non-root, /healthz + /readyz
   └─ postgres   named volume, tuned shared_buffers
```

- **Deploy** — build images in CI, push to GHCR, then on the VPS `docker compose pull && docker compose up -d`. Migrations run as a one-shot `prisma migrate deploy` step gated before the API starts. `migrate dev` never runs in production.
- **DNS** — one A record for `tubus.example`, one wildcard A record for `*.tubus.example`. Customers point their custom domain at the VPS with a CNAME/A record; the admin adds the hostname in the dashboard, the operator marks it verified, and Caddy obtains the certificate on the first request. No DNS provider API token, no wildcard certificate, satisfying §4's "automated DNS management is not required".
- **Downtime** — ~20–30 s on deploy. Acceptable for the MVP and stated explicitly rather than pretended away. Drivers' queued points survive it (§9), so no location data is lost during a deploy.
- **Backups** — nightly `pg_dump` **plus the uploaded-logo volume** to the VPS disk with 7-day rotation, and an offsite copy (rsync/rclone to any provider). The volume is easy to forget: a database-only backup restores every company with a broken logo. A **restore drill is part of the Phase 9 exit criteria** — an untested backup is not a backup.
- **Secrets** — `.env` on the host with `600` permissions, never in the image, never in Git (§26/§39). CI secrets in the repository's secret store.
- **Hardening** — ufw allowing 22/80/443 only; SSH keys only; automatic security updates; Postgres bound to the compose network with no published port; containers run as non-root; `helmet` and a strict CSP on the web; `@nestjs/throttler` on `/auth/*` (per IP + per account) and on all public endpoints.
- **Monitoring** — Docker restart policies, `/healthz` and `/readyz` probes, disk-space alerting, and an uptime check from any free external pinger. No APM stack (§35).

---

## 12. Phased roadmap

Estimates assume one experienced full-stack developer; Android is the least compressible phase.

| Phase                      | Deliverable                                                                                                                                                                                                                                                                                                                | Exit criteria                                                                                                                   | Est.  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----- |
| **0 — Foundations**        | Monorepo, pnpm workspaces, TS config, ESLint/Prettier enforcing [`CODESTYLE.md`](CODESTYLE.md), commitlint + husky, dev `docker-compose.yml`, `.env.example`, CI (lint + typecheck + test)                                                                                                                                 | `docker compose up` starts Postgres; CI green on an empty test suite                                                            | 2–3 d |
| **1 — Spine**              | Full Prisma schema + migrations (incl. the raw-SQL partial unique indexes on `trips`), seed script, dual login (email / company code + username — D20), argon2id, JWT access + rotating refresh, forced password change, roles guard, host→company resolution, fail-closed tenancy extension, pino logging, error envelope | Seeded DB; login works for all four roles from both surfaces; the **tenancy conformance suite is green** and wired as a CI gate | 5–7 d |
| **2 — Domain CRUD**        | Companies, users, drivers, buses, routes, variants (geometry validation), stops + transactional reorder, schedules — API + integration tests                                                                                                                                                                               | DoD steps 1–7 achievable via API; §36's route/stop retrieval tests pass                                                         | 5–6 d |
| **3 — Live pipeline ★**    | Trip state machine, batch ingest with dedup and clamping, `trip_live_states` upsert, status derivation, Socket.IO gateway with host-scoped rooms, public endpoints, **GPS simulator**                                                                                                                                      | Simulator drives a trip; points persist; live state advances; WS events observed; duplicate + out-of-order flush tests pass     | 5–6 d |
| **4 — Passenger web ★**    | Host-resolved landing page, route page (SSR shell), MapLibre map, route line, stops, interpolated bus marker, status badges, reconnect + polling fallback                                                                                                                                                                  | A passenger opens a company host and watches the simulated bus move — **DoD steps 14–18, 23**                                   | 5–6 d |
| **5 — Admin dashboard**    | Login, all CRUD screens, geometry/stop map editors, live fleet map, trip history + search + playback, users & roles, admin-issued password reset (**A21**), company settings, audit log view, **platform section for company creation (A20)**                                                                              | DoD steps 1–7 and 24–25 achievable through the UI, starting from an empty database                                              | 7–9 d |
| **6 — Android**            | First-launch company code + login (D20), assignment screen, start/end trip, foreground service, Fused location, location-settings resolution, Room queue, WorkManager sync, GPS/network/queue status UI, incident report                                                                                                   | Real phone drives a real trip and appears on the passenger map — **DoD steps 8–13**                                             | 7–9 d |
| **7 — Offline hardening**  | Airplane-mode cycles, long-outage flush, queue caps, token expiry while offline, reboot notification, battery-optimization prompt, crash recovery of an active trip                                                                                                                                                        | **DoD steps 19–23** verified on a physical device over a real drive                                                             | 3–4 d |
| **8 — Product completion** | Branding/logo upload, QR generation + print view, custom-domain management + Caddy `ask` endpoint, retention + stale-trip jobs, audit interceptor coverage                                                                                                                                                                 | Custom domain serves over HTTPS end-to-end; QR resolves to a live route                                                         | 3–4 d |
| **9 — Production**         | Prod compose + Caddyfile, CI/CD deploy, backups + **restore drill**, rate limits, security pass, Playwright smoke suite, ops runbook                                                                                                                                                                                       | Full DoD §43 (all 25 steps) reproduced on the deployed VPS                                                                      | 3–4 d |

**Total: ~41–56 developer-days.** Phases 3 and 4 (★) constitute the vertical slice that proves §45's core thesis; if the schedule compresses, protect those two and defer scope from Phase 5 and 8 instead.

### 12.1 Suggested demo checkpoint

At the end of Phase 4 — roughly half the effort — the product can be demonstrated end-to-end with the simulator standing in for Android: a passenger opens a URL and watches a bus move along its route in real time, including a simulated tunnel and resync. That is the earliest point at which the concept is proven, and it is the right moment to validate direction with the client before investing in the Android and admin phases.

---

## 13. Risk register

| Risk                                                     | Likelihood | Impact | Mitigation                                                                                                                                             |
| -------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OEM battery managers kill the tracking service mid-shift | High       | High   | Battery-optimization exemption prompt, heartbeat-based death detection with driver alert, per-OEM setup guide, device-matrix manual testing in Phase 7 |
| Map tile provider choice deferred too long (**A12**)     | Medium     | Medium | Decide before Phase 9; `pmtiles` for Costa Rica is a zero-recurring-cost fallback that can be adopted in a day                                         |
| Driver phone data plan exhausted or throttled            | Medium     | Medium | Batching plus the 10 m distance filter keeps usage near ~5 MB/shift; queue survives loss                                                               |
| Play Store review friction for a location app            | Medium     | Medium | Background-location permission avoided entirely (§7.1); internal-testing track is available immediately as a fallback                                  |
| WebSocket fan-out outgrows one process                   | Low (MVP)  | Medium | Documented Redis-adapter path; polling fallback already exists as a safety net                                                                         |
| Device clock skew corrupts ordering                      | Medium     | Medium | Clamping and rejection rules (D12), with rejected-point counters surfaced in the admin trip view                                                       |
| Custom-domain on-demand TLS abused to mint certificates  | Low        | Medium | The `ask` endpoint only answers 200 for verified hostnames already in `company_domains`, and is rate-limited                                           |
| Scope creep from §44's future-features list              | High       | High   | §44 is explicitly out of scope; every deferred item has a documented, additive migration path, so saying "not now" costs nothing later                 |

---

## 14. Open questions requiring your decision

A11, A13 and A18 are resolved and no longer need an answer. Questions 1–3 below are needed **before Phase 1**, because they change the schema or the login surface; the rest can be settled during the phase that consumes them. Every one has a working default already written into this document, so **silence is not a blocker** — it is acceptance of the stated resolution.

1. **A1** — Confirm the admin dashboard lives on a single fixed host (`admin.tubus.example`), with company and custom domains serving passengers only.
2. **A19 / A21** — Confirm driver login by company code + username (drivers have no email), and administrator-issued password resets in place of email recovery.
3. **A20** — Confirm the small `SUPER_ADMIN` platform section for creating companies. Without it, DoD step 1 has no user interface and companies can only be created by API call or seed script.
4. **A7** — Confirm that `SUPER_ADMIN` is restricted to company/domain lifecycle and cannot read tenant operational data in the MVP.
5. **A6 / A9 / A15 / A16 / A22** — Confirm: trips created on driver start, with `SCHEDULED` unreachable in the MVP; one default bus per driver, overridable at trip start; automatic trip completion after 90 minutes of silence.
6. **A23** — Confirm the passenger route page offers a direction selector, given that variants are directional (D6).
7. **A14** — Confirm 90-day raw-location retention.
8. **A12** — Choose the production map tile source (free tier vs. self-hosted `pmtiles`). Needed by Phase 9, not before.

---

## 15. Deferred work log

`CODESTYLE.md` requires that future work be tracked here rather than in `TODO` comments. This is that list. Nothing below is in MVP scope; each entry names what would trigger it, so the decision to build it is evidence-driven rather than speculative.

| Item                                              | Trigger                                                                                         | Notes                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Socket.IO Redis adapter, multiple API processes   | One process saturates, or zero-downtime deploys become a requirement                            | One added adapter line + one container (D2)                        |
| `location_points` partitioning by month           | Table exceeds ~50 M rows or retention deletes get slow                                          | Retention becomes `DROP PARTITION` (§4.1)                          |
| PostGIS                                           | First feature needing real geographic queries — map matching, route-deviation detection, or ETA | `CREATE EXTENSION` + a generated column from existing jsonb (D4)   |
| Self-service password reset by email              | An SMTP provider is chosen                                                                      | Replaces admin-issued resets (A21); do not add SMTP for this alone |
| `company_memberships` join table                  | One person must administer two companies                                                        | Removes D15's single-company limit additively                      |
| `bus_assignments` with validity windows           | Companies run shift rosters rather than a fixed bus per driver                                  | Supersedes `default_bus_id` (A9)                                   |
| Trip pre-generation from schedules                | Operators need to see expected-but-not-started departures, or schedule-adherence reporting      | Makes `SCHEDULED` reachable (A22)                                  |
| SUPER_ADMIN audited impersonation                 | Platform support needs to reproduce a company-specific bug                                      | Must be time-boxed and audit-logged (A7)                           |
| Stop-level QR codes and "next buses at this stop" | Companies ask for stop signage                                                                  | §23 lists this as optional; needs arrival estimation to be useful  |
| i18n framework                                    | A second language is actually required                                                          | Until then, one `copy.ts` dictionary (A11)                         |
| Object storage for logos                          | Multiple app servers, or the volume becomes awkward to back up                                  | One-file swap behind the existing upload service (§1.2)            |

---

## 16. Readiness

This roadmap is ready for implementation. The specification has been reviewed section by section against it; §§1–45 are accounted for, all 25 Definition-of-Done steps map to a phase with exit criteria, and the twenty-three ambiguities, contradictions and gaps in §2 each carry a resolution. Fourteen are settled and need no input; the nine marked _Confirm_ have a stated default that implementation will follow unless you say otherwise.

Phase 0 can begin. The first decision that cannot be deferred past Phase 1 is A19/A20 — driver login identity and company creation both touch the schema, and changing them after the migration exists costs more than settling them now.

---

## 17. Implementation status

All ten phases are implemented and committed. §43's 25-step Definition of Done:

| Steps     | What                                                          | Evidence                                                                                                                                                                                     |
| --------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–7       | Admin creates company/bus/driver/route/variant/stops/schedule | `companies`/`fleet`/`routes` e2e suites + a live Playwright run that created a route/variant/stop through the real admin UI                                                                  |
| 8–13      | Driver logs in, starts a trip, GPS reaches the backend        | Verified on a real emulator (Android SDK + AVD, not a simulated build): real login, a real `ACTIVE` trip row, a real GPS fix from FusedLocationProvider persisted server-side                |
| 14–18, 23 | Passenger sees the route, stops, and a moving bus             | `apps/web/e2e/passenger.spec.ts` — real Playwright browser + the real GPS simulator + a real WebSocket connection, no mocks                                                                  |
| 19–22     | Offline queueing and resync                                   | `LocationRepositoryTest` (write-before-send, batch retry-safety) + `locations.e2e-spec.ts`'s out-of-order-flush case. **Not** run as an airplane-mode cycle on a physical device — see below |
| 24–25     | Admin inspects active/completed trips                         | `trips.e2e-spec.ts` + the admin live/trip-detail views (Phase 5)                                                                                                                             |

**Test suites, all currently green:** 15 backend unit tests, 54 backend e2e/tenancy-conformance tests (CI-gated), 3 web unit tests, 2 Playwright browser e2e tests, 9 Android unit/instrumented tests (the instrumented one runs real Room/SQLite on-device, not a fake).

**Documented exception — Phase 7's exit criterion.** Phase 7 asks for offline hardening "verified on a physical device over a real drive." No physical Android device is reachable from the environment this project was built in. What _was_ done instead, on a real AVD emulator (not a headless unit test): installed the built debug APK, logged in as a seeded driver, watched the app auto-start a trip against the live API, confirmed the foreground tracking service running, fed it a real GPS fix via the emulator's mock-location channel, and confirmed that fix landed in Postgres — then ended the trip and confirmed the app returned to a live assignment list. That is the closest verification obtainable without hardware — not a substitute for a multi-hour real drive through actual dead zones, and not claimed as one. Closing this line for real needs a person with a phone, a SIM, and a bus route — tracked here rather than left unstated.
