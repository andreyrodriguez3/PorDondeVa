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

// A gap between two consecutive fixes this long, or a jump implying a speed this
// high, means the device dropped off and reconnected (backgrounding, a relaunch, a
// dead trip resumed from scratch) rather than genuinely continuing — draw it as a
// break in the path instead of a straight chord across the gap. Without this, one
// long-lived trip that restarts partway through renders as a spurious wedge fanning
// out from the restart point instead of a track that traces the road.
const MAX_GAP_MS = 2 * 60 * 1000; // 2 minutes
const MAX_IMPLIED_SPEED_MPS = 55; // ~200 km/h — generous for a bus, still catches teleports

function haversineMeters(a: LocationHistoryPoint, b: LocationHistoryPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusM = 6_371_000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.sqrt(h));
}

function buildPlaybackGeometry(history: LocationHistoryPoint[]) {
  const segments: [number, number][][] = [];
  let current: [number, number][] = [];

  for (let i = 0; i < history.length; i++) {
    const point = history[i]!;
    const prev = history[i - 1];
    if (prev) {
      const gapMs =
        new Date(point.deviceTimestamp).getTime() - new Date(prev.deviceTimestamp).getTime();
      const impliedSpeedMps = haversineMeters(prev, point) / (gapMs / 1000);
      if (gapMs > MAX_GAP_MS || impliedSpeedMps > MAX_IMPLIED_SPEED_MPS) {
        if (current.length >= 2) segments.push(current);
        current = [];
      }
    }
    current.push([point.longitude, point.latitude]);
  }
  if (current.length >= 2) segments.push(current);

  if (segments.length === 0) return null;
  if (segments.length === 1) return { type: 'LineString' as const, coordinates: segments[0]! };
  return { type: 'MultiLineString' as const, coordinates: segments };
}

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
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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

  const geometry = useMemo(() => buildPlaybackGeometry(history), [history]);

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

  async function handleCancelTrip() {
    setCancelling(true);
    try {
      await adminFetch(`/trips/${tripId}/cancel`, { method: 'POST' });
      toast.show('Viaje cancelado', 'success');
      setConfirmCancel(false);
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo cancelar el viaje.', 'error');
    } finally {
      setCancelling(false);
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
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirmCancel(true)}>
              Cancelar viaje
            </Button>
            <Button variant="danger" onClick={() => setConfirmEnd(true)}>
              Finalizar viaje
            </Button>
          </div>
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
        open={confirmCancel}
        title="¿Cancelar este viaje?"
        description='Solo funciona si todavía no tiene puntos GPS registrados — si el bus ya se movió, usá "Finalizar viaje" en su lugar.'
        confirmLabel={cancelling ? 'Cancelando…' : 'Cancelar viaje'}
        onConfirm={handleCancelTrip}
        onCancel={() => setConfirmCancel(false)}
      />
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
