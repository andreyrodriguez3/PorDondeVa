# TuBus — Product & Technical Specification

## 1. Product Overview

TuBus is a multi-tenant real-time bus tracking platform for public and private bus transportation companies.

The platform allows transportation companies to provide passengers with a web-based interface where they can see active buses moving along their predefined routes in near real time.

The driver uses an Android application that runs primarily in the background and shares the device's GPS location while a trip is active.

Passengers do not need an account or mobile application.

Companies manage their buses, drivers, routes, stops, schedules, active trips, and tracking information through an administrative web dashboard.

The platform must support both:

1. A platform-provided subdomain for companies.
2. Custom domains or subdomains belonging to transportation companies.

Example:

```text
company.tubus.example
```

or:

```text
rutas.tuanrl.com
```

The platform must be multi-tenant from the beginning.

---

# 2. Product Goals

## Primary goal

Allow a passenger to quickly answer:

> "Where is my bus right now?"

The passenger should be able to:

- open a URL;
- select a route if necessary;
- see the route on a map;
- see active buses moving along that route;
- see the predefined stops;
- see when the bus was last updated;
- understand the direction of travel.

The experience must be fast, intuitive, mobile-friendly, and require no account or application installation.

## Secondary goals

Provide transportation companies with:

- real-time fleet visibility;
- trip history;
- driver and vehicle management;
- route management;
- stop management;
- schedule management;
- connection status;
- operational information;
- public passenger-facing tracking;
- QR codes for routes/stops.

## Explicit non-goals for the MVP

The MVP will NOT initially include:

- passenger mobile applications;
- iOS driver application;
- payments;
- ticketing;
- advertising;
- nationwide route data;
- automatic route discovery;
- advanced traffic prediction;
- advanced ETA algorithms;
- AI features;
- hardware GPS devices;
- complex billing/subscription tiers;
- microservice architecture;
- Kubernetes;
- cloud-specific infrastructure.

The architecture should allow these features to be added later without requiring a complete rewrite.

---

# 3. Core Product Model

The system follows this hierarchy:

```text
Platform
└── Company
    ├── Admin Users
    ├── Drivers
    ├── Buses
    ├── Routes
    │   ├── Route Variants
    │   │   ├── Stops
    │   │   └── Geometry
    │   └── Schedules
    └── Trips
        └── Location Points
```

## Company

A transportation company using the platform.

Examples:

```text
Tuan RL
Company B
Company C
```

Each company is isolated from every other company.

Users from Company A must never be able to access Company B's operational data.

---

# 4. Multi-Tenancy

The application must use a shared application and shared database with logical tenant isolation.

Every company-owned database entity must contain a `company_id`.

The backend must enforce tenant isolation server-side.

Never rely solely on frontend filtering to prevent cross-company access.

## Company URL

Every company receives a platform-generated hostname:

```text
{company-slug}.{platform-domain}
```

Example:

```text
tuanrl.tubus.example
```

The exact production platform domain will be configured later.

## Custom domains

Companies may optionally configure their own domain or subdomain.

Example:

```text
rutas.tuanrl.com
rastreo.example.com
```

The application determines the company from the incoming hostname.

The custom-domain system must support HTTPS.

The MVP should provide the configuration model and application support for custom hostnames, but automated DNS management is not required initially.

---

# 5. Passenger Experience

The passenger-facing interface is the primary user experience of the product.

It must be responsive and optimized primarily for mobile devices.

No passenger account is required.

No passenger app is required.

## Company landing page

When a passenger visits a company domain:

```text
tuanrl.tubus.example
```

they should see:

- company name;
- company branding/logo if configured;
- available routes;
- active routes/trips;
- clear navigation.

Example:

```text
Tuan RL

Routes

San José → Palmares
San José → Grecia
San José → San Ramón
```

## Route page

A route page must display:

- route name;
- origin;
- destination;
- route map;
- predefined stops;
- active buses;
- bus direction;
- last update time;
- relevant schedule information.

Example:

```text
San José → Palmares

[ MAP ]

Bus 24
Moving toward Palmares
Updated 4 seconds ago

Stops:
San José
Alajuela
Grecia
Naranjo
Palmares
```

## Live bus visualization

The bus must be displayed as a moving marker on the route.

The UI should update automatically without requiring a page refresh.

The system should interpolate movement between received GPS updates when appropriate to prevent visually jerky movement.

The displayed position should never be presented as more accurate than the underlying GPS data.

## Connection status

The passenger should be able to distinguish between:

- live;
- recently updated;
- stale;
- unavailable.

Example:

```text
Live
Updated 4 seconds ago
```

or:

```text
Last updated 1 minute ago
```

If a bus has not transmitted for a configurable threshold, it should be marked stale.

The bus should not simply disappear without explanation.

---

# 6. Driver Application

The driver application should be intentionally minimal.

Drivers already know their routes and do not need navigation.

The application exists primarily to transmit location.

## Driver workflow

```text
Login
  ↓
Assigned bus
  ↓
Assigned route/trip
  ↓
Start trip
  ↓
Application tracks location in background
  ↓
End trip
```

The driver should perform as few interactions as possible.

## Driver application features

Required:

- authentication;
- assigned bus display;
- current route/trip display;
- start trip;
- end trip;
- GPS status;
- connectivity status;
- tracking status;
- background location tracking;
- offline location storage;
- automatic synchronization after connectivity returns.

Optional MVP feature:

- report operational issue.

Possible issue categories:

```text
Vehicle problem
Traffic/incident
Changed vehicle
Other
```

The application must not require continuous driver interaction.

---

# 7. Android Background Tracking

The Android application must use Android's appropriate foreground/background location mechanisms.

The implementation must correctly handle:

- runtime location permissions;
- background location requirements;
- foreground service requirements;
- battery optimization;
- application lifecycle;
- network loss;
- GPS disabled;
- device restart where technically appropriate.

The application must not assume that a normal background process can run indefinitely.

Location tracking must continue while the driver is using another application, provided the trip is active and the required Android permissions are granted.

The app must clearly indicate when tracking is active.

---

# 8. Location Collection

The Android device is the location source for the MVP.

A dedicated GPS device is not required.

The application should collect, where available:

```text
latitude
longitude
accuracy
speed
bearing
timestamp
```

The exact Android location provider implementation is left to the development phase.

The system should prioritize reliable location information while avoiding unnecessary battery consumption.

Initial target:

- approximately one location update every 5–10 seconds while actively moving.

The implementation may dynamically adjust collection frequency when appropriate.

The server must not assume that updates arrive at perfectly regular intervals.

---

# 9. Offline Tracking

Internet connectivity is not guaranteed.

GPS location acquisition and Internet connectivity must be treated as separate concerns.

When Internet connectivity is unavailable:

```text
GPS
 ↓
Local queue
```

Location points must be stored locally on the Android device.

When connectivity returns:

```text
Local queue
 ↓
Server synchronization
```

The synchronization mechanism must:

- preserve timestamps;
- avoid duplicate points;
- retry failed transmissions;
- tolerate temporary connectivity failures;
- maintain correct chronological order.

The passenger-facing system should show the last server-confirmed position and its age.

It must never pretend that an old location is current.

---

# 10. Real-Time Communication

The platform must support near-real-time updates.

Recommended architecture:

```text
Android
   ↓
REST API
   ↓
Backend
   ↓
WebSocket
   ↓
Passenger browsers
```

The Android client sends location updates through an authenticated API.

The backend broadcasts relevant updates to connected passenger clients.

Passengers should not need to repeatedly refresh or poll aggressively.

WebSockets should be used for live updates.

A fallback polling mechanism may be implemented if necessary.

---

# 11. Route Model

A route represents a transportation service between an origin and destination.

Example:

```text
San José → Palmares
```

A route may have multiple variants.

Example:

```text
San José → Palmares

Variant A:
San José → Alajuela → Grecia → Naranjo → Palmares

Variant B:
San José → Alajuela → Atenas → Palmares
```

This avoids assuming that a route has exactly one physical path.

## Route data

A route should contain:

- company;
- name;
- origin;
- destination;
- status;
- variants;
- schedules.

---

# 12. Route Geometry

Each route variant should have geographic geometry representing the expected physical path.

The geometry should be stored in a standard geographic format such as GeoJSON or an equivalent database representation.

The geometry is used for:

- drawing the route;
- displaying it to passengers;
- determining where the bus is relative to the route;
- future map matching;
- future ETA calculations.

The MVP does not need sophisticated map matching, but the data model must support it.

---

# 13. Stops

Stops belong to route variants.

A stop should contain:

```text
id
company_id
route_variant_id
name
latitude
longitude
sequence
```

Optional future fields:

```text
description
address
accessibility information
shelter information
```

Stops must have an explicit sequence within the route.

Example:

```text
1. San José
2. Alajuela
3. Grecia
4. Naranjo
5. Palmares
```

A stop may exist in multiple route variants.

---

# 14. Schedules

Schedules belong to the company and route/route variant as appropriate.

The platform does not need nationwide Costa Rican schedule data.

Companies are responsible for providing and maintaining the schedules for the routes they use with the platform.

The administrative panel must allow authorized company users to:

- create schedules;
- edit schedules;
- delete schedules;
- activate/deactivate schedules.

The system should support multiple departures per route per day.

The initial schedule model should support days of the week.

Example:

```text
Monday:
06:00
07:00
08:00

Tuesday:
06:00
07:00
08:00
```

Holiday and special-calendar handling is not required for the first MVP.

---

# 15. Buses

A bus belongs to a company.

A bus should contain:

```text
id
company_id
identifier
license_plate
status
```

Optional future fields:

```text
model
manufacturer
year
capacity
```

Possible statuses:

```text
ACTIVE
INACTIVE
MAINTENANCE
RETIRED
```

The identifier is what passengers and company employees see.

Example:

```text
Bus 24
Bus 105
Unit 32
```

---

# 16. Drivers

A driver belongs to a company.

A driver account should contain:

```text
id
company_id
name
phone
status
authentication credentials
```

The driver must be assigned to an appropriate bus/trip.

The system should avoid requiring drivers to manually select arbitrary buses if the company has configured an assignment.

---

# 17. Trips

A trip represents one actual execution of a scheduled route.

Example:

```text
Bus 24
San José → Palmares
Scheduled departure: 06:00
Actual start: 06:04
Status: ACTIVE
```

Trip statuses:

```text
SCHEDULED
ACTIVE
COMPLETED
CANCELLED
```

A trip connects:

```text
Company
Driver
Bus
Route
Route Variant
Schedule
Location Points
```

Trips are the primary operational unit for live tracking.

---

# 18. Location Points

Each received GPS point should contain:

```text
id
trip_id
latitude
longitude
accuracy
speed
bearing
device_timestamp
server_timestamp
```

The system must distinguish between:

- time the phone measured the location;
- time the server received it.

This is important for offline synchronization.

Location points should be indexed efficiently by trip and timestamp.

---

# 19. Live Bus State

The system should maintain a lightweight representation of each active bus/trip's current state.

Example:

```text
trip_id
latest_latitude
latest_longitude
latest_accuracy
latest_speed
latest_bearing
latest_device_timestamp
latest_server_timestamp
connection_status
```

This state should be optimized for fast passenger queries.

Historical location data should not need to be scanned every time a passenger opens a map.

---

# 20. Bus Status

A bus/trip should have a derived live state.

Suggested states:

```text
LIVE
STALE
OFFLINE
COMPLETED
```

Suggested initial thresholds:

```text
LIVE:
last update <= 30 seconds

STALE:
> 30 seconds and <= 3 minutes

OFFLINE:
> 3 minutes
```

These values must be configurable.

The passenger UI should communicate the state clearly.

---

# 21. GPS Accuracy

The system must retain the device-provided GPS accuracy.

If the phone reports poor accuracy, the frontend may visually represent the uncertainty.

The system should not falsely imply perfect precision.

The primary goal is practical passenger usefulness:

> The passenger should be able to watch the bus move along the route and understand its current approximate physical position.

Sub-meter precision is not required.

---

# 22. ETA

Advanced ETA is explicitly outside the initial MVP.

However, the architecture must allow ETA to be added later.

Future ETA calculation may use:

- current bus position;
- route geometry;
- current speed;
- historical segment travel times;
- traffic information;
- stop dwell times;
- time of day;
- day of week.

The MVP must not make unsupported promises about arrival time.

---

# 23. Passenger Interface Requirements

The passenger UI should prioritize:

1. speed;
2. simplicity;
3. readability;
4. mobile usability;
5. live updates.

The passenger should be able to reach a live route map in as few interactions as possible.

No authentication.

No account creation.

No mandatory cookies or personalization.

No app installation.

## QR support

The system should generate QR codes for:

- company pages;
- routes;
- optionally individual stops.

Example:

```text
QR
 ↓
Company route
 ↓
Live map
```

Future stop-specific behavior:

```text
QR at Grecia stop
 ↓
San José → Palmares
 ↓
Grecia
 ↓
Next active buses
```

---

# 24. Administrative Dashboard

The administrative dashboard should be complete in functionality.

The MVP will not artificially restrict features into pricing tiers.

The dashboard must support:

## Company

- company profile;
- logo;
- branding;
- public URL;
- custom domain configuration.

## Users

- create users;
- remove users;
- assign roles;
- manage access.

Initial roles:

```text
SUPER_ADMIN
COMPANY_ADMIN
OPERATOR
DRIVER
```

The exact permission matrix should be implemented clearly.

## Buses

- create;
- edit;
- deactivate;
- assign;
- inspect status.

## Drivers

- create;
- edit;
- deactivate;
- assign.

## Routes

- create;
- edit;
- deactivate;
- configure origin/destination;
- configure variants.

## Stops

- create;
- edit;
- reorder;
- delete;
- configure coordinates.

## Schedules

- create;
- edit;
- deactivate;
- assign to routes/variants.

## Live operations

- live fleet map;
- active trips;
- stale/offline buses;
- current driver;
- current route;
- last update.

## Trip history

- search trips;
- inspect trip details;
- view historical route;
- view location history;
- view start/end times.

## QR codes

- generate route QR;
- download/print QR.

---

# 25. Authentication

Administrative and driver interfaces require authentication.

Passenger interfaces do not.

Authentication must be implemented server-side.

Passwords must never be stored in plaintext.

Sessions/tokens must be handled securely.

The exact authentication mechanism may be selected during implementation based on the chosen backend framework.

---

# 26. Security

Required:

- HTTPS in production;
- authenticated APIs for driver location submission;
- server-side authorization;
- tenant isolation;
- input validation;
- rate limiting on appropriate public/authentication endpoints;
- secure password storage;
- no secrets committed to source control;
- environment variables for secrets;
- basic audit logging for administrative actions.

The driver location endpoint must not be publicly writable.

A malicious user must not be able to submit arbitrary locations for another company's buses.

---

# 27. Technology Stack

The MVP should use a simple, conventional stack.

## Backend

Recommended:

```text
TypeScript
Node.js
NestJS
```

NestJS is preferred because the project has clear modules such as:

```text
auth
companies
users
drivers
buses
routes
stops
schedules
trips
locations
live-tracking
```

The backend should remain a modular monolith.

Do not create microservices.

## Database

```text
PostgreSQL
```

Use a relational schema.

PostGIS may be introduced if it materially simplifies geographic operations, but it is not mandatory for the first tracking prototype.

## Web

Recommended:

```text
Next.js
TypeScript
```

The passenger application and administrative dashboard may exist in the same web application while maintaining clear route separation.

## Mapping

Use:

```text
MapLibre GL JS
```

or an equivalent open mapping library.

The implementation must avoid unnecessary coupling to a single commercial map provider.

The exact tile provider should be configurable.

## Android

Recommended:

```text
Kotlin
Jetpack Compose
```

The driver application should be a native Android application.

## Local infrastructure

Use:

```text
Docker Compose
```

with at minimum:

```text
backend
postgres
web
```

The Android application communicates with the locally running backend during development.

---

# 28. Local Development

The entire MVP must be runnable on a developer's computer.

Target:

```text
docker compose up
```

should start the required server-side services.

The developer should be able to:

1. start the backend;
2. start PostgreSQL;
3. start the web application;
4. run the Android application;
5. create a development company;
6. create a route;
7. create stops;
8. create a bus;
9. create a driver;
10. start a trip;
11. see the phone's location appear on the web map.

No AWS account should be required for local development.

No paid third-party infrastructure should be required for the core MVP.

---

# 29. Development Mode / GPS Simulator

A GPS simulator should be included in the MVP development environment.

This is important because development must not depend on physically driving a bus.

The simulator should be capable of:

- loading a route;
- generating a simulated bus position;
- moving along route geometry;
- configurable speed;
- configurable update interval;
- simulated Internet disconnection;
- reconnecting and replaying queued locations.

This allows the complete pipeline to be tested:

```text
Simulator
    ↓
API
    ↓
Backend
    ↓
Database
    ↓
WebSocket
    ↓
Passenger Web App
```

before real Android GPS is introduced.

---

# 30. API Architecture

The backend should expose a versioned API.

Example:

```text
/api/v1/auth
/api/v1/companies
/api/v1/buses
/api/v1/drivers
/api/v1/routes
/api/v1/stops
/api/v1/schedules
/api/v1/trips
/api/v1/locations
```

The exact endpoint structure may be refined during implementation.

Driver location ingestion must have a dedicated authenticated endpoint.

Passenger endpoints should expose only information that is safe to make public.

---

# 31. Real-Time Channels

WebSocket channels should be scoped appropriately.

Example conceptual channel:

```text
company:{companyId}:route:{routeId}
```

A passenger viewing a route should only receive updates relevant to that route/company.

The server must not broadcast private company information to public clients.

---

# 32. Data Retention

The MVP should preserve enough historical data to support trip history and debugging.

Initial retention can be configurable.

The system should not retain unlimited high-frequency GPS data indefinitely.

Historical data retention and aggregation can be improved later.

---

# 33. Performance Targets

The MVP should target:

- passenger page initial load under a few seconds on a normal mobile connection;
- live location updates typically visible within several seconds of server receipt;
- no full-page refresh for location updates;
- efficient database queries for active buses;
- support for at least dozens of simultaneously tracked buses without architectural changes.

The system should be designed so that hundreds of buses can eventually be supported by scaling infrastructure vertically before requiring major architectural changes.

---

# 34. Error Handling

Errors must be explicit and actionable.

Examples:

Driver:

```text
Location permission disabled.
Enable location access to start tracking.
```

```text
Internet connection unavailable.
Tracking will continue locally and synchronize when connection returns.
```

Passenger:

```text
This bus has not reported its location recently.
```

Admin:

```text
Bus 24 has not transmitted for 4 minutes.
```

Do not silently swallow errors.

---

# 35. Observability

The backend should have structured logs.

Important events include:

- authentication failures;
- trip started;
- trip ended;
- location received;
- synchronization completed;
- synchronization failure;
- WebSocket connection;
- administrative changes;
- application errors.

The MVP does not require a full observability platform.

Console/file structured logging is sufficient initially.

---

# 36. Testing

Required automated testing should cover at minimum:

## Backend

- authentication;
- tenant isolation;
- company access control;
- trip creation;
- location ingestion;
- duplicate location handling;
- offline synchronization;
- active bus retrieval;
- route/stops retrieval.

## Frontend

Basic tests for:

- route loading;
- active bus rendering;
- stale bus status;
- live update handling.

## Android

Test:

- permission handling;
- starting tracking;
- stopping tracking;
- background tracking;
- local queue;
- synchronization.

Integration testing should verify:

```text
location source
→ API
→ database
→ WebSocket
→ passenger map
```

---

# 37. Code Quality

The project must follow the rules defined in `CODESTYLE.md`.

General principles:

- production-quality code;
- simple architecture;
- meaningful names;
- small cohesive modules;
- minimal duplication;
- minimal dependencies;
- no premature abstraction;
- no unnecessary comments;
- comments explain why, not what;
- consistent formatting;
- explicit error handling;
- no secrets in source code.

Production-ready code does not mean production-scale infrastructure.

The MVP should remain intentionally simple.

---

# 38. Git

Use Git from the beginning.

Use conventional commits:

```text
feat: add trip tracking
fix: handle offline location sync
refactor: simplify route service
test: add location ingestion tests
docs: update local development setup
chore: update dependencies
```

Commit every significant checkpoint.

Do not create meaningless commits for every small edit.

---

# 39. Environment Configuration

Use environment variables for:

- database URL;
- API URL;
- JWT/session secrets;
- map configuration;
- WebSocket configuration;
- production domains;
- external service credentials.

Provide:

```text
.env.example
```

Never commit real credentials.

---

# 40. Deployment Strategy

The MVP must be designed to run on a single VPS.

Initial production architecture:

```text
Internet
   ↓
Reverse Proxy
   ↓
Docker Compose
   ├── Web
   ├── Backend
   └── PostgreSQL
```

A single VPS is sufficient for initial deployment.

AWS is explicitly not required for the MVP.

The architecture should remain portable so the application can later move to AWS, another cloud provider, or managed infrastructure.

---

# 41. Domain Strategy

The application must identify the company based on the incoming hostname.

Examples:

```text
tuanrl.tubus.example
```

or:

```text
rutas.tuanrl.com
```

The backend/web application resolves:

```text
hostname → company
```

The company should not need a separate deployment.

The platform should support wildcard subdomains where appropriate.

Custom domain support must be architecturally possible without duplicating applications.

---

# 42. Branding

Each company may configure:

- company name;
- logo;
- primary branding information;
- public domain;
- route information.

The passenger interface should visually communicate the transportation company's identity.

The platform's own branding may be present where appropriate, but should not interfere with the company's passenger experience.

---

# 43. MVP Definition of Done

The MVP is considered functional when the following scenario works end-to-end:

1. An administrator creates a company.
2. The administrator creates a bus.
3. The administrator creates a driver.
4. The administrator creates a route.
5. The administrator creates a route variant.
6. The administrator creates stops.
7. The administrator creates a schedule.
8. The driver logs into the Android app.
9. The driver starts a trip.
10. The phone obtains GPS coordinates.
11. Coordinates are sent to the backend.
12. The backend stores the trip/location data.
13. The backend broadcasts the live position.
14. A passenger opens the company's public URL.
15. The passenger selects the route.
16. The passenger sees the route and stops.
17. The passenger sees the bus on the map.
18. The bus moves on the map as new positions arrive.
19. Internet connectivity is interrupted on the phone.
20. The phone continues recording locations locally.
21. Internet connectivity returns.
22. Queued locations synchronize.
23. The passenger sees the bus continue updating.
24. The administrator can inspect the active trip.
25. The administrator can inspect the completed trip afterward.

This is the first major product milestone.

---

# 44. Future Features

These should not be implemented until the MVP is working.

Potential future features:

- advanced ETA;
- historical travel-time analysis;
- traffic integration;
- passenger notifications;
- "bus arriving" alerts;
- favorite routes;
- passenger mobile applications;
- iOS driver application;
- PWA installation;
- fleet analytics;
- maintenance management;
- automatic schedule adherence analysis;
- geofencing;
- route deviation detection;
- multiple cellular providers;
- dedicated GPS support;
- public API;
- Google Maps integration;
- integrations with existing company websites;
- automated custom-domain provisioning;
- billing;
- subscription management.

---

# 45. Architectural Principle

The most important architectural principle is:

> Build a simple, reliable product that can become a large system later.

Do not optimize for thousands of companies before acquiring the first one.

Do not introduce infrastructure merely because it is common in large SaaS systems.

The first goal is to prove:

> A passenger can open a web page and reliably watch a bus move along its route in near real time using only the driver's smartphone.