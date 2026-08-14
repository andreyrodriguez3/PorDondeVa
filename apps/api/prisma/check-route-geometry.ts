import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// A stop this far from its variant's line, or one that isn't reached in stop-sequence
// order along the line, means the geometry doesn't actually follow the road the stops
// describe — the exact bug this catches: route geometry generated between just two
// endpoints (e.g. an OSRM request with no waypoints for the real stops) silently takes
// whatever shortcut the routing engine prefers, bypassing towns the stop list claims to
// serve. See ALAJUELA_NARANJO_GEOMETRY's header comment in seed.ts for the incident this
// was written for. Generate geometry by routing *through* every real stop coordinate as
// a waypoint, not just the two endpoints, and this should stay green.
const MAX_STOP_DISTANCE_M = 300;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusM = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.sqrt(h));
}

function nearestVertexIndex(
  lat: number,
  lng: number,
  coordinates: [number, number][],
): { index: number; distanceM: number } {
  let best = { index: -1, distanceM: Infinity };
  coordinates.forEach(([vlng, vlat], index) => {
    const distanceM = haversineMeters(lat, lng, vlat, vlng);
    if (distanceM < best.distanceM) best = { index, distanceM };
  });
  return best;
}

async function main() {
  const variants = await prisma.routeVariant.findMany({
    include: {
      route: { select: { name: true, publicSlug: true } },
      stops: { include: { stop: true }, orderBy: { sequence: 'asc' } },
    },
  });

  let violations = 0;

  for (const variant of variants) {
    const geometry = variant.geometry as unknown as { coordinates: [number, number][] };
    const label = `${variant.route.name} (${variant.headsign})`;
    let previousIndex = -1;

    for (const { stop, sequence } of variant.stops) {
      const { index, distanceM } = nearestVertexIndex(
        stop.latitude,
        stop.longitude,
        geometry.coordinates,
      );

      if (distanceM > MAX_STOP_DISTANCE_M) {
        violations++;
        console.error(
          `[${label}] stop ${sequence} "${stop.name}" is ${distanceM.toFixed(0)}m from the route line (max ${MAX_STOP_DISTANCE_M}m)`,
        );
      }
      if (index < previousIndex) {
        violations++;
        console.error(
          `[${label}] stop ${sequence} "${stop.name}" sits earlier on the line than stop ${sequence - 1} — the route doesn't pass them in order`,
        );
      }
      previousIndex = index;
    }
  }

  if (violations > 0) {
    console.error(`\n${violations} violation(s) found across ${variants.length} route variant(s).`);
    process.exitCode = 1;
  } else {
    console.log(`All ${variants.length} route variant(s) pass — every stop sits on its route line, in order.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
