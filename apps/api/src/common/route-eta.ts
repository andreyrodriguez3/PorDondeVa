// Projects a GPS fix onto a route's LineString to get "how far along the road has the
// bus traveled" (not straight-line distance to a stop, which cuts corners the road
// doesn't), then compares that against each stop's own distance-along-the-line to find
// the next unreached stop and how far away it still is.

const MIN_SPEED_MPS = 1.5; // ~5.4 km/h floor — a stopped/crawling bus shouldn't imply an infinite ETA
const MAX_SPEED_MPS = 25; // ~90 km/h ceiling — generous for a bus, catches GPS speed spikes

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusM = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.sqrt(h));
}

// Local flat-earth projection onto one segment — accurate enough at the scale of a
// single route segment (tens to low hundreds of meters), far simpler than exact
// great-circle segment projection.
function projectOntoSegment(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
  pLat: number,
  pLng: number,
): { t: number; distanceFromLineM: number } {
  const latRef = (aLat + bLat) / 2;
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos(toRad(latRef));

  const bx = (bLng - aLng) * mPerDegLng;
  const by = (bLat - aLat) * mPerDegLat;
  const px = (pLng - aLng) * mPerDegLng;
  const py = (pLat - aLat) * mPerDegLat;

  const abLenSq = bx * bx + by * by;
  let t = abLenSq === 0 ? 0 : (px * bx + py * by) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const dx = px - t * bx;
  const dy = py - t * by;
  return { t, distanceFromLineM: Math.sqrt(dx * dx + dy * dy) };
}

/** Distance from the start of the line to the closest point on it to (lat, lng), in meters. */
export function distanceAlongLineM(
  coordinates: [number, number][], // [lng, lat] pairs, as GeoJSON stores them
  lat: number,
  lng: number,
): number {
  let cumulative = 0;
  let best = { distanceAlongM: 0, distanceFromLineM: Infinity };

  for (let i = 0; i < coordinates.length - 1; i++) {
    const [aLng, aLat] = coordinates[i]!;
    const [bLng, bLat] = coordinates[i + 1]!;
    const segLenM = haversineMeters(aLat, aLng, bLat, bLng);
    const { t, distanceFromLineM } = projectOntoSegment(aLat, aLng, bLat, bLng, lat, lng);
    if (distanceFromLineM < best.distanceFromLineM) {
      best = { distanceAlongM: cumulative + t * segLenM, distanceFromLineM };
    }
    cumulative += segLenM;
  }

  return best.distanceAlongM;
}

export interface NextStopEta {
  nextStopId: string;
  etaSeconds: number;
}

/**
 * `stops` must be in sequence order. `recentSpeedsMps` is a short window of the most
 * recent accepted fixes' speed (nulls filtered out by the caller) — averaging a few
 * beats the instantaneous `speedMps` of a single fix, which is noisy enough on real GPS
 * hardware to make a per-fix ETA visibly jump around.
 */
export function computeNextStopEta(
  routeCoordinates: [number, number][],
  stops: { id: string; latitude: number; longitude: number }[],
  busLat: number,
  busLng: number,
  recentSpeedsMps: number[],
): NextStopEta | null {
  if (stops.length === 0) return null;

  const busDistanceM = distanceAlongLineM(routeCoordinates, busLat, busLng);
  const nextStop = stops
    .map((stop) => ({
      stop,
      distanceM: distanceAlongLineM(routeCoordinates, stop.latitude, stop.longitude),
    }))
    .find(({ distanceM }) => distanceM > busDistanceM);
  if (!nextStop) return null; // bus has passed (or is past) every stop on this line

  const distanceRemainingM = nextStop.distanceM - busDistanceM;

  const avgSpeedMps =
    recentSpeedsMps.length > 0
      ? recentSpeedsMps.reduce((sum, v) => sum + v, 0) / recentSpeedsMps.length
      : MIN_SPEED_MPS;
  const effectiveSpeedMps = Math.min(MAX_SPEED_MPS, Math.max(MIN_SPEED_MPS, avgSpeedMps));

  return {
    nextStopId: nextStop.stop.id,
    etaSeconds: Math.round(distanceRemainingM / effectiveSpeedMps),
  };
}
