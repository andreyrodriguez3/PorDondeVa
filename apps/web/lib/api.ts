import type {
  PublicCompany,
  PublicRouteDetail,
  PublicRouteLive,
  PublicRouteSummary,
  PublicStopDetail,
  PublicStopLive,
} from '@tubus/contracts';

const API_URL = process.env.PUBLIC_API_URL ?? 'http://localhost:8080';

/**
 * Server-side calls to the public API, scoped by the passenger's hostname. `X-Tenant-Host`
 * mirrors the browser's Host header so the API resolves the same tenant it would for a
 * direct request — see the note in HostResolutionMiddleware about why this only applies
 * outside production, where Caddy's routing keeps the Host header itself correct end to
 * end (docs/scaling.md tracks hardening this same-origin path further).
 */
async function publicApiFetch<T>(hostname: string, path: string): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'X-Tenant-Host': hostname },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API request failed: ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export function getCompany(hostname: string) {
  return publicApiFetch<PublicCompany>(hostname, '/public/company');
}

export function listRoutes(hostname: string) {
  return publicApiFetch<PublicRouteSummary[]>(hostname, '/public/routes');
}

export function getRouteDetail(hostname: string, slug: string) {
  return publicApiFetch<PublicRouteDetail>(hostname, `/public/routes/${slug}`);
}

export function getRouteLive(hostname: string, slug: string) {
  return publicApiFetch<PublicRouteLive>(hostname, `/public/routes/${slug}/live`);
}

export function getStopDetail(hostname: string, stopId: string) {
  return publicApiFetch<PublicStopDetail>(hostname, `/public/stops/${stopId}`);
}

export function getStopLive(hostname: string, stopId: string) {
  return publicApiFetch<PublicStopLive>(hostname, `/public/stops/${stopId}/live`);
}
