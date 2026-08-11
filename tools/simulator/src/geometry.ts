const EARTH_RADIUS_M = 6_371_000;

type LngLat = readonly [number, number];

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function haversineMeters(a: LngLat, b: LngLat): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDegrees(a: LngLat, b: LngLat): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const y = Math.sin(toRadians(lng2 - lng1)) * Math.cos(toRadians(lat2));
  const x =
    Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
    Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(toRadians(lng2 - lng1));
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

export function pathLengthMeters(coords: readonly LngLat[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineMeters(coords[i - 1]!, coords[i]!);
  }
  return total;
}

export interface PathPosition {
  lat: number;
  lng: number;
  bearingDeg: number;
}

/**
 * Walks the LineString and returns the point `distanceMeters` along it, linearly
 * interpolating between the two bracketing vertices. Clamps to the endpoints — the
 * simulator never extrapolates past the route geometry.
 */
export function positionAtDistance(
  coords: readonly LngLat[],
  distanceMeters: number,
): PathPosition {
  if (coords.length === 0) throw new Error('Empty geometry');
  if (coords.length === 1) {
    const [lng, lat] = coords[0]!;
    return { lat, lng, bearingDeg: 0 };
  }

  let remaining = Math.max(0, distanceMeters);
  for (let i = 1; i < coords.length; i++) {
    const segmentStart = coords[i - 1]!;
    const segmentEnd = coords[i]!;
    const segmentLength = haversineMeters(segmentStart, segmentEnd);

    if (remaining <= segmentLength || i === coords.length - 1) {
      const fraction = segmentLength === 0 ? 0 : Math.min(1, remaining / segmentLength);
      const lng = segmentStart[0] + (segmentEnd[0] - segmentStart[0]) * fraction;
      const lat = segmentStart[1] + (segmentEnd[1] - segmentStart[1]) * fraction;
      return { lat, lng, bearingDeg: bearingDegrees(segmentStart, segmentEnd) };
    }
    remaining -= segmentLength;
  }

  const [lng, lat] = coords[coords.length - 1]!;
  return { lat, lng, bearingDeg: 0 };
}
