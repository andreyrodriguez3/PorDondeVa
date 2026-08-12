'use client';

import { useEffect, useState } from 'react';
import type { BusResponse, DriverResponse } from '@tubus/contracts';
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
import { DriverIcon } from '@/components/admin/icons';

export default function DriversPage() {
  return (
    <AdminShell>
      <DriversContent />
    </AdminShell>
  );
}

function DriversContent() {
  const toast = useToast();
  const [drivers, setDrivers] = useState<DriverResponse[]>([]);
  const [buses, setBuses] = useState<BusResponse[]>([]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [defaultBusId, setDefaultBusId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [driverList, busList] = await Promise.all([
        adminFetch<DriverResponse[]>('/drivers'),
        adminFetch<BusResponse[]>('/buses'),
      ]);
      setDrivers(driverList);
      setBuses(busList);
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
      await adminFetch('/drivers', {
        method: 'POST',
        body: { name, username, password, defaultBusId: defaultBusId || undefined },
      });
      setName('');
      setUsername('');
      setPassword('');
      setDefaultBusId('');
      toast.show(`Conductor "${name}" agregado`, 'success');
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo crear el conductor.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Conductores"
        description="Quiénes pueden iniciar sesión en la app del chofer."
      />

      <Card className="mb-6 p-4">
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Input label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="w-36">
            <Input
              label="Usuario"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Input
              label="Contraseña"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <label className="block w-40 text-callout text-ink-secondary">
            <span className="mb-1.5 block font-medium text-ink">Bus asignado</span>
            <select
              value={defaultBusId}
              onChange={(e) => setDefaultBusId(e.target.value)}
              className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-body text-ink focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
            >
              <option value="">—</option>
              {buses.map((bus) => (
                <option key={bus.id} value={bus.id}>
                  {bus.label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" loading={submitting}>
            Agregar conductor
          </Button>
        </form>
      </Card>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : drivers.length === 0 ? (
        <EmptyState
          icon={<DriverIcon />}
          title="Todavía no hay conductores"
          description="Agregá el primero con el formulario de arriba."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nombre</TH>
              <TH>Usuario</TH>
              <TH>Bus asignado</TH>
              <TH>Estado</TH>
            </TR>
          </THead>
          <TBody>
            {drivers.map((driver) => (
              <TR key={driver.id}>
                <TD className="font-medium">{driver.name}</TD>
                <TD className="text-ink-secondary">{driver.username}</TD>
                <TD className="text-ink-secondary">
                  {buses.find((b) => b.id === driver.defaultBusId)?.label ?? '—'}
                </TD>
                <TD>
                  <Badge tone={driver.status === 'ACTIVE' ? 'live' : 'neutral'}>
                    {driver.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
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
