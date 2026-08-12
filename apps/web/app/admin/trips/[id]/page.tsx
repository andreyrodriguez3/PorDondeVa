'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { LocationHistoryPoint, TripResponse } from '@tubus/contracts';
import { adminFetch } from '@/lib/adminAuth';
import { AdminShell } from '@/components/admin/AdminShell';
import { useToast } from '@/components/ui/Toast';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

const MapView = dynamic(() => import('@/components/map/MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const STATUS_TONE = {
  ACTIVE: 'live',
  COMPLETED: 'neutral',
  CANCELLED: 'danger',
  SCHEDULED: 'stale',
} as const;

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activo',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
  SCHEDULED: 'Programado',
};

export default function TripDetailPage({ params }: { params: { id: string } }) {
  return (
    <AdminShell>
      <TripDetailContent tripId={params.id} />
    </AdminShell>
  );
}

function TripDetailContent({ tripId }: { tripId: string }) {
  const toast = useToast();
  const [trip, setTrip] = useState<TripResponse | null>(null);
  const [history, setHistory] = useState<LocationHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [tripData, historyData] = await Promise.all([
        adminFetch<TripResponse>(`/trips/${tripId}`),
        adminFetch<LocationHistoryPoint[]>(`/trips/${tripId}/locations`),
      ]);
      setTrip(tripData);
      setHistory(historyData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tripId]);

  const geometry = useMemo(() => {
    if (history.length < 2) return null;
    return {
      type: 'LineString' as const,
      coordinates: history.map((p) => [p.longitude, p.latitude] as [number, number]),
    };
  }, [history]);

  const markers = useMemo(() => {
    if (history.length === 0) return [];
    const first = history[0]!;
    const last = history[history.length - 1]!;
    return [
      {
        id: 'start',
        name: 'Inicio del viaje',
        latitude: first.latitude,
        longitude: first.longitude,
        sequence: 1,
      },
      {
        id: 'end',
        name: 'Última posición registrada',
        latitude: last.latitude,
        longitude: last.longitude,
        sequence: 2,
      },
    ];
  }, [history]);

  async function handleEndTrip() {
    setEnding(true);
    try {
      await adminFetch(`/trips/${tripId}/end`, { method: 'POST' });
      toast.show('Viaje finalizado', 'success');
      setConfirmEnd(false);
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo finalizar el viaje.', 'error');
    } finally {
      setEnding(false);
    }
  }

  if (loading || !trip) {
    return (
      <div>
        <Skeleton className="mb-4 h-8 w-64" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/trips"
        className="mb-3 inline-block text-callout font-medium text-ink-secondary hover:text-ink"
      >
        ← Todos los viajes
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-title-lg text-ink">
              {trip.busLabel} — {trip.routeName}
            </h1>
            <Badge tone={STATUS_TONE[trip.status]}>
              {STATUS_LABEL[trip.status] ?? trip.status}
            </Badge>
          </div>
          <p className="text-callout text-ink-secondary">
            {trip.variantHeadsign} · conductor {trip.driverName}
          </p>
        </div>
        {trip.status === 'ACTIVE' ? (
          <Button variant="danger" onClick={() => setConfirmEnd(true)}>
            Finalizar viaje
          </Button>
        ) : null}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Inicio" value={new Date(trip.startedAt).toLocaleString('es-CR')} />
        <SummaryCard
          label="Fin"
          value={trip.endedAt ? new Date(trip.endedAt).toLocaleString('es-CR') : '—'}
        />
        <SummaryCard label="Puntos registrados" value={String(history.length)} />
        <SummaryCard
          label="Puntos rechazados"
          value={String(trip.rejectedPointCount)}
          tone={trip.rejectedPointCount > 0 ? 'danger' : undefined}
        />
      </div>

      {geometry ? (
        <div className="h-[60vh] overflow-hidden rounded-lg border border-line shadow-elevate-1">
          <MapView geometry={geometry} stops={markers} buses={[]} className="h-full" />
        </div>
      ) : (
        <EmptyState
          title="Sin recorrido registrado"
          description="Este viaje no tiene suficientes puntos de ubicación para dibujar un recorrido."
        />
      )}

      <ConfirmDialog
        open={confirmEnd}
        title="¿Finalizar este viaje?"
        description="El viaje se marcará como completado y dejará de aparecer para los pasajeros. Esta acción no se puede deshacer."
        confirmLabel={ending ? 'Finalizando…' : 'Finalizar viaje'}
        onConfirm={handleEndTrip}
        onCancel={() => setConfirmEnd(false)}
      />
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <Card className="p-3.5">
      <p className="text-micro font-semibold uppercase tracking-wide text-ink-tertiary">{label}</p>
      <p className={`mt-1 text-title ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}>{value}</p>
    </Card>
  );
}
