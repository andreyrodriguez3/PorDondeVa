import { headers } from 'next/headers';
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
      <div className="mx-auto max-w-2xl px-4 pb-2 pt-6">
        <h1 className="text-xl font-semibold">{route.name}</h1>
        <p className="text-sm text-gray-500">
          {route.originLabel} → {route.destinationLabel}
        </p>
      </div>

      <RouteLiveView
        routeSlug={route.slug}
        variants={route.variants}
        initialBuses={live?.buses ?? []}
      />

      <div className="mx-auto max-w-2xl px-4 pb-8">
        <h2 className="mb-2 text-base font-semibold">{copy.stopsHeading}</h2>
        <ol className="flex flex-col gap-1 text-sm text-gray-700">
          {route.variants
            .find((v) => v.isDefault)
            ?.stops.map((stop) => (
              <li key={stop.id}>{stop.name}</li>
            ))}
        </ol>
      </div>
    </div>
  );
}
