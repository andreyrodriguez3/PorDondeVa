'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
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
import { springOrFade } from '@/lib/motionPresets';

const MIN_PASSWORD_LENGTH = 10;

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
  const [resetTarget, setResetTarget] = useState<DriverResponse | null>(null);

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
              minLength={MIN_PASSWORD_LENGTH}
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
              <TH>&nbsp;</TH>
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
                <TD className="text-right">
                  <button
                    type="button"
                    onClick={() => setResetTarget(driver)}
                    className="text-caption font-medium text-ink-tertiary hover:text-brand"
                  >
                    Restablecer contraseña
                  </button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <ResetPasswordDialog
        driver={resetTarget}
        onClose={() => setResetTarget(null)}
        onDone={(name) => toast.show(`Contraseña de "${name}" actualizada`, 'success')}
      />
    </div>
  );
}

function ResetPasswordDialog({
  driver,
  onClose,
  onDone,
}: {
  driver: DriverResponse | null;
  onClose: () => void;
  onDone: (driverName: string) => void;
}) {
  const toast = useToast();
  const reduced = useReducedMotion();
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setNewPassword('');
  }, [driver]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!driver) return;
    setSubmitting(true);
    try {
      await adminFetch(`/drivers/${driver.id}/password`, {
        method: 'PATCH',
        body: { password: newPassword },
      });
      onDone(driver.name);
      onClose();
    } catch (err) {
      toast.show(
        err instanceof Error ? err.message : 'No se pudo restablecer la contraseña.',
        'error',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {driver ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-scrim backdrop-blur-[2px]"
            {...springOrFade(Boolean(reduced), {
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              exit: { opacity: 0 },
              transition: { duration: 0.18 },
            })}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            {...springOrFade(Boolean(reduced), {
              initial: { opacity: 0, scale: 0.94, y: 8 },
              animate: { opacity: 1, scale: 1, y: 0 },
              exit: { opacity: 0, scale: 0.96, y: 4 },
              transition: { type: 'spring', bounce: 0, duration: 0.3 },
            })}
            className="relative w-full max-w-sm rounded-lg bg-surface p-5 shadow-elevate-3"
          >
            <h2 className="text-title text-ink">Restablecer contraseña</h2>
            <p className="mt-1.5 text-callout text-ink-secondary">
              Nueva contraseña para <span className="font-medium text-ink">{driver.name}</span>{' '}
              (usuario {driver.username}). Va a tener que cambiarla la próxima vez que inicie
              sesión.
            </p>
            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
              <Input
                label="Contraseña nueva"
                type="password"
                autoFocus
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" loading={submitting}>
                  Restablecer
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
