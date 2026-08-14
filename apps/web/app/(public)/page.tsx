import { headers } from 'next/headers';
import Link from 'next/link';
import { listRoutes } from '@/lib/api';
import { copy } from '@/lib/copy';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

// Belt-and-suspenders alongside the (public) layout's export: this page resolves its
// content from the request's Host header and must never be served from a cached
// build-time render (see the layout for why that's not just staleness but a
// cross-tenant leak risk).
export const dynamic = 'force-dynamic';

function resolveHostname(): string {
  const h = headers();
  return (h.get('host') ?? '').split(':')[0]!;
}

function BusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 16.5V6.8C4 5.25 5.3 4 6.9 4h10.2C18.7 4 20 5.25 20 6.8v9.7c0 1.05-.86 1.9-1.93 1.9H5.93A1.93 1.93 0 0 1 4 16.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M6 6.4h12" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7.6" cy="19" r="1.6" fill="currentColor" />
      <circle cx="16.4" cy="19" r="1.6" fill="currentColor" />
    </svg>
  );
}

export default async function CompanyLandingPage() {
  const hostname = resolveHostname();
  const routes = (await listRoutes(hostname)) ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-display text-ink">{copy.routesHeading}</h1>
      <p className="mb-6 text-body text-ink-secondary">{copy.routesSubheading}</p>

      {routes.length === 0 ? (
        <EmptyState icon={<BusIcon />} title={copy.noRoutes} description={copy.noRoutesHint} />
      ) : (
        <ul className="flex flex-col gap-3">
          {routes.map((route, i) => {
            const corridor = `${route.originLabel} → ${route.destinationLabel}`;
            const showCorridor = corridor !== route.name;
            return (
              <li
                key={route.slug}
                className="animate-fade-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <Link
                  href={`/r/${route.slug}`}
                  className="group flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 shadow-elevate-1 transition-all duration-150 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-elevate-2 active:translate-y-0 active:shadow-elevate-1"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <BusIcon />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-title text-ink">{route.name}</span>
                    {showCorridor ? (
                      <span className="block truncate text-callout text-ink-secondary">
                        {corridor}
                      </span>
                    ) : null}
                  </span>
                  {route.activeBusCount > 0 ? (
                    <Badge tone="live" dot>
                      {route.activeBusCount} {route.activeBusCount === 1 ? 'bus' : 'buses'}
                    </Badge>
                  ) : (
                    <span className="shrink-0 text-caption text-ink-tertiary">
                      {copy.noActiveBusesShort}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
