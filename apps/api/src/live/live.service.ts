import { Injectable, NotFoundException } from '@nestjs/common';
import type { PublicBusUpdate } from '@tubus/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { computeLiveState } from '../common/live-status';
import {
  buildStopDistanceIndex,
  computeNextStopEtaFromIndex,
  type StopDistanceEntry,
} from '../common/route-eta';

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
        variant: { select: { headsign: true, geometry: true, stops: STOPS_INCLUDE } },
      },
    });
    const now = new Date();
    const stopIndexCache = new Map<string, StopDistanceEntry[]>();
    return states.map((s) =>
      toPublicUpdate(s, s.bus.label, s.variant, now, company, stopIndexCache),
    );
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
        variant: { select: { headsign: true, geometry: true, stops: STOPS_INCLUDE } },
      },
    });
    const now = new Date();
    const stopIndexCache = new Map<string, StopDistanceEntry[]>();
    return states.map((s) =>
      toPublicUpdate(s, s.bus.label, s.variant, now, company, stopIndexCache),
    );
  }
}

const STOPS_INCLUDE = {
  select: { stop: { select: { id: true, latitude: true, longitude: true } } },
  orderBy: { sequence: 'asc' as const },
};

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
  variant: {
    headsign: string;
    geometry: unknown;
    stops: { stop: { id: string; latitude: number; longitude: number } }[];
  },
  now: Date,
  company: { liveThresholdSeconds: number; staleThresholdSeconds: number },
  stopIndexCache: Map<string, StopDistanceEntry[]>,
): PublicBusUpdate {
  // No recent-fix history available for a snapshot read (unlike the ingest path, which
  // averages a short window) — falls back to this one fix's own speed, or the ETA
  // helper's own floor if even that is null.
  const geometry = variant.geometry as { coordinates: [number, number][] };

  // Every stop's distance-along-the-line is the same for every bus running this variant
  // in this request — build it once per variant, not once per bus (route-eta.ts).
  let stopIndex = stopIndexCache.get(state.routeVariantId);
  if (!stopIndex) {
    stopIndex = buildStopDistanceIndex(
      geometry.coordinates,
      variant.stops.map((s) => s.stop),
    );
    stopIndexCache.set(state.routeVariantId, stopIndex);
  }

  const eta = computeNextStopEtaFromIndex(
    geometry.coordinates,
    stopIndex,
    state.latitude,
    state.longitude,
    state.speedMps !== null ? [state.speedMps] : [],
  );

  return {
    tripId: state.tripId,
    routeVariantId: state.routeVariantId,
    busLabel,
    headsign: variant.headsign,
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
    nextStopId: eta?.nextStopId ?? null,
    etaSeconds: eta?.etaSeconds ?? null,
  };
}
