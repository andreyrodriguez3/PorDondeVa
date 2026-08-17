import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  DriverAssignmentResponse,
  IncidentResponse,
  ReportIncidentRequest,
  StartTripRequest,
  TripResponse,
} from '@tubus/contracts';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAssignment(companyId: string, driverUserId: string): Promise<DriverAssignmentResponse> {
    const driverProfile = await this.prisma.scoped.driverProfile.findFirst({
      where: { companyId, userId: driverUserId },
    });

    const buses = await this.prisma.scoped.bus.findMany({
      where: { companyId, status: 'ACTIVE' },
      select: { id: true, label: true },
      orderBy: { label: 'asc' },
    });

    const variants = await this.prisma.scoped.routeVariant.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: { route: { select: { id: true, name: true, publicSlug: true } } },
      orderBy: { name: 'asc' },
    });

    return {
      defaultBusId: driverProfile?.defaultBusId ?? null,
      buses,
      routes: variants.map((v) => ({
        routeId: v.route.id,
        routeName: v.route.name,
        routeSlug: v.route.publicSlug,
        variantId: v.id,
        variantName: v.name,
        headsign: v.headsign,
        geometry: v.geometry as DriverAssignmentResponse['routes'][number]['geometry'],
      })),
    };
  }

  async findActiveForDriver(companyId: string, driverUserId: string): Promise<TripResponse | null> {
    const trip = await this.prisma.scoped.trip.findFirst({
      where: { companyId, driverUserId, status: 'ACTIVE' },
      include: TRIP_LABEL_INCLUDE,
    });
    return trip ? toResponse(trip) : null;
  }

  async start(
    companyId: string,
    driverUserId: string,
    dto: StartTripRequest,
  ): Promise<TripResponse> {
    const variant = await this.prisma.scoped.routeVariant.findFirst({
      where: { companyId, id: dto.routeVariantId },
    });
    if (!variant) throw new NotFoundException('Route variant not found in this company.');

    let busId = dto.busId;
    if (!busId) {
      const driverProfile = await this.prisma.scoped.driverProfile.findFirst({
        where: { companyId, userId: driverUserId },
      });
      busId = driverProfile?.defaultBusId ?? undefined;
    }
    if (!busId) {
      throw new ConflictException('No bus specified and the driver has no default bus assigned.');
    }

    const bus = await this.prisma.scoped.bus.findFirst({ where: { companyId, id: busId } });
    if (!bus) throw new NotFoundException('Bus not found in this company.');

    try {
      const trip = await this.prisma.scoped.trip.create({
        data: {
          companyId,
          routeId: variant.routeId,
          routeVariantId: variant.id,
          busId,
          driverUserId,
          status: 'ACTIVE',
        },
        include: TRIP_LABEL_INCLUDE,
      });
      return toResponse(trip);
    } catch (error) {
      // The partial unique indexes on trips (D-backbone in ROADMAP.md §4.1) are what
      // actually prevent two concurrent active trips on one bus or driver.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This bus or driver already has an active trip.');
      }
      throw error;
    }
  }

  async end(
    companyId: string,
    tripId: string,
    reason: 'DRIVER' | 'ADMIN' | 'AUTO_TIMEOUT',
    filter?: { driverUserId: string },
  ): Promise<TripResponse> {
    const trip = await this.prisma.scoped.trip.findFirst({
      where: { companyId, id: tripId, ...(filter ?? {}) },
    });
    if (!trip) throw new NotFoundException();
    if (trip.status !== 'ACTIVE') {
      throw new ConflictException('Trip is not active.');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.trip.update({
        where: { id: tripId },
        data: { status: 'COMPLETED', endedAt: new Date(), endReason: reason },
        include: TRIP_LABEL_INCLUDE,
      }),
      // TripLiveState is a separate row keyed by tripId, not derived from trip.status —
      // ending the trip without also deleting it leaves a permanent "ghost" bus on the
      // live map/route page (still queried by LiveService), since the cascade delete on
      // this relation only fires when the Trip row itself is deleted, never on update.
      this.prisma.tripLiveState.deleteMany({ where: { tripId } }),
    ]);
    return toResponse(updated);
  }

  // A22 — cancel is for a trip that never really started (wrong bus tapped, driver
  // backed out immediately), not an alternate ending for one already underway. Once a
  // single GPS point has landed, "cancel" would be misleading — that's what "end" is
  // for — so this stays a distinct, narrower action rather than end() with a flag.
  async cancel(companyId: string, tripId: string): Promise<TripResponse> {
    const trip = await this.prisma.scoped.trip.findFirst({ where: { companyId, id: tripId } });
    if (!trip) throw new NotFoundException();
    if (trip.status !== 'ACTIVE') {
      throw new ConflictException('Trip is not active.');
    }

    const pointCount = await this.prisma.scoped.locationPoint.count({
      where: { companyId, tripId },
    });
    if (pointCount > 0) {
      throw new ConflictException(
        'This trip already has GPS points recorded — end it instead of cancelling.',
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.trip.update({
        where: { id: tripId },
        data: { status: 'CANCELLED', endedAt: new Date() },
        include: TRIP_LABEL_INCLUDE,
      }),
      this.prisma.tripLiveState.deleteMany({ where: { tripId } }),
    ]);
    return toResponse(updated);
  }

  async list(companyId: string, status?: string): Promise<TripResponse[]> {
    const trips = await this.prisma.scoped.trip.findMany({
      where: { companyId, ...(status ? { status: status as never } : {}) },
      orderBy: { startedAt: 'desc' },
      take: 100,
      include: TRIP_LABEL_INCLUDE,
    });
    return trips.map(toResponse);
  }

  async findOne(companyId: string, id: string): Promise<TripResponse> {
    const trip = await this.prisma.scoped.trip.findFirst({
      where: { companyId, id },
      include: TRIP_LABEL_INCLUDE,
    });
    if (!trip) throw new NotFoundException();
    return toResponse(trip);
  }

  /**
   * A driver reports what's happening, not what to do about it — no severity/urgency
   * field, no admin action triggered automatically (SPECS.md §6 lists this as the
   * "optional MVP feature"; a real-time alert to the admin is a deliberate follow-up,
   * not bundled in here). The trip must belong to this driver, same ownership check
   * every other driver-facing trip mutation uses.
   */
  async reportIncident(
    companyId: string,
    tripId: string,
    driverUserId: string,
    dto: ReportIncidentRequest,
  ): Promise<IncidentResponse> {
    const trip = await this.prisma.scoped.trip.findFirst({
      where: { companyId, id: tripId, driverUserId },
    });
    if (!trip) throw new NotFoundException();

    const incident = await this.prisma.scoped.tripIncident.create({
      data: {
        companyId,
        tripId,
        reportedByUserId: driverUserId,
        category: dto.category,
        note: dto.note ?? null,
      },
    });
    return toIncidentResponse(incident);
  }

  async listIncidents(companyId: string, tripId: string): Promise<IncidentResponse[]> {
    await this.findOne(companyId, tripId);
    const incidents = await this.prisma.scoped.tripIncident.findMany({
      where: { companyId, tripId },
      orderBy: { createdAt: 'desc' },
    });
    return incidents.map(toIncidentResponse);
  }

  async listLocationHistory(companyId: string, tripId: string) {
    await this.findOne(companyId, tripId);
    return this.prisma.scoped.locationPoint.findMany({
      where: { companyId, tripId },
      orderBy: { deviceTimestamp: 'asc' },
      select: {
        latitude: true,
        longitude: true,
        accuracyM: true,
        speedMps: true,
        bearingDeg: true,
        deviceTimestamp: true,
      },
    });
  }
}

function toIncidentResponse(incident: {
  id: string;
  category: string;
  note: string | null;
  createdAt: Date;
}): IncidentResponse {
  return {
    id: incident.id,
    category: incident.category as IncidentResponse['category'],
    note: incident.note,
    createdAt: incident.createdAt.toISOString(),
  };
}

const TRIP_LABEL_INCLUDE = {
  bus: { select: { label: true } },
  driver: { select: { name: true } },
  route: { select: { name: true } },
  variant: { select: { headsign: true } },
} as const;

function toResponse(trip: {
  id: string;
  routeId: string;
  routeVariantId: string;
  busId: string;
  driverUserId: string;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
  rejectedPointCount: number;
  bus: { label: string };
  driver: { name: string };
  route: { name: string };
  variant: { headsign: string };
}): TripResponse {
  return {
    id: trip.id,
    routeId: trip.routeId,
    routeVariantId: trip.routeVariantId,
    busId: trip.busId,
    driverUserId: trip.driverUserId,
    status: trip.status as TripResponse['status'],
    startedAt: trip.startedAt.toISOString(),
    endedAt: trip.endedAt ? trip.endedAt.toISOString() : null,
    rejectedPointCount: trip.rejectedPointCount,
    busLabel: trip.bus.label,
    driverName: trip.driver.name,
    routeName: trip.route.name,
    variantHeadsign: trip.variant.headsign,
  };
}
