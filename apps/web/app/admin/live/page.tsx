'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { PublicBusUpdate } from '@tubus/contracts';
import { adminFetch } from '@/lib/adminAuth';
import { AdminShell } from '@/components/admin/AdminShell';
import { PageHeader } from '@/components/admin/PageHeader';
import { LiveStatusBadge } from '@/components/live/LiveStatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { LiveIcon } from '@/components/admin/icons';

const MapView = dynamic(() => import('@/components/map/MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const REFRESH_MS = 5000;

export default function LiveFleetPage() {
  return (
    <AdminShell>
      <LiveFleetContent />
    </AdminShell>
  );
}

function LiveFleetContent() {
  const [fleet, setFleet] = useState<PublicBusUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusTripId, setFocusTripId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await adminFetch<PublicBusUpdate[]>('/live/fleet');
        if (!cancelled) setFleet(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div>
      <PageHeader title="Flota en vivo" description="Todos los buses circulando ahora mismo." />

      {loading ? (
        <Skeleton className="h-[60vh] w-full" />
      ) : fleet.length === 0 ? (
        <EmptyState
          icon={<LiveIcon />}
          title="Ningún bus está circulando"
          description="Los buses aparecerán aquí en cuanto un conductor inicie un viaje."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="h-[60vh] overflow-hidden rounded-lg border border-line shadow-elevate-1">
            <MapView
              buses={fleet}
              className="h-full"
              onSelectBus={setFocusTripId}
              focusTripId={focusTripId}
            />
          </div>
          <ul className="flex flex-col gap-2">
            {fleet.map((bus) => (
              <li key={bus.tripId}>
                <button
                  type="button"
                  onClick={() => setFocusTripId(bus.tripId)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left transition-colors duration-150 ${
                    focusTripId === bus.tripId
                      ? 'border-brand/50 bg-brand/5'
                      : 'border-line bg-surface hover:border-line-strong'
                  }`}
                >
                  <span>
                    <span className="block font-medium text-ink">{bus.busLabel}</span>
                    <span className="block text-caption text-ink-secondary">{bus.headsign}</span>
                  </span>
                  <LiveStatusBadge bus={bus} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
