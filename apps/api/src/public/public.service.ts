import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  PublicApproachingBus,
  PublicCompany,
  PublicRouteDetail,
  PublicRouteSummary,
  PublicStopDetail,
  PublicStopLive,
} from '@tubus/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { computeLiveState } from '../common/live-status';
import { computeNextStopEta } from '../common/route-eta';

// `departureTime` is a Postgres `time` column (no zone) — node-postgres represents it as a
// Date on the 1970-01-01 epoch with the stored hour/minute in UTC fields, regardless of the
// server's local timezone, so reading UTC fields here reproduces the wall-clock value as-is.
function formatWallClockTime(time: Date): string {
  const hours = String(time.getUTCHours()).padStart(2, '0');
  const minutes = String(time.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompany(companyId: string): Promise<PublicCompany> {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    return {
      name: company.name,
      slug: company.slug,
      logoPath: company.logoPath,
      brandPrimaryColor: company.brandPrimaryColor,
    };
  }

  async listRoutes(companyId: string): Promise<PublicRouteSummary[]> {
    const routes = await this.prisma.scoped.route.findMany({
      where: { companyId, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });

    const counts = await this.prisma.scoped.tripLiveState.groupBy({
      by: ['routeId'],
      where: { companyId },
      _count: { routeId: true },
    });
    const countByRoute = new Map(counts.map((c) => [c.routeId, c._count.routeId]));

    return routes.map((route) => ({
      slug: route.publicSlug,
      name: route.name,
      originLabel: route.originLabel,
      destinationLabel: route.destinationLabel,
      activeBusCount: countByRoute.get(route.id) ?? 0,
    }));
  }

  async getRouteDetail(companyId: string, slug: string): Promise<PublicRouteDetail> {
    const route = await this.prisma.scoped.route.findFirst({
      where: { companyId, publicSlug: slug, status: 'ACTIVE' },
      include: {
        variants: {
          where: { status: 'ACTIVE' },
          include: {
            stops: {
              orderBy: { sequence: 'asc' },
              include: { stop: true },
            },
            schedules: {
              where: { active: true },
              orderBy: { departureTime: 'asc' },
            },
          },
        },
      },
    });
    if (!route) throw new NotFoundException();

    return {
      slug: route.publicSlug,
      name: route.name,
      originLabel: route.originLabel,
      destinationLabel: route.destinationLabel,
      variants: route.variants.map((variant) => ({
        id: variant.id,
        direction: variant.direction as PublicRouteDetail['variants'][number]['direction'],
        headsign: variant.headsign,
        isDefault: variant.isDefault,
        geometry: variant.geometry as PublicRouteDetail['variants'][number]['geometry'],
        stops: variant.stops.map((link) => ({
          id: link.stop.id,
          name: link.stop.name,
          latitude: link.stop.latitude,
          longitude: link.stop.longitude,
          sequence: link.sequence,
        })),
        schedules: variant.schedules.map((schedule) => ({
          departureTime: formatWallClockTime(schedule.departureTime),
          daysOfWeek: schedule.daysOfWeek,
        })),
      })),
    };
  }

  /**
   * A Stop is a shared physical location that can sit on several route variants (an
   * intersection two lines both pass through) — this lists every one, for the "which
   * buses stop here" QR/link page (§15's deferred "stop-level QR codes").
   */
  async getStopDetail(companyId: string, stopId: string): Promise<PublicStopDetail> {
    const stop = await this.prisma.scoped.stop.findFirst({
      where: { companyId, id: stopId },
      include: {
        variantStops: {
          include: {
            variant: {
              include: { route: { select: { name: true, publicSlug: true, status: true } } },
            },
          },
        },
      },
    });
    if (!stop) throw new NotFoundException();

    const routes = stop.variantStops
      .filter((link) => link.variant.status === 'ACTIVE' && link.variant.route.status === 'ACTIVE')
      .map((link) => ({
        routeSlug: link.variant.route.publicSlug,
        routeName: link.variant.route.name,
        headsign: link.variant.headsign,
      }));

    return { id: stop.id, name: stop.name, latitude: stop.latitude, longitude: stop.longitude, routes };
  }

  /**
   * Every currently active bus whose next unreached stop (computeNextStopEta, shared
   * with the live-ingest broadcast path) is this one — across every route/variant that
   * serves it, not just one.
   */
  async getStopLive(companyId: string, stopId: string): Promise<PublicStopLive> {
    const stop = await this.prisma.scoped.stop.findFirst({ where: { companyId, id: stopId } });
    if (!stop) throw new NotFoundException();

    const variantLinks = await this.prisma.scoped.routeVariantStop.findMany({
      where: { companyId, stopId },
      select: { routeVariantId: true },
    });
    const variantIds = variantLinks.map((link) => link.routeVariantId);
    if (variantIds.length === 0) return { approaching: [] };

    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const states = await this.prisma.scoped.tripLiveState.findMany({
      where: { companyId, routeVariantId: { in: variantIds } },
      include: {
        bus: { select: { label: true } },
        variant: {
          select: {
            headsign: true,
            geometry: true,
            route: { select: { name: true, publicSlug: true } },
            stops: {
              select: { stop: { select: { id: true, latitude: true, longitude: true } } },
              orderBy: { sequence: 'asc' },
            },
          },
        },
      },
    });

    const now = new Date();
    const approaching: PublicApproachingBus[] = [];

    for (const state of states) {
      const geometry = state.variant.geometry as unknown as { coordinates: [number, number][] };
      const eta = computeNextStopEta(
        geometry.coordinates,
        state.variant.stops.map((s) => s.stop),
        state.latitude,
        state.longitude,
        state.speedMps !== null ? [state.speedMps] : [],
      );
      if (eta?.nextStopId !== stopId) continue;

      approaching.push({
        tripId: state.tripId,
        routeVariantId: state.routeVariantId,
        busLabel: state.bus.label,
        headsign: state.variant.headsign,
        lat: state.latitude,
        lng: state.longitude,
        bearingDeg: state.bearingDeg,
        speedMps: state.speedMps,
        accuracyM: state.accuracyM,
        deviceTimestamp: state.deviceTimestamp.toISOString(),
        state: computeLiveState(
          state.deviceTimestamp,
          now,
          company.liveThresholdSeconds,
          company.staleThresholdSeconds,
        ),
        nextStopId: eta.nextStopId,
        etaSeconds: eta.etaSeconds,
        routeSlug: state.variant.route.publicSlug,
        routeName: state.variant.route.name,
      });
    }

    approaching.sort((a, b) => (a.etaSeconds ?? Infinity) - (b.etaSeconds ?? Infinity));
    return { approaching };
  }

  /** Caddy's on-demand-TLS `ask` endpoint (D17) — 200 only for a verified hostname. */
  async isDomainAllowed(hostname: string): Promise<boolean> {
    const domain = await this.prisma.companyDomain.findUnique({
      where: { hostname: hostname.toLowerCase() },
      select: { verifiedAt: true },
    });
    return Boolean(domain?.verifiedAt);
  }
}
