'use client';

import { useEffect, useState } from 'react';
import type { BusResponse } from '@tubus/contracts';
import { adminFetch } from '@/lib/adminAuth';
import { AdminShell } from '@/components/admin/AdminShell';
import { PageHeader } from '@/components/admin/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { BusIcon } from '@/components/admin/icons';

const STATUS_TONE = {
  ACTIVE: 'live',
  INACTIVE: 'neutral',
  MAINTENANCE: 'stale',
  RETIRED: 'danger',
} as const;

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  MAINTENANCE: 'Mantenimiento',
  RETIRED: 'Retirado',
};

export default function BusesPage() {
  return (
    <AdminShell>
      <BusesContent />
    </AdminShell>
  );
}

function BusesContent() {
  const toast = useToast();
  const [buses, setBuses] = useState<BusResponse[]>([]);
  const [label, setLabel] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setBuses(await adminFetch<BusResponse[]>('/buses'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminFetch('/buses', {
        method: 'POST',
        body: { label, licensePlate: licensePlate || undefined },
      });
      setLabel('');
      setLicensePlate('');
      toast.show(`Bus "${label}" agregado`, 'success');
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo crear el bus.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Buses" description="La flota física que tus conductores pueden usar." />

      <Card className="mb-6 p-4">
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Input
              label="Etiqueta"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Bus 24"
            />
          </div>
          <div className="w-40">
            <Input
              label="Placa"
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <Button type="submit" loading={submitting}>
            Agregar bus
          </Button>
        </form>
      </Card>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : buses.length === 0 ? (
        <EmptyState
          icon={<BusIcon />}
          title="Todavía no hay buses"
          description="Agregá el primero con el formulario de arriba."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Etiqueta</TH>
              <TH>Placa</TH>
              <TH>Estado</TH>
            </TR>
          </THead>
          <TBody>
            {buses.map((bus) => (
              <TR key={bus.id}>
                <TD className="font-medium">{bus.label}</TD>
                <TD className="text-ink-secondary">{bus.licensePlate ?? '—'}</TD>
                <TD>
                  <Badge tone={STATUS_TONE[bus.status as keyof typeof STATUS_TONE] ?? 'neutral'}>
                    {STATUS_LABEL[bus.status] ?? bus.status}
                  </Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
