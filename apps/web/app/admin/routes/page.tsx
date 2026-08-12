'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { RouteResponse } from '@tubus/contracts';
import { adminFetch } from '@/lib/adminAuth';
import { AdminShell } from '@/components/admin/AdminShell';
import { PageHeader } from '@/components/admin/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { RouteIcon } from '@/components/admin/icons';

export default function RoutesPage() {
  return (
    <AdminShell>
      <RoutesContent />
    </AdminShell>
  );
}

function RoutesContent() {
  const toast = useToast();
  const [routes, setRoutes] = useState<RouteResponse[]>([]);
  const [name, setName] = useState('');
  const [originLabel, setOriginLabel] = useState('');
  const [destinationLabel, setDestinationLabel] = useState('');
  const [publicSlug, setPublicSlug] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setRoutes(await adminFetch<RouteResponse[]>('/routes'));
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
      await adminFetch('/routes', {
        method: 'POST',
        body: { name, originLabel, destinationLabel, publicSlug },
      });
      setName('');
      setOriginLabel('');
      setDestinationLabel('');
      setPublicSlug('');
      toast.show(`Ruta "${name}" creada`, 'success');
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo crear la ruta.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Rutas" description="Cada ruta tiene una o más variantes direccionales." />

      <Card className="mb-6 p-4">
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <Input label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="w-36">
            <Input
              label="Origen"
              required
              value={originLabel}
              onChange={(e) => setOriginLabel(e.target.value)}
            />
          </div>
          <div className="w-36">
            <Input
              label="Destino"
              required
              value={destinationLabel}
              onChange={(e) => setDestinationLabel(e.target.value)}
            />
          </div>
          <div className="w-44">
            <Input
              label="Slug público"
              required
              pattern="[a-z0-9-]+"
              value={publicSlug}
              onChange={(e) => setPublicSlug(e.target.value)}
              placeholder="sanjose-palmares"
            />
          </div>
          <Button type="submit" loading={submitting}>
            Crear ruta
          </Button>
        </form>
      </Card>

      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : routes.length === 0 ? (
        <EmptyState
          icon={<RouteIcon />}
          title="Todavía no hay rutas"
          description="Creá la primera con el formulario de arriba."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {routes.map((route) => (
            <li key={route.id}>
              <Link
                href={`/routes/${route.id}`}
                className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 shadow-elevate-1 transition-colors hover:border-brand/40"
              >
                <span>
                  <span className="font-medium text-ink">{route.name}</span>
                  <span className="ml-2 text-callout text-ink-secondary">
                    {route.originLabel} → {route.destinationLabel}
                  </span>
                </span>
                <span className="text-caption text-ink-tertiary">/{route.publicSlug}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
