'use client';

import { useEffect, useState } from 'react';
import type { StopResponse } from '@tubus/contracts';
import { adminFetch } from '@/lib/adminAuth';
import { AdminShell } from '@/components/admin/AdminShell';
import { PageHeader } from '@/components/admin/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { StopIcon } from '@/components/admin/icons';

export default function StopsPage() {
  return (
    <AdminShell>
      <StopsContent />
    </AdminShell>
  );
}

function StopsContent() {
  const toast = useToast();
  const [stops, setStops] = useState<StopResponse[]>([]);
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setStops(await adminFetch<StopResponse[]>('/stops'));
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
      await adminFetch('/stops', {
        method: 'POST',
        body: { name, latitude: Number(latitude), longitude: Number(longitude) },
      });
      setName('');
      setLatitude('');
      setLongitude('');
      toast.show(`Parada "${name}" agregada`, 'success');
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo crear la parada.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Paradas"
        description="Lugares físicos reutilizables entre variantes de ruta."
      />

      <Card className="mb-6 p-4">
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Input label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="w-32">
            <Input
              label="Latitud"
              required
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
            />
          </div>
          <div className="w-32">
            <Input
              label="Longitud"
              required
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
            />
          </div>
          <Button type="submit" loading={submitting}>
            Agregar parada
          </Button>
        </form>
      </Card>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : stops.length === 0 ? (
        <EmptyState
          icon={<StopIcon />}
          title="Todavía no hay paradas"
          description="Agregá la primera con el formulario de arriba."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nombre</TH>
              <TH>Latitud</TH>
              <TH>Longitud</TH>
            </TR>
          </THead>
          <TBody>
            {stops.map((stop) => (
              <TR key={stop.id}>
                <TD className="font-medium">{stop.name}</TD>
                <TD className="text-ink-secondary">{stop.latitude}</TD>
                <TD className="text-ink-secondary">{stop.longitude}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
