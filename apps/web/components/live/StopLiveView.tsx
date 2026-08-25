'use client';

import type { PublicApproachingBus, PublicStopRoute } from '@tubus/contracts';
import { useStopLive } from '@/lib/useStopLive';
import { copy } from '@/lib/copy';
import { ConnectionBanner } from './ConnectionBanner';
import { LiveStatusBadge } from './LiveStatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';

function BusMiniIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 16.5V6.8C4 5.25 5.3 4 6.9 4h10.2C18.7 4 20 5.25 20 6.8v9.7c0 1.05-.86 1.9-1.93 1.9H5.93A1.93 1.93 0 0 1 4 16.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="7.6" cy="19" r="1.4" fill="currentColor" />
      <circle cx="16.4" cy="19" r="1.4" fill="currentColor" />
    </svg>
  );
}

function ApproachingBusRow({ bus }: { bus: PublicApproachingBus }) {
  // Same rule as RouteLiveView's EtaLabel (D19) — an ETA computed from a stale or
  // offline fix is more likely to mislead than help, and on this screen the ETA *is*
  // the content, so a stale bus needs its status called out, not silently omitted.
  const isLive = bus.state === 'LIVE';
  const minutes = isLive && bus.etaSeconds !== null ? Math.round(bus.etaSeconds / 60) : null;
  const etaLabel =
    minutes === null ? null : minutes < 1 ? copy.etaArriving : copy.etaMinutes(minutes);

  return (
    <li className="flex items-center justify-between rounded-lg border border-line bg-surface px-3.5 py-3">
      <div>
        <p className="font-medium text-ink">{bus.busLabel}</p>
        <p className="text-caption text-ink-tertiary">
          {bus.routeName} · {bus.headsign}
        </p>
      </div>
      {etaLabel ? (
        <span className="text-title font-semibold text-brand">{etaLabel}</span>
      ) : (
        <LiveStatusBadge bus={bus} />
      )}
    </li>
  );
}

interface StopLiveViewProps {
  stopName: string;
  stopId: string;
  routes: PublicStopRoute[];
  initialApproaching: PublicApproachingBus[];
}

export function StopLiveView({ stopName, stopId, routes, initialApproaching }: StopLiveViewProps) {
  const { approaching, connectionDegraded } = useStopLive(stopId, routes, initialApproaching);

  return (
    <div>
      <ConnectionBanner degraded={connectionDegraded} />

      <div className="mx-auto max-w-2xl px-4 py-5">
        <h2 className="mb-2 text-title text-ink">{copy.approachingHeading}</h2>
        {approaching.length === 0 ? (
          <EmptyState
            icon={<BusMiniIcon />}
            title={copy.noApproachingBuses}
            description={copy.noApproachingBusesHint}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {approaching.map((bus) => (
              <ApproachingBusRow key={bus.tripId} bus={bus} />
            ))}
          </ul>
        )}
      </div>

      {routes.length > 0 ? (
        <div className="mx-auto max-w-2xl px-4 pb-10">
          <h2 className="mb-2 text-title text-ink">{copy.busesHeading}</h2>
          <p className="text-callout text-ink-secondary">
            {stopName} · {routes.map((r) => r.routeName).join(', ')}
          </p>
        </div>
      ) : null}
    </div>
  );
}
