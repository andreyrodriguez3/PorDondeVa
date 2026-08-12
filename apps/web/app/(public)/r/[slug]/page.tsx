import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRouteDetail, getRouteLive } from '@/lib/api';
import { copy } from '@/lib/copy';
import { RouteLiveView } from '@/components/live/RouteLiveView';

function resolveHostname(): string {
  const h = headers();
  return (h.get('host') ?? '').split(':')[0]!;
}

export default async function RoutePage({ params }: { params: { slug: string } }) {
  const hostname = resolveHostname();
  const [route, live] = await Promise.all([
    getRouteDetail(hostname, params.slug),
    getRouteLive(hostname, params.slug),
  ]);

  if (!route) notFound();

  return (
    <div>
      <div className="mx-auto max-w-2xl px-4 pt-5">
        <Link
          href="/"
          className="mb-2 inline-flex items-center gap-1 text-callout font-medium text-ink-secondary hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {copy.backToRoutes}
        </Link>
        <h1 className="text-title-lg text-ink">{route.name}</h1>
        <p className="text-callout text-ink-secondary">
          {route.originLabel} → {route.destinationLabel}
        </p>
      </div>

      <RouteLiveView
        routeName={route.name}
        routeSlug={route.slug}
        variants={route.variants}
        initialBuses={live?.buses ?? []}
      />
    </div>
  );
}
