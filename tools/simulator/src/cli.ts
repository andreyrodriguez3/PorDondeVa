import { randomUUID } from 'node:crypto';
import type { LocationPoint } from '@tubus/contracts';
import { ApiClient } from './api-client';
import { pathLengthMeters, positionAtDistance } from './geometry';

interface Args {
  route: string;
  bus: string;
  speedKmh: number;
  intervalSeconds: number;
  dropNetworkAfter: number | null;
  reconnectAfter: number | null;
  apiUrl: string;
  adminHost: string;
  companyCode: string;
  username: string;
  password: string;
}

function parseArgs(argv: string[]): Args {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    const value = argv[i + 1];
    if (key && value !== undefined) map.set(key, value);
  }

  const route = map.get('route');
  const bus = map.get('bus');
  if (!route || !bus) {
    throw new Error('Usage: simulate --route <slug> --bus "<label>" [options]');
  }

  return {
    route,
    bus,
    speedKmh: Number(map.get('speed') ?? 40),
    intervalSeconds: Number(map.get('interval') ?? 5),
    dropNetworkAfter: map.has('drop-network-after') ? Number(map.get('drop-network-after')) : null,
    reconnectAfter: map.has('reconnect-after') ? Number(map.get('reconnect-after')) : null,
    apiUrl: map.get('api-url') ?? process.env.PUBLIC_API_URL ?? 'http://localhost:8080',
    adminHost: map.get('admin-host') ?? process.env.ADMIN_HOST ?? 'admin.tubus.localhost',
    companyCode: map.get('company') ?? 'tuanrl',
    username: map.get('username') ?? 'driver24',
    password: map.get('password') ?? 'ChangeMe123!',
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const client = new ApiClient(args.apiUrl, args.adminHost);

  console.log(`[simulator] logging in as ${args.companyCode}/${args.username}...`);
  await client.loginAsDriver(args.companyCode, args.username, args.password);

  const assignment = await client.getAssignment();
  const routeEntry = assignment.routes.find((r) => r.routeSlug === args.route);
  if (!routeEntry) {
    throw new Error(
      `Route "${args.route}" not found in this driver's assignment. Available: ` +
        assignment.routes.map((r) => r.routeSlug).join(', '),
    );
  }
  const bus = assignment.buses.find((b) => b.label === args.bus);
  const busId = bus?.id ?? assignment.defaultBusId ?? undefined;

  const existing = await client.getActiveTrip();
  const trip = existing ?? (await client.startTrip(routeEntry.variantId, busId));
  console.log(
    `[simulator] trip ${trip.id} started on route "${routeEntry.routeName}" (${routeEntry.headsign})`,
  );

  const coords = routeEntry.geometry.coordinates as [number, number][];
  const totalMeters = pathLengthMeters(coords);
  const speedMps = (args.speedKmh * 1000) / 3600;

  let traveledMeters = 0;
  let elapsedSeconds = 0;
  let queue: LocationPoint[] = [];
  let online = true;

  const timer = setInterval(async () => {
    elapsedSeconds += args.intervalSeconds;
    traveledMeters += speedMps * args.intervalSeconds;

    if (args.dropNetworkAfter !== null && elapsedSeconds >= args.dropNetworkAfter) {
      if (online) console.log('[simulator] network dropped — buffering locally');
      online = false;
    }
    if (
      args.reconnectAfter !== null &&
      args.dropNetworkAfter !== null &&
      elapsedSeconds >= args.dropNetworkAfter + args.reconnectAfter
    ) {
      if (!online) console.log('[simulator] network reconnected — flushing buffer');
      online = true;
    }

    const done = traveledMeters >= totalMeters;
    const pos = positionAtDistance(coords, Math.min(traveledMeters, totalMeters));

    const point: LocationPoint = {
      clientPointId: randomUUID(),
      lat: pos.lat,
      lng: pos.lng,
      speedMps: done ? 0 : speedMps + jitter(0.5),
      bearingDeg: pos.bearingDeg,
      accuracyM: 6 + Math.random() * 6,
      deviceTimestamp: new Date().toISOString(),
    };
    queue.push(point);

    if (online && queue.length > 0) {
      const toSend = queue;
      queue = [];
      try {
        const result = await client.submitLocations(trip.id, toSend);
        const accepted = result.results.filter((r) => r.outcome === 'accepted').length;
        console.log(
          `[simulator] sent ${toSend.length} point(s), ${accepted} accepted, ` +
            `at (${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)})`,
        );
      } catch (error) {
        console.error('[simulator] send failed, re-queueing:', (error as Error).message);
        queue = [...toSend, ...queue];
      }
    } else if (!online) {
      console.log(`[simulator] queued point offline (queue depth: ${queue.length})`);
    }

    if (done) {
      clearInterval(timer);
      await client.endTrip(trip.id);
      console.log('[simulator] reached the end of the route — trip ended.');
      process.exit(0);
    }
  }, args.intervalSeconds * 1000);
}

function jitter(magnitude: number): number {
  return (Math.random() * 2 - 1) * magnitude;
}

main().catch((error) => {
  console.error('[simulator] fatal error:', error.message);
  process.exit(1);
});
