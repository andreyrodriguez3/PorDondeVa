import { Injectable, NotFoundException } from '@nestjs/common';
import type { PublicCompany, PublicRouteDetail, PublicRouteSummary } from '@tubus/contracts';
import { PrismaService } from '../common/prisma/prisma.service';

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

  /** Caddy's on-demand-TLS `ask` endpoint (D17) — 200 only for a verified hostname. */
  async isDomainAllowed(hostname: string): Promise<boolean> {
    const domain = await this.prisma.companyDomain.findUnique({
      where: { hostname: hostname.toLowerCase() },
      select: { verifiedAt: true },
    });
    return Boolean(domain?.verifiedAt);
  }
}
