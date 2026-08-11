import { Injectable, NotFoundException } from '@nestjs/common';
import type { PublicBusUpdate } from '@tubus/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { computeLiveState } from '../common/live-status';

@Injectable()
export class LiveService {
  constructor(private readonly prisma: PrismaService) {}

  /** Admin fleet view — every currently active trip's live state, company-wide. */
  async getFleet(companyId: string): Promise<PublicBusUpdate[]> {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const states = await this.prisma.scoped.tripLiveState.findMany({
      where: { companyId },
      include: {
        bus: { select: { label: true } },
        variant: { select: { headsign: true } },
      },
    });
    const now = new Date();
    return states.map((s) => toPublicUpdate(s, s.bus.label, s.variant.headsign, now, company));
  }

  /** Public REST snapshot for one route — used for initial page load and polling fallback. */
  async getRouteLive(companyId: string, routeSlug: string): Promise<PublicBusUpdate[]> {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const route = await this.prisma.scoped.route.findFirst({
      where: { companyId, publicSlug: routeSlug },
      include: { variants: { select: { id: true } } },
    });
    if (!route) throw new NotFoundException();

    const variantIds = route.variants.map((v) => v.id);
    const states = await this.prisma.scoped.tripLiveState.findMany({
      where: { companyId, routeVariantId: { in: variantIds } },
      include: {
        bus: { select: { label: true } },
        variant: { select: { headsign: true } },
      },
    });
    const now = new Date();
    return states.map((s) => toPublicUpdate(s, s.bus.label, s.variant.headsign, now, company));
  }
}

function toPublicUpdate(
  state: {
    tripId: string;
    routeVariantId: string;
    latitude: number;
    longitude: number;
    bearingDeg: number | null;
    speedMps: number | null;
    accuracyM: number | null;
    deviceTimestamp: Date;
  },
  busLabel: string,
  headsign: string,
  now: Date,
  company: { liveThresholdSeconds: number; staleThresholdSeconds: number },
): PublicBusUpdate {
  return {
    tripId: state.tripId,
    routeVariantId: state.routeVariantId,
    busLabel,
    headsign,
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
  };
}
