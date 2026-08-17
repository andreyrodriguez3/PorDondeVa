import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStopDetail, getStopLive } from '@/lib/api';
import { copy } from '@/lib/copy';
import { StopLiveView } from '@/components/live/StopLiveView';

function resolveHostname(): string {
  const h = headers();
  return (h.get('host') ?? '').split(':')[0]!;
}

export default async function StopPage({ params }: { params: { stopId: string } }) {
  const hostname = resolveHostname();
  const [stop, live] = await Promise.all([
    getStopDetail(hostname, params.stopId),
    getStopLive(hostname, params.stopId),
  ]);

  if (!stop) notFound();

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
        <h1 className="text-title-lg text-ink">{stop.name}</h1>
      </div>

      <StopLiveView
        stopName={stop.name}
        stopId={stop.id}
        routes={stop.routes}
        initialApproaching={live?.approaching ?? []}
      />
    </div>
  );
}
