-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DomainKind" AS ENUM ('PLATFORM_SUBDOMAIN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATOR', 'DRIVER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BusStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "RouteStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "VariantDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TripEndReason" AS ENUM ('DRIVER', 'ADMIN', 'AUTO_TIMEOUT');

-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('VEHICLE', 'TRAFFIC', 'VEHICLE_CHANGE', 'OTHER');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" CITEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Costa_Rica',
    "logo_path" TEXT,
    "brand_primary_color" TEXT,
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "live_threshold_seconds" INTEGER NOT NULL DEFAULT 30,
    "stale_threshold_seconds" INTEGER NOT NULL DEFAULT 180,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_domains" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "hostname" CITEXT NOT NULL,
    "kind" "DomainKind" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "email" CITEXT,
    "username" CITEXT,
    "password_hash" TEXT NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_profiles" (
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "phone" TEXT,
    "license_number" TEXT,
    "default_bus_id" TEXT,
    "status" "DriverStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_label" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buses" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "license_plate" TEXT,
    "status" "BusStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "origin_label" TEXT NOT NULL,
    "destination_label" TEXT NOT NULL,
    "public_slug" CITEXT NOT NULL,
    "status" "RouteStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_variants" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" "VariantDirection" NOT NULL,
    "headsign" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" "RouteStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stops" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_variant_stops" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "route_variant_id" TEXT NOT NULL,
    "stop_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "route_variant_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "route_variant_id" TEXT NOT NULL,
    "departure_time" TIME NOT NULL,
    "days_of_week" INTEGER[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "route_variant_id" TEXT NOT NULL,
    "schedule_id" TEXT,
    "bus_id" TEXT NOT NULL,
    "driver_user_id" TEXT NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'ACTIVE',
    "scheduled_departure_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "end_reason" "TripEndReason",
    "rejected_point_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_points" (
    "id" BIGSERIAL NOT NULL,
    "trip_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "client_point_id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy_m" DOUBLE PRECISION,
    "speed_mps" DOUBLE PRECISION,
    "bearing_deg" DOUBLE PRECISION,
    "device_timestamp" TIMESTAMP(3) NOT NULL,
    "server_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_live_states" (
    "trip_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "route_variant_id" TEXT NOT NULL,
    "bus_id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy_m" DOUBLE PRECISION,
    "speed_mps" DOUBLE PRECISION,
    "bearing_deg" DOUBLE PRECISION,
    "device_timestamp" TIMESTAMP(3) NOT NULL,
    "server_timestamp" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_live_states_pkey" PRIMARY KEY ("trip_id")
);

-- CreateTable
CREATE TABLE "trip_incidents" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "reported_by_user_id" TEXT NOT NULL,
    "category" "IncidentCategory" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "company_id" TEXT,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "metadata" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "company_domains_hostname_key" ON "company_domains"("hostname");

-- CreateIndex
CREATE INDEX "company_domains_hostname_idx" ON "company_domains"("hostname");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_company_id_role_idx" ON "users"("company_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "users_company_id_username_key" ON "users"("company_id", "username");

-- CreateIndex
CREATE INDEX "driver_profiles_company_id_status_idx" ON "driver_profiles"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "buses_company_id_label_key" ON "buses"("company_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "routes_company_id_public_slug_key" ON "routes"("company_id", "public_slug");

-- CreateIndex
CREATE INDEX "route_variants_route_id_status_idx" ON "route_variants"("route_id", "status");

-- CreateIndex
CREATE INDEX "stops_company_id_idx" ON "stops"("company_id");

-- CreateIndex
CREATE INDEX "route_variant_stops_route_variant_id_sequence_idx" ON "route_variant_stops"("route_variant_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "route_variant_stops_route_variant_id_stop_id_key" ON "route_variant_stops"("route_variant_id", "stop_id");

-- CreateIndex
CREATE INDEX "schedules_route_variant_id_active_idx" ON "schedules"("route_variant_id", "active");

-- CreateIndex
CREATE INDEX "trips_company_id_status_idx" ON "trips"("company_id", "status");

-- CreateIndex
CREATE INDEX "trips_route_variant_id_status_idx" ON "trips"("route_variant_id", "status");

-- CreateIndex
CREATE INDEX "trips_company_id_started_at_idx" ON "trips"("company_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "trips_driver_user_id_started_at_idx" ON "trips"("driver_user_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "location_points_trip_id_device_timestamp_idx" ON "location_points"("trip_id", "device_timestamp");

-- CreateIndex
CREATE INDEX "location_points_server_timestamp_idx" ON "location_points"("server_timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "location_points_trip_id_client_point_id_key" ON "location_points"("trip_id", "client_point_id");

-- CreateIndex
CREATE INDEX "trip_live_states_route_variant_id_idx" ON "trip_live_states"("route_variant_id");

-- CreateIndex
CREATE INDEX "trip_live_states_company_id_idx" ON "trip_live_states"("company_id");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "company_domains" ADD CONSTRAINT "company_domains_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_default_bus_id_fkey" FOREIGN KEY ("default_bus_id") REFERENCES "buses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buses" ADD CONSTRAINT "buses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_variants" ADD CONSTRAINT "route_variants_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_variants" ADD CONSTRAINT "route_variants_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stops" ADD CONSTRAINT "stops_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_variant_stops" ADD CONSTRAINT "route_variant_stops_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_variant_stops" ADD CONSTRAINT "route_variant_stops_route_variant_id_fkey" FOREIGN KEY ("route_variant_id") REFERENCES "route_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_variant_stops" ADD CONSTRAINT "route_variant_stops_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "stops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_route_variant_id_fkey" FOREIGN KEY ("route_variant_id") REFERENCES "route_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_route_variant_id_fkey" FOREIGN KEY ("route_variant_id") REFERENCES "route_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_bus_id_fkey" FOREIGN KEY ("bus_id") REFERENCES "buses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_points" ADD CONSTRAINT "location_points_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_points" ADD CONSTRAINT "location_points_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_live_states" ADD CONSTRAINT "trip_live_states_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_live_states" ADD CONSTRAINT "trip_live_states_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_live_states" ADD CONSTRAINT "trip_live_states_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_live_states" ADD CONSTRAINT "trip_live_states_route_variant_id_fkey" FOREIGN KEY ("route_variant_id") REFERENCES "route_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_live_states" ADD CONSTRAINT "trip_live_states_bus_id_fkey" FOREIGN KEY ("bus_id") REFERENCES "buses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_incidents" ADD CONSTRAINT "trip_incidents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_incidents" ADD CONSTRAINT "trip_incidents_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_incidents" ADD CONSTRAINT "trip_incidents_reported_by_user_id_fkey" FOREIGN KEY ("reported_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The following statements are not expressible in schema.prisma and are hand-authored
-- (ROADMAP.md D8, D14, A2, A10). They must be preserved verbatim across future
-- `prisma migrate dev` runs, which cannot regenerate them from the schema alone.

-- D8/A22 — a trip must have exactly one active occupant per bus and per driver. This is
-- the integrity backbone, not a convention: two concurrent ACTIVE trips on one bus are
-- impossible at the database level.
CREATE UNIQUE INDEX "trips_one_active_per_bus" ON "trips" ("bus_id") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "trips_one_active_per_driver" ON "trips" ("driver_user_id") WHERE "status" = 'ACTIVE';

-- D20 — a user must have some way to log in: a web email or a driver username.
ALTER TABLE "users" ADD CONSTRAINT "users_email_or_username_present"
  CHECK ("email" IS NOT NULL OR "username" IS NOT NULL);

-- Route variant geometry must be a GeoJSON LineString (§12 in SPECS.md).
ALTER TABLE "route_variants" ADD CONSTRAINT "route_variants_geometry_is_linestring"
  CHECK ("geometry"->>'type' = 'LineString');

-- Days of week are 0 (Sunday) through 6 (Saturday), and a schedule needs at least one (§14).
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_days_of_week_valid"
  CHECK (
    cardinality("days_of_week") > 0
    AND "days_of_week" <@ ARRAY[0, 1, 2, 3, 4, 5, 6]
  );


