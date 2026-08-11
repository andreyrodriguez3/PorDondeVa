# TuBus

Real-time bus tracking for transportation companies. A passenger opens a URL and watches their bus move along its route — no account, no app install, no page refresh.

> **Document status.** This README describes the project as it exists at MVP completion, as defined by [SPECS.md](SPECS.md) §43 and planned in [ROADMAP.md](ROADMAP.md). It is written in the present tense and is the reference for anyone setting up, running, or operating the system.

---

## What TuBus is

TuBus is a multi-tenant platform that lets a bus company put its live fleet on a public web page.

**For passengers** — open the company's URL on a phone, pick a route, and see the route line, its stops, and any buses currently running it. Markers move as new GPS fixes arrive. Each bus shows how fresh its position is, and where it is heading. No account, no cookies, no app.

**For drivers** — a deliberately minimal Android app. Log in, confirm the assigned bus and route, tap **Start trip**. The phone transmits its location in the background until the driver taps **End trip**. When there is no signal, positions are stored on the device and uploaded when connectivity returns.

**For companies** — a web dashboard to manage buses, drivers, routes, route variants, stops and schedules; watch the live fleet; inspect active and completed trips with full location playback; and generate printable QR codes that take a passenger straight to a live route map.

Each company is an isolated tenant with its own hostname — either a platform subdomain (`tuanrl.tubus.example`) or its own domain (`rutas.tuanrl.com`).

**Not in the MVP:** ETA prediction, ticketing, payments, passenger accounts or apps, iOS, hardware GPS trackers. See [SPECS.md](SPECS.md) §44.

---

## Architecture overview

One backend process, one web process, one database, one reverse proxy. A modular monolith, not microservices.

```
  Driver phone (Android)                        Passenger browser
        │                                        │            ▲
        │ HTTPS  POST batched GPS points         │ HTTPS      │ WebSocket
        │        (retry-safe, idempotent)        │ page load  │ bus:update
        ▼                                        ▼            │
  ┌───────────────────────── Caddy (TLS, host routing) ──────────────────────┐
  │   admin.tubus.example ─┐                                                 │
  │   *.tubus.example      ├─► web  :3000        /api/* , /socket.io/* ─► api│
  │   custom domains      ─┘                                                 │
  └──────────────────────────────────┬──────────────────────────────────────-┘
                                     │
        ┌────────────────────────────┴────────────────────────────┐
        │ api (NestJS)                                            │
        │   auth · tenancy · companies · users · drivers · buses  │
        │   routes · stops · schedules · trips · locations        │
        │   live (read model + Socket.IO gateway) · public · qr   │
        │   audit · maintenance (retention, stale-trip sweeper)   │
        └────────────────────────────┬────────────────────────────┘
                                     │ Prisma
                             ┌───────▼────────┐
                             │  PostgreSQL 16 │
                             └────────────────┘
```

Location data takes one path in and one path out:

```
GPS fix ─► device queue ─► REST batch ─► location_points (history)
                                     └─► trip_live_states (one row per active trip)
                                                │
                                                └─► WebSocket room ─► passenger maps
```

`trip_live_states` holds exactly one row per active trip. Passenger page loads read that row — historical location data is never scanned to draw a map.

### Stack

| Layer | Technology |
|---|---|
| Backend | TypeScript, Node.js, NestJS, Prisma |
| Database | PostgreSQL 16 (GeoJSON in `jsonb`; PostGIS not required) |
| Real-time | Socket.IO, in-process rooms |
| Web | Next.js (App Router), React, Tailwind, MapLibre GL JS |
| Driver app | Kotlin, Jetpack Compose, Hilt, Room, WorkManager |
| Proxy / TLS | Caddy (automatic HTTPS, on-demand certificates) |
| Local + production runtime | Docker Compose |

There is no Redis, no message broker, no object storage, no cloud-provider dependency. Production runs on a single VPS.

### Design decisions worth knowing up front

- **Freshness is measured by device time, not server time.** A bus that was offline for ten minutes and then uploads its backlog is not "live" — every one of those points reached the server just now, but the newest position they describe is ten minutes old. Status is derived from the newest `device_timestamp`, so it tells the truth in both directions.
- **The live position never moves backwards.** An offline upload contains older fixes than the current marker; the live-state write only advances when the incoming fix is newer.
- **Every point carries a client-generated UUID.** Uploads are idempotent, so a retry after a lost response changes nothing.
- **Markers interpolate between two known fixes, never past the last one.** Movement looks smooth without inventing a position the GPS never reported.
- **Connection status is computed, never stored.** A bus that stops transmitting stops writing rows; a stored status would stay `LIVE` forever.
- **The admin dashboard lives on one fixed hostname.** Company and custom domains serve the public passenger surface only, so authentication cookies are never set on a hostname a customer controls.

---

## Repository structure

```
tubus/
├── apps/
│   ├── api/                     NestJS backend
│   │   ├── prisma/              schema.prisma, migrations/, seed helpers
│   │   └── src/
│   │       ├── common/          config, prisma + tenancy guard, logging, http, zod
│   │       ├── auth/            login, refresh rotation, roles guard
│   │       ├── tenancy/         host → company resolution, company context
│   │       ├── companies/ users/ drivers/ buses/
│   │       ├── routes/ stops/ schedules/
│   │       ├── trips/ locations/ live/
│   │       ├── public/          unauthenticated passenger API (separate DTOs)
│   │       ├── qr/ audit/ maintenance/ health/
│   │       └── test/            integration + tenancy conformance suites
│   └── web/                     Next.js (passenger + admin)
│       ├── middleware.ts        host → surface routing
│       ├── app/
│       │   ├── (public)/        company landing, r/[slug] route page
│       │   └── (admin)/admin/   login, fleet, routes, live, trips, settings
│       ├── components/          map/, live/, admin/
│       └── lib/                 api client, useLiveBuses, liveStatus, copy
├── packages/
│   └── contracts/               Zod schemas + inferred types shared by api and web
├── tools/
│   ├── simulator/               GPS simulator CLI
│   └── seed/                    development data seeding
├── android/                     standalone Gradle project (driver app)
│   └── app/src/main/java/com/tubus/driver/
│       ├── data/{local,remote,secure,repo}/
│       ├── location/            LocationEngine, TrackingService
│       ├── sync/                SyncWorker, SyncScheduler
│       ├── ui/ system/ di/
├── docker/                      Dockerfiles, Caddyfile
├── docs/                        scaling.md, runbook.md, android-oem-setup.md
├── docker-compose.yml           local development
├── docker-compose.prod.yml      single-VPS production
├── .env.example
├── SPECS.md   ROADMAP.md   CODESTYLE.md   README.md
```

`packages/contracts` is the single source of truth for request and response shapes. The API validates against it, the web app infers its types from it, and the Android test suite checks its JSON fixtures against it — so a contract change breaks the build rather than production.

---

## Local development

### Requirements

Docker Desktop (or Docker Engine + Compose), Node.js 20+, pnpm 9+. For the driver app: Android Studio and JDK 17. No cloud account, no paid service, no API key is required to run the full system locally.

### First run

```bash
git clone <repo> tubus && cd tubus
cp .env.example .env
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
```

Then open:

| URL | What it is |
|---|---|
| `http://tuanrl.localhost:3000` | Passenger surface for the seeded company |
| `http://admin.localhost:3000` | Admin dashboard |
| `http://localhost:8080/healthz` | Backend liveness |

Seed credentials are printed by `pnpm db:seed` and are development-only.

`*.localhost` resolves to `127.0.0.1` natively in Chrome, Edge and Firefox. If your client does not do this, add entries to your hosts file — see `docs/runbook.md`.

### See a bus move

```bash
pnpm simulate --route sanjose-palmares --bus "Bus 24" --speed 60
```

Open the route page and the marker moves. The seed data creates the company, an admin, an operator, drivers, buses, the route *San José → Palmares* with two directional variants and real polyline geometry, five stops, and a weekday schedule — so steps 1–7 of the MVP acceptance scenario are already satisfied when you start.

---

## Running each component

### Backend (`apps/api`)

Runs in the `api` container with hot reload on port `8080`.

```bash
docker compose up -d api          # start
docker compose logs -f api        # follow logs
pnpm --filter api test            # unit + integration tests
pnpm --filter api test:tenancy    # cross-tenant conformance suite
```

Outside Docker: `pnpm --filter api dev` (requires `DATABASE_URL` pointing at the compose Postgres).

### Database

```bash
pnpm db:migrate                   # apply migrations (development)
pnpm db:migrate:create            # author a new migration
pnpm db:seed                      # reset and reseed development data
pnpm db:studio                    # Prisma Studio
pnpm db:reset                     # drop, recreate, migrate, seed
```

Migrations are versioned SQL under `apps/api/prisma/migrations`. Production applies them with `prisma migrate deploy`; `migrate dev` never runs against production.

### Web (`apps/web`)

Runs in the `web` container on port `3000`, serving both surfaces — which one you get depends on the hostname you request.

```bash
docker compose up -d web
pnpm --filter web test            # Vitest component tests
pnpm --filter web test:e2e        # Playwright smoke flows
pnpm --filter web build           # production build
```

### GPS simulator (`tools/simulator`)

Speaks the same API as the Android app, so it exercises the real pipeline end to end.

```bash
pnpm simulate --route sanjose-palmares --bus "Bus 24" \
              --speed 60 --interval 5 \
              --drop-network-after 60 --reconnect-after 120
```

| Flag | Meaning |
|---|---|
| `--route` | Route slug to follow |
| `--variant` | Variant to use (defaults to the route's default variant) |
| `--bus` | Bus label to run the trip on |
| `--speed` | km/h along the route geometry |
| `--interval` | Seconds between fixes |
| `--drop-network-after` | Simulate losing connectivity after N seconds (buffers locally) |
| `--reconnect-after` | Restore connectivity after N seconds and flush the buffer in order |

Run several instances concurrently to populate the admin live fleet map.

### Driver app (`android/`)

Open `android/` in Android Studio and run the `app` configuration, or:

```bash
cd android && ./gradlew installDebug
./gradlew test                    # unit tests
./gradlew connectedAndroidTest    # instrumented tests
```

Point the debug build at your machine's backend:

- **Physical device over USB** — `adb reverse tcp:8080 tcp:8080`, then use `http://localhost:8080`.
- **Emulator** — use `http://10.0.2.2:8080`.

Cleartext HTTP is permitted only for `localhost` and `10.0.2.2`, and only in the debug build. Release builds require HTTPS.

### Everything at once

```bash
docker compose up -d              # postgres + api + web
docker compose down               # stop
docker compose down -v            # stop and delete the database volume
```

Caddy is not part of the local compose file; TLS and host-based routing are only needed in production, and leaving it out keeps local startup fast.

---

## How the driver app talks to the backend

The driver app uploads over plain authenticated REST. It does not hold a WebSocket open — REST requests are trivially retryable, survive process death, and work with Android's job scheduler.

### Authentication

Login returns a short-lived access token and a long-lived rotating refresh token, both stored in `EncryptedSharedPreferences`. An OkHttp `Authenticator` transparently refreshes on `401` and replays the request. Refresh tokens rotate on every use; presenting a previously used token revokes the entire token family, so a stolen token is detectable.

### Trip lifecycle

```
POST /api/v1/auth/login                        → tokens
GET  /api/v1/driver/assignment                 → assigned bus + selectable routes
POST /api/v1/driver/trips                      → trip created, status ACTIVE
POST /api/v1/driver/trips/:id/locations        → repeatedly, while the trip runs
POST /api/v1/driver/trips/:id/end              → status COMPLETED
```

`GET /api/v1/driver/trips/active` lets the app recover an in-progress trip after a crash or restart, so a trip is never orphaned by the client.

A driver's default bus is pre-selected, and the database enforces at most one active trip per bus and at most one per driver through partial unique indexes — not by convention.

### Location upload

```jsonc
POST /api/v1/driver/trips/{tripId}/locations
{
  "points": [
    {
      "clientPointId": "3f1c…",       // generated on the device
      "lat": 9.9333, "lng": -84.0833,
      "accuracyM": 8.4, "speedMps": 16.2, "bearingDeg": 271.0,
      "deviceTimestamp": "2026-08-10T14:02:11.482Z"
    }
  ]
}
```

The same endpoint serves both the live case (one or two points) and an offline flush (up to 200 points per request, in chronological order). The response reports each point as accepted, duplicate, or rejected, so the app only deletes what the server confirmed.

**Idempotency.** `clientPointId` is unique per trip in the database, and inserts use `ON CONFLICT DO NOTHING`. Re-sending a batch after a lost response is a no-op.

**Untrusted device clocks.** Fixes dated more than a minute in the future, more than five minutes before the trip started, or more than 24 hours old are rejected. Rejections are counted per trip, logged, and visible to operators in the trip detail view — never silently discarded.

### Offline behavior

GPS acquisition and network transport are independent concerns.

```
LocationEngine ──► Room queue ──► SyncWorker ──► API ──► ack ──► row deleted
   (always)         (durable)     (when online)
```

Every fix is written to the local database *before* any upload is attempted, so nothing is lost to a dropped request or a killed process. `SyncWorker` (WorkManager, network-constrained, exponential backoff from 10 s) drains the queue in chronological batches. The queue is capped at roughly 40 hours of tracking with oldest-first eviction and a logged warning. Device timestamps are preserved verbatim; the server records its own receipt time separately.

The home screen always shows GPS state, connectivity, queue depth, and time of last successful sync, so a driver can see that tracking is working even with no signal.

### Background tracking

Tapping **Start trip** starts a foreground service of type `location` with a persistent notification, so tracking continues while the driver uses other apps or the screen is off. Positions are requested at roughly 5-second intervals with a 10-metre displacement filter, which stops the app from burning battery and data while parked at a stop.

The app does **not** request `ACCESS_BACKGROUND_LOCATION`; a foreground service started from a visible screen covers this use case, which also keeps the app out of Play Store's sensitive-permission review.

Android does not permit starting a location foreground service after a reboot. If the device restarts mid-trip, the app posts a high-priority notification asking the driver to reopen it and resume — it does not pretend to recover silently. Drivers are prompted once to exempt the app from battery optimization, and `docs/android-oem-setup.md` covers manufacturers that kill background services aggressively.

---

## How passenger live tracking works

### Loading a route page

`GET https://tuanrl.tubus.example/r/san-jose-palmares`

The server resolves the company from the hostname and renders the page with the route name, stops, geometry, schedule, and a snapshot of currently active buses **already in the HTML**. The passenger sees their route before any JavaScript runs. The map and the live connection hydrate afterwards.

### Receiving updates

The browser opens a WebSocket to `/live` and subscribes to the route. The server derives the company from the socket's `Host` header — never from anything the client sends — and joins the socket to rooms scoped per route variant:

```
company:{companyId}:variant:{routeVariantId}
```

When the backend accepts a location batch, it advances the trip's live-state row and emits a `bus:update` to that room only. A passenger receives updates for the route they are looking at, and for nothing else. When a trip ends, a `bus:ended` event removes the marker deliberately rather than letting it linger until a timeout.

The public payload contains only what is safe to publish:

```jsonc
{ "tripId": "…", "busLabel": "Bus 24", "headsign": "Hacia Palmares",
  "lat": 9.9333, "lng": -84.0833, "bearingDeg": 271, "speedMps": 16.2,
  "accuracyM": 8.4, "deviceTimestamp": "2026-08-10T14:02:11.482Z" }
```

Driver names, phone numbers, licence plates and internal identifiers are never sent to the public surface — the public API has its own controllers and its own DTOs, so there is no serializer that could leak them by accident.

### Movement and honesty

A newly received position is animated from the marker's current position over the observed update interval, so movement reads as smooth rather than as a jump every few seconds. The animation only ever runs *between two positions the bus actually reported* — the marker is never extrapolated ahead of the last known fix. When accuracy is poor, an uncertainty circle is drawn instead of implying precision the GPS did not provide.

### Freshness

Every bus displays a state derived from the age of its newest device-reported fix, using per-company thresholds:

| State | Default threshold | What the passenger sees |
|---|---|---|
| `LIVE` | ≤ 30 s | "En vivo · actualizado hace 4 segundos" |
| `STALE` | 30 s – 3 min | "Actualizado hace 2 minutos" — marker stops animating |
| `OFFLINE` | > 3 min | "Sin señal desde hace 5 minutos" — marker dimmed, still visible |
| `COMPLETED` | — | Removed, after the trip ends |

A bus that loses signal never simply vanishes. If it reconnects and uploads its backlog, the newest fix it carries is recent, so it correctly returns to `LIVE` — and the intervening positions are added to the trip's history without dragging the visible marker backwards.

### Connection resilience

The client reconnects automatically. On reconnect it refetches the REST snapshot *before* resuming the stream, so positions missed during the gap cannot leave a stale marker on screen. If the WebSocket cannot be established at all, the page falls back to polling `GET /api/v1/public/routes/:slug/live` every ten seconds. The passenger is told when the connection is degraded rather than being shown silently frozen data.

No account, no cookies, no tracking, no consent banner.

---

## How multi-tenancy works

One application, one database, logical isolation. Every company-owned row carries a `company_id`.

### Resolving the tenant

The incoming `Host` header identifies the company on every request:

```
tuanrl.tubus.example   → platform subdomain, matched by slug
rutas.tuanrl.com       → custom domain, exact match in company_domains
admin.tubus.example    → the platform admin surface (no tenant in the host)
```

Host resolution runs as middleware before any controller. An unknown hostname yields a 404 page — never a default tenant. The proxy is trusted for exactly one hop when reading forwarded host headers.

On the admin host the tenant comes from the authenticated session instead, and administrators only ever see their own company's data.

### Enforcing isolation

Three layers, all server-side:

1. **Explicit scoping.** Every service method that touches a tenant entity takes `companyId` as an argument. No repository reads it from ambient state, so a missing scope is visible when reading the code.
2. **A fail-closed database guard.** A Prisma client extension intercepts queries against tenant-scoped models and *throws* if no `companyId` constraint is present. It deliberately does not inject one silently — silent injection hides mistakes, throwing surfaces them in development and in CI.
3. **A conformance test suite.** Every tenant-scoped endpoint is tested against another company's token, no token, and an insufficient role. Cross-tenant access must return **404**, not 403, so the API never confirms that another company's resource exists. This suite is a required CI gate; adding an endpoint without covering it fails the build.

Public passenger endpoints are scoped by the resolved host and read from a separate set of controllers and DTOs. WebSocket rooms are keyed by company and route variant, and room membership is decided by the server from the socket's host — a client cannot subscribe its way into another company's data.

### Roles

| Role | Scope |
|---|---|
| `SUPER_ADMIN` | Platform-level. Creates and suspends companies, manages domains. Cannot read tenant operational data. |
| `COMPANY_ADMIN` | Full control of one company, including users and roles. |
| `OPERATOR` | Read-only on configuration; can watch the live fleet and end or cancel trips. |
| `DRIVER` | Own trips only: start, submit locations, end, report an incident. |

Passwords are hashed with argon2id. Authentication endpoints are rate-limited per IP and per account. All administrative mutations are written to an audit log with actor, entity, and source address.

---

## How custom domains work

A company can serve TuBus from its own hostname without a separate deployment, a separate configuration file, or a certificate purchase.

### Setup

1. The company points its hostname at the TuBus server with an `A` or `CNAME` record — for example `rutas.tuanrl.com`.
2. An administrator adds the hostname in **Settings → Domains**; it is stored in `company_domains` and marked verified once the DNS record resolves to the platform.
3. On the first HTTPS request to that hostname, Caddy asks the backend whether the name is known:

```
GET /api/v1/public/domains/allowed?domain=rutas.tuanrl.com  →  200 or 404
```

Only hostnames present and verified in `company_domains` get a `200`. Caddy then obtains a Let's Encrypt certificate on demand and serves the company's passenger surface. Nothing needs to be restarted, and no certificate is ever issued for a hostname the platform does not recognise.

The same mechanism covers `*.tubus.example` subdomains, so the platform needs **no wildcard certificate and no DNS provider API credentials** — there is no DNS automation to build or to break.

### Rules

- Custom domains and company subdomains serve the **public passenger surface only**. The admin dashboard is always on `admin.tubus.example`, so session cookies are never placed on a hostname a customer controls — if a customer repoints their DNS, no credential is exposed.
- Hostnames are globally unique across the platform.
- Each company has one primary hostname used to build QR codes and shareable links; additional hostnames continue to work.
- Removing a hostname stops it resolving to the company immediately.

---

## Configuration

All configuration is by environment variable; `.env.example` documents every one. The backend refuses to start with a clear error if a required variable is missing — there are no silent defaults for secrets.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Token signing |
| `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL` | Token lifetimes |
| `PLATFORM_DOMAIN` | Base domain for company subdomains |
| `ADMIN_HOST` | Hostname serving the admin dashboard |
| `PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` | Browser-facing endpoints |
| `NEXT_PUBLIC_MAP_STYLE_URL` | MapLibre style — the tile provider is swappable |
| `LOCATION_RETENTION_DAYS` | Raw GPS retention (default 90) |
| `TRIP_AUTO_END_MINUTES` | Auto-complete a silent trip (default 90) |
| `RATE_LIMIT_*`, `LOG_LEVEL` | Throttling and logging |

No secret is ever committed. Per-company operational settings — live and stale thresholds, branding, timezone — live in the database and are editable from the dashboard.

### Housekeeping

Scheduled jobs inside the backend keep the system bounded: raw location points older than the retention window are deleted nightly in batches; trips left active with no incoming positions are auto-completed after the configured timeout; expired refresh tokens are purged.

---

## Testing

```bash
pnpm test                         # everything (api + web)
pnpm --filter api test            # unit + integration against a real Postgres
pnpm --filter api test:tenancy    # cross-tenant isolation conformance
pnpm --filter api test:e2e        # simulator → API → DB → WebSocket → client
pnpm --filter web test            # component tests
pnpm --filter web test:e2e        # Playwright smoke flows
cd android && ./gradlew test connectedAndroidTest
```

The pipeline test drives the simulator programmatically and asserts that points persist, live state advances, WebSocket events arrive, a replayed batch changes nothing, and an out-of-order offline flush does not move the marker backwards. `docs/runbook.md` also carries the manual checklist that automation cannot cover: a real drive, a tunnel, airplane mode mid-trip, a reboot mid-trip, and battery drain across a full shift.

CI runs lint, typecheck, tests, and the tenancy conformance suite on every push.

---

## Deployment

The MVP runs on a single VPS (2 vCPU / 4 GB is comfortable for dozens of tracked buses).

```
Internet ─► Caddy ─┬─► web  (Next.js standalone)
                   └─► api  (NestJS) ─► PostgreSQL
                       all in Docker Compose, containers run as non-root
```

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Migrations run as a gated one-shot step before the API starts. Deploys cause roughly 20–30 seconds of downtime; drivers' queued positions survive it, so no location data is lost. Nightly `pg_dump` backups rotate locally and are copied offsite, and the restore procedure is documented and rehearsed in `docs/runbook.md`.

The architecture is portable — nothing depends on a specific hosting provider. `docs/scaling.md` records the next steps if load ever demands them (a Socket.IO Redis adapter for multiple backend processes, partitioning `location_points`, adding PostGIS for map matching and ETA). None of that is built, and none of it is needed at MVP scale.

---

## Conventions

Code follows [CODESTYLE.md](CODESTYLE.md). Commits follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`), enforced by a commit hook.

Product and user-facing copy is Spanish (es-CR); code, comments, and documentation are English. All passenger and driver strings live in one dictionary module, so translation later is a single file rather than a refactor.

---

## Further reading

- [SPECS.md](SPECS.md) — product and technical specification
- [ROADMAP.md](ROADMAP.md) — implementation plan, architectural decisions, and the reasoning behind them
- [CODESTYLE.md](CODESTYLE.md) — code conventions
- `docs/runbook.md` — operations, backups, restore, manual test plan
- `docs/scaling.md` — deferred scaling paths
- `docs/android-oem-setup.md` — per-manufacturer background-execution setup for drivers
