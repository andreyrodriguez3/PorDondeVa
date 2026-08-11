'use client';

import { useEffect, useState } from 'react';
import type { PublicBusUpdate } from '@tubus/contracts';
import { adminFetch } from '@/lib/adminAuth';
import { AdminShell } from '@/components/admin/AdminShell';
import { LiveStatusBadge } from '@/components/live/LiveStatusBadge';

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
    <div className="max-w-3xl">
      <h1 className="mb-4 text-xl font-semibold">Flota en vivo</h1>
      {loading ? (
        <p className="text-gray-500">Cargando…</p>
      ) : fleet.length === 0 ? (
        <p className="text-gray-500">Ningún bus está circulando en este momento.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {fleet.map((bus) => (
            <li
              key={bus.tripId}
              className="flex items-center justify-between rounded border border-gray-200 px-4 py-3"
            >
              <div>
                <span className="font-medium">{bus.busLabel}</span>
                <span className="ml-2 text-sm text-gray-500">{bus.headsign}</span>
              </div>
              <LiveStatusBadge bus={bus} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
