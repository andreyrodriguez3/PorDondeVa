'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { TripResponse } from '@tubus/contracts';
import { adminFetch } from '@/lib/adminAuth';
import { AdminShell } from '@/components/admin/AdminShell';
import { PageHeader } from '@/components/admin/PageHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { TripsIcon } from '@/components/admin/icons';

const STATUS_OPTIONS = [
  { id: '', label: 'Todos' },
  { id: 'ACTIVE', label: 'Activos' },
  { id: 'COMPLETED', label: 'Completados' },
  { id: 'CANCELLED', label: 'Cancelados' },
];

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

export default function TripsPage() {
  return (
    <AdminShell>
      <TripsContent />
    </AdminShell>
  );
}

function TripsContent() {
  const [trips, setTrips] = useState<TripResponse[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const query = status ? `?status=${status}` : '';
      setTrips(await adminFetch<TripResponse[]>(`/trips${query}`));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status]);

  return (
    <div>
      <PageHeader title="Viajes" description="Historial de viajes, en vivo y completados." />

      <div className="mb-4">
        <SegmentedControl options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : trips.length === 0 ? (
        <EmptyState icon={<TripsIcon />} title="No hay viajes en este filtro" />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Estado</TH>
              <TH>Bus</TH>
              <TH>Conductor</TH>
              <TH>Ruta</TH>
              <TH>Inicio</TH>
              <TH>Fin</TH>
              <TH>Rechazados</TH>
            </TR>
          </THead>
          <TBody>
            {trips.map((trip) => (
              <TR key={trip.id}>
                <TD>
                  <Badge tone={STATUS_TONE[trip.status]}>
                    {STATUS_LABEL[trip.status] ?? trip.status}
                  </Badge>
                </TD>
                <TD>
                  <Link
                    href={`/trips/${trip.id}`}
                    className="font-medium text-brand hover:underline"
                  >
                    {trip.busLabel}
                  </Link>
                </TD>
                <TD className="text-ink-secondary">{trip.driverName}</TD>
                <TD className="text-ink-secondary">
                  {trip.routeName} · {trip.variantHeadsign}
                </TD>
                <TD className="text-ink-secondary">
                  {new Date(trip.startedAt).toLocaleString('es-CR')}
                </TD>
                <TD className="text-ink-secondary">
                  {trip.endedAt ? new Date(trip.endedAt).toLocaleString('es-CR') : '—'}
                </TD>
                <TD className="text-ink-secondary">
                  {trip.rejectedPointCount > 0 ? (
                    <Badge tone="danger">{trip.rejectedPointCount}</Badge>
                  ) : (
                    '0'
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
