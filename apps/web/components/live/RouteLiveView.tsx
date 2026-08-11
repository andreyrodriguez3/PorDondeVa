'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { PublicBusUpdate, PublicVariant } from '@tubus/contracts';
import { useLiveBuses } from '@/lib/useLiveBuses';
import { copy } from '@/lib/copy';
import { LiveStatusBadge } from './LiveStatusBadge';
import { ConnectionBanner } from './ConnectionBanner';

const MapView = dynamic(() => import('../map/MapView').then((m) => m.MapView), { ssr: false });

interface RouteLiveViewProps {
  routeSlug: string;
  variants: PublicVariant[];
  initialBuses: PublicBusUpdate[];
}

function pickDefaultVariant(variants: PublicVariant[], buses: PublicBusUpdate[]): string {
  const withActiveBus = variants.find((v) => buses.some((b) => b.routeVariantId === v.id));
  if (withActiveBus) return withActiveBus.id;
  return (variants.find((v) => v.isDefault) ?? variants[0])!.id;
}

export function RouteLiveView({ routeSlug, variants, initialBuses }: RouteLiveViewProps) {
  // Subscribing to the route joins the rooms of all its variants (A23), so the
  // selector below only ever filters what's already been received — it never
  // triggers a new subscription.
  const { buses, connectionDegraded } = useLiveBuses(routeSlug, initialBuses);
  const [selectedVariantId, setSelectedVariantId] = useState(() =>
    pickDefaultVariant(variants, initialBuses),
  );

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? variants[0]!;
  const busesForVariant = useMemo(
    () => buses.filter((b) => b.routeVariantId === selectedVariantId),
    [buses, selectedVariantId],
  );

  return (
    <div>
      <ConnectionBanner degraded={connectionDegraded} />

      {variants.length > 1 ? (
        <div className="mx-auto flex max-w-2xl gap-2 px-4 pt-4">
          {variants.map((variant) => (
            <button
              key={variant.id}
              type="button"
              onClick={() => setSelectedVariantId(variant.id)}
              className={`rounded-full border px-3 py-1 text-sm ${
                variant.id === selectedVariantId
                  ? 'border-brand bg-brand text-white'
                  : 'border-gray-300 text-gray-700'
              }`}
            >
              {variant.headsign}
            </button>
          ))}
        </div>
      ) : null}

      <MapView
        geometry={selectedVariant.geometry}
        stops={selectedVariant.stops}
        buses={busesForVariant}
      />

      <div className="mx-auto max-w-2xl px-4 py-4">
        {busesForVariant.length === 0 ? (
          <p className="text-gray-500">{copy.noActiveBuses}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {busesForVariant.map((bus) => (
              <li
                key={bus.tripId}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
              >
                <span className="font-medium">{bus.busLabel}</span>
                <LiveStatusBadge bus={bus} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
