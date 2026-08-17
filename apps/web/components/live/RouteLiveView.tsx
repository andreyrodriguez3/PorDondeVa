'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { PublicBusUpdate, PublicVariant } from '@tubus/contracts';
import { useLiveBuses } from '@/lib/useLiveBuses';
import { copy } from '@/lib/copy';
import { LiveStatusBadge } from './LiveStatusBadge';
import { ConnectionBanner } from './ConnectionBanner';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { ShareButton } from './ShareButton';

const MapView = dynamic(() => import('../map/MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="h-[56vh] w-full animate-pulse bg-surface-tertiary sm:h-[60vh]" />,
});

interface RouteLiveViewProps {
  routeName: string;
  routeSlug: string;
  variants: PublicVariant[];
  initialBuses: PublicBusUpdate[];
}

function pickDefaultVariant(variants: PublicVariant[], buses: PublicBusUpdate[]): string {
  const withActiveBus = variants.find((v) => buses.some((b) => b.routeVariantId === v.id));
  if (withActiveBus) return withActiveBus.id;
  return (variants.find((v) => v.isDefault) ?? variants[0])!.id;
}

/** Only shown for a LIVE bus (D19) — an ETA computed from a stale fix is more likely to
 * mislead than help, so it's withheld rather than shown next to a "sin señal" badge. */
function EtaLabel({ bus, nextStopName }: { bus: PublicBusUpdate; nextStopName?: string }) {
  if (bus.state !== 'LIVE' || bus.etaSeconds === null) return null;
  const minutes = Math.round(bus.etaSeconds / 60);
  const label = minutes < 1 ? copy.etaArriving : copy.etaMinutes(minutes);
  return (
    <span className="text-caption text-ink-tertiary">
      {label}
      {nextStopName ? ` · ${nextStopName}` : ''}
    </span>
  );
}

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

export function RouteLiveView({
  routeName,
  routeSlug,
  variants,
  initialBuses,
}: RouteLiveViewProps) {
  // Subscribing to the route joins the rooms of all its variants (A23), so the
  // selector below only ever filters what's already been received — it never
  // triggers a new subscription.
  const { buses, connectionDegraded } = useLiveBuses(routeSlug, initialBuses);
  const [selectedVariantId, setSelectedVariantId] = useState(() =>
    pickDefaultVariant(variants, initialBuses),
  );
  const [focusTripId, setFocusTripId] = useState<string | null>(null);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? variants[0]!;
  const busesForVariant = useMemo(
    () => buses.filter((b) => b.routeVariantId === selectedVariantId),
    [buses, selectedVariantId],
  );
  const stopNameById = useMemo(
    () => new Map(selectedVariant.stops.map((s) => [s.id, s.name])),
    [selectedVariant],
  );

  return (
    <div>
      <ConnectionBanner degraded={connectionDegraded} />

      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4">
        {variants.length > 1 ? (
          <SegmentedControl
            options={variants.map((v) => ({ id: v.id, label: v.headsign }))}
            value={selectedVariantId}
            onChange={(id) => {
              setSelectedVariantId(id);
              setFocusTripId(null);
            }}
          />
        ) : (
          <span className="text-callout font-medium text-ink-secondary">
            {selectedVariant.headsign}
          </span>
        )}
        <ShareButton routeName={routeName} />
      </div>

      <MapView
        geometry={selectedVariant.geometry}
        stops={selectedVariant.stops}
        buses={busesForVariant}
        className="h-[56vh] sm:h-[60vh]"
        onSelectBus={setFocusTripId}
        focusTripId={focusTripId}
      />

      <div className="mx-auto max-w-2xl px-4 py-5">
        <h2 className="mb-2 text-title text-ink">{copy.busesHeading}</h2>
        {busesForVariant.length === 0 ? (
          <EmptyState
            icon={<BusMiniIcon />}
            title={copy.noActiveBuses}
            description={copy.noActiveBusesHint}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {busesForVariant.map((bus) => (
              <li key={bus.tripId}>
                <button
                  type="button"
                  onClick={() => setFocusTripId(bus.tripId)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left transition-colors duration-150 active:scale-[0.99] ${
                    focusTripId === bus.tripId
                      ? 'border-brand/50 bg-brand/5'
                      : 'border-line bg-surface hover:border-line-strong'
                  }`}
                >
                  <span className="flex flex-col">
                    <span className="font-medium text-ink">{bus.busLabel}</span>
                    <EtaLabel
                      bus={bus}
                      nextStopName={bus.nextStopId ? stopNameById.get(bus.nextStopId) : undefined}
                    />
                  </span>
                  <LiveStatusBadge bus={bus} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-4">
        <h2 className="mb-2 text-title text-ink">{copy.stopsHeading}</h2>
        <ol className="flex flex-col">
          {selectedVariant.stops.map((stop, i) => (
            <li key={stop.id} className="flex items-center gap-3 py-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-strong text-micro font-semibold text-ink-secondary">
                {stop.sequence}
              </span>
              <span className="text-body text-ink">{stop.name}</span>
              {i === selectedVariant.stops.length - 1 ? (
                <span className="text-caption text-ink-tertiary">· destino</span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-10">
        <h2 className="mb-2 text-title text-ink">{copy.scheduleHeading}</h2>
        {selectedVariant.schedules.length === 0 ? (
          <p className="text-callout text-ink-tertiary">{copy.scheduleEmpty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {selectedVariant.schedules.map((schedule, i) => (
              <li key={i} className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-body font-medium text-ink">{schedule.departureTime}</span>
                <span className="text-caption text-ink-tertiary">
                  {copy.daysOfWeek(schedule.daysOfWeek)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
