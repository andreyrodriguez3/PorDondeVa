import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { LocationPoint, SubmitLocationsResponse } from '@tubus/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { LiveGateway } from '../live/live.gateway';
import { computeLiveState } from '../common/live-status';

const FUTURE_TOLERANCE_MS = 60_000;
const PRE_TRIP_TOLERANCE_MS = 5 * 60_000;
const MAX_AGE_MS = 24 * 60 * 60_000;

type PointResult = SubmitLocationsResponse['results'][number];

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly liveGateway: LiveGateway,
  ) {}

  /**
   * D8 — one batched, idempotent endpoint serves both the live case and an offline
   * flush. D11/D19 — the live state only advances on a newer device timestamp, and at
   * most one WebSocket broadcast is emitted per batch, after the transaction commits.
   */
  async ingest(
    companyId: string,
    tripId: string,
    driverUserId: string,
    points: LocationPoint[],
  ): Promise<SubmitLocationsResponse> {
    const trip = await this.prisma.scoped.trip.findFirst({
      where: { companyId, id: tripId },
      include: {
        bus: { select: { label: true } },
        variant: { select: { headsign: true } },
      },
    });
    if (!trip) throw new NotFoundException('Trip not found in this company.');

    // A malicious user must not be able to submit locations for another driver's trip
    // (SPECS.md §26) — a within-tenant check the tenancy conformance suite cannot cover.
    if (trip.driverUserId !== driverUserId) {
      throw new ForbiddenException('This trip does not belong to the authenticated driver.');
    }
    if (trip.status !== 'ACTIVE') {
      throw new ForbiddenException('Trip is not active.');
    }

    const now = new Date();
    const results: PointResult[] = [];
    let rejectedCount = 0;
    let newestAccepted: { timestamp: Date; point: LocationPoint } | null = null;

    await this.prisma.$transaction(async (tx) => {
      for (const point of points) {
        const deviceTimestamp = new Date(point.deviceTimestamp);
        const rejection = validateClock(deviceTimestamp, now, trip.startedAt);
        if (rejection) {
          results.push({
            clientPointId: point.clientPointId,
            outcome: 'rejected',
            reason: rejection,
          });
          rejectedCount += 1;
          continue;
        }

        const affected = await tx.$executeRaw`
          INSERT INTO location_points
            (trip_id, company_id, client_point_id, latitude, longitude, accuracy_m, speed_mps, bearing_deg, device_timestamp)
          VALUES
            (${tripId}, ${companyId}, ${point.clientPointId}, ${point.lat}, ${point.lng},
             ${point.accuracyM ?? null}, ${point.speedMps ?? null}, ${point.bearingDeg ?? null}, ${deviceTimestamp})
          ON CONFLICT (trip_id, client_point_id) DO NOTHING
        `;

        if (affected > 0) {
          results.push({ clientPointId: point.clientPointId, outcome: 'accepted' });
          if (!newestAccepted || deviceTimestamp > newestAccepted.timestamp) {
            newestAccepted = { timestamp: deviceTimestamp, point };
          }
        } else {
          results.push({ clientPointId: point.clientPointId, outcome: 'duplicate' });
        }
      }

      if (rejectedCount > 0) {
        await tx.$executeRaw`
          UPDATE trips SET rejected_point_count = rejected_point_count + ${rejectedCount}
          WHERE id = ${tripId}
        `;
      }

      if (newestAccepted) {
        const p = newestAccepted as { timestamp: Date; point: LocationPoint };
        const advanced = await tx.$executeRaw`
          INSERT INTO trip_live_states
            (trip_id, company_id, route_id, route_variant_id, bus_id, latitude, longitude,
             accuracy_m, speed_mps, bearing_deg, device_timestamp, server_timestamp, updated_at)
          VALUES
            (${tripId}, ${companyId}, ${trip.routeId}, ${trip.routeVariantId}, ${trip.busId},
             ${p.point.lat}, ${p.point.lng}, ${p.point.accuracyM ?? null}, ${p.point.speedMps ?? null},
             ${p.point.bearingDeg ?? null}, ${p.timestamp}, now(), now())
          ON CONFLICT (trip_id) DO UPDATE SET
            latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
            accuracy_m = EXCLUDED.accuracy_m, speed_mps = EXCLUDED.speed_mps,
            bearing_deg = EXCLUDED.bearing_deg, device_timestamp = EXCLUDED.device_timestamp,
            server_timestamp = EXCLUDED.server_timestamp, updated_at = EXCLUDED.updated_at
          WHERE EXCLUDED.device_timestamp > trip_live_states.device_timestamp
        `;
        if (advanced === 0) newestAccepted = null; // did not advance — no broadcast (D11/D19)
      }
    });

    this.logger.debug(
      `trip=${tripId} batch=${points.length} accepted=${results.filter((r) => r.outcome === 'accepted').length} ` +
        `duplicate=${results.filter((r) => r.outcome === 'duplicate').length} rejected=${rejectedCount}`,
    );

    if (newestAccepted) {
      const p = newestAccepted as { timestamp: Date; point: LocationPoint };
      const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
      this.liveGateway.emitBusUpdate(companyId, trip.routeVariantId, {
        tripId,
        routeVariantId: trip.routeVariantId,
        busLabel: trip.bus.label,
        headsign: trip.variant.headsign,
        lat: p.point.lat,
        lng: p.point.lng,
        bearingDeg: p.point.bearingDeg ?? null,
        speedMps: p.point.speedMps ?? null,
        accuracyM: p.point.accuracyM ?? null,
        deviceTimestamp: p.timestamp.toISOString(),
        state: computeLiveState(
          p.timestamp,
          new Date(),
          company.liveThresholdSeconds,
          company.staleThresholdSeconds,
        ),
      });
    }

    return { results };
  }
}

function validateClock(deviceTimestamp: Date, now: Date, tripStartedAt: Date): string | undefined {
  if (deviceTimestamp.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    return 'device_timestamp is too far in the future';
  }
  if (deviceTimestamp.getTime() < tripStartedAt.getTime() - PRE_TRIP_TOLERANCE_MS) {
    return 'device_timestamp is before the trip started';
  }
  if (deviceTimestamp.getTime() < now.getTime() - MAX_AGE_MS) {
    return 'device_timestamp is too old';
  }
  return undefined;
}
