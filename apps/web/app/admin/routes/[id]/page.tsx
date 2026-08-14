'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type {
  RouteResponse,
  RouteVariantResponse,
  ScheduleResponse,
  StopResponse,
} from '@tubus/contracts';
import { adminFetch } from '@/lib/adminAuth';
import { AdminShell } from '@/components/admin/AdminShell';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { copy } from '@/lib/copy';

const MapView = dynamic(() => import('@/components/map/MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export default function RouteDetailPage({ params }: { params: { id: string } }) {
  return (
    <AdminShell>
      <RouteDetailContent routeId={params.id} />
    </AdminShell>
  );
}

function RouteDetailContent({ routeId }: { routeId: string }) {
  const toast = useToast();
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [variants, setVariants] = useState<RouteVariantResponse[]>([]);
  const [allStops, setAllStops] = useState<StopResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [variantName, setVariantName] = useState('');
  const [direction, setDirection] = useState<'OUTBOUND' | 'INBOUND'>('OUTBOUND');
  const [headsign, setHeadsign] = useState('');
  const [geometryJson, setGeometryJson] = useState(
    '{\n  "type": "LineString",\n  "coordinates": [[-84.08, 9.93], [-84.43, 10.06]]\n}',
  );

  async function load() {
    setLoading(true);
    try {
      const [routeData, variantList, stopList] = await Promise.all([
        adminFetch<RouteResponse>(`/routes/${routeId}`),
        adminFetch<RouteVariantResponse[]>(`/routes/${routeId}/variants`),
        adminFetch<StopResponse[]>('/stops'),
      ]);
      setRoute(routeData);
      setVariants(variantList);
      setAllStops(stopList);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [routeId]);

  async function handleCreateVariant(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const geometry = JSON.parse(geometryJson);
      await adminFetch(`/routes/${routeId}/variants`, {
        method: 'POST',
        body: { name: variantName, direction, headsign, geometry },
      });
      setVariantName('');
      setHeadsign('');
      toast.show('Variante creada', 'success');
      await load();
    } catch (err) {
      toast.show(
        err instanceof SyntaxError
          ? 'La geometría no es JSON válido.'
          : err instanceof Error
            ? err.message
            : 'No se pudo crear la variante.',
        'error',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !route) {
    return (
      <div>
        <Skeleton className="mb-2 h-8 w-64" />
        <Skeleton className="mb-6 h-4 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/routes"
        className="mb-3 inline-block text-callout font-medium text-ink-secondary hover:text-ink"
      >
        ← Todas las rutas
      </Link>
      <h1 className="text-title-lg text-ink">{route.name}</h1>
      <p className="mb-6 text-callout text-ink-secondary">
        {route.originLabel} → {route.destinationLabel} · /{route.publicSlug}
      </p>

      <h2 className="mb-2 text-title text-ink">Variantes</h2>
      <Card className="mb-6 p-4">
        <form onSubmit={handleCreateVariant} className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <div className="w-44">
              <Input
                label="Nombre"
                required
                value={variantName}
                onChange={(e) => setVariantName(e.target.value)}
              />
            </div>
            <label className="block w-36 text-callout text-ink-secondary">
              <span className="mb-1.5 block font-medium text-ink">Dirección</span>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'OUTBOUND' | 'INBOUND')}
                className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-body text-ink focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
              >
                <option value="OUTBOUND">Ida</option>
                <option value="INBOUND">Vuelta</option>
              </select>
            </label>
            <div className="w-44">
              <Input
                label="Rótulo (headsign)"
                required
                value={headsign}
                onChange={(e) => setHeadsign(e.target.value)}
                placeholder="Hacia Palmares"
              />
            </div>
          </div>
          <label className="block text-callout text-ink-secondary">
            <span className="mb-1.5 block font-medium text-ink">
              Geometría (GeoJSON LineString)
            </span>
            <textarea
              required
              rows={4}
              value={geometryJson}
              onChange={(e) => setGeometryJson(e.target.value)}
              className="block w-full rounded-md border border-line bg-surface px-3 py-2 font-mono text-caption text-ink focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
            />
          </label>
          <Button type="submit" loading={submitting} className="w-fit">
            Crear variante
          </Button>
        </form>
      </Card>

      <div className="flex flex-col gap-4">
        {variants.map((variant) => (
          <VariantCard key={variant.id} variant={variant} allStops={allStops} onChange={load} />
        ))}
      </div>
    </div>
  );
}

function VariantCard({
  variant,
  allStops,
  onChange,
}: {
  variant: RouteVariantResponse;
  allStops: StopResponse[];
  onChange: () => void;
}) {
  const toast = useToast();
  const [stops, setStops] = useState<(StopResponse & { sequence: number })[]>([]);
  const [schedules, setSchedules] = useState<ScheduleResponse[]>([]);
  const [stopToAdd, setStopToAdd] = useState('');
  const [departureTime, setDepartureTime] = useState('06:00');
  const [daysOfWeek, setDaysOfWeek] = useState('1,2,3,4,5');
  const [expanded, setExpanded] = useState(false);
  const [stopToDetach, setStopToDetach] = useState<{ id: string; name: string } | null>(null);
  const [scheduleToRemove, setScheduleToRemove] = useState<{ id: string; label: string } | null>(
    null,
  );

  async function load() {
    const [stopList, scheduleList] = await Promise.all([
      adminFetch<(StopResponse & { sequence: number })[]>(`/variants/${variant.id}/stops`),
      adminFetch<ScheduleResponse[]>(`/variants/${variant.id}/schedules`),
    ]);
    setStops(stopList);
    setSchedules(scheduleList);
  }

  useEffect(() => {
    load();
  }, [variant.id]);

  async function handleAttachStop(e: React.FormEvent) {
    e.preventDefault();
    if (!stopToAdd) return;
    try {
      await adminFetch(`/variants/${variant.id}/stops`, {
        method: 'POST',
        body: { stopId: stopToAdd },
      });
      setStopToAdd('');
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo agregar la parada.', 'error');
    }
  }

  async function handleDetachStop() {
    if (!stopToDetach) return;
    try {
      await adminFetch(`/variants/${variant.id}/stops/${stopToDetach.id}`, { method: 'DELETE' });
      setStopToDetach(null);
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo quitar la parada.', 'error');
    }
  }

  async function handleAddSchedule(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminFetch(`/variants/${variant.id}/schedules`, {
        method: 'POST',
        body: { departureTime, daysOfWeek: daysOfWeek.split(',').map((d) => Number(d.trim())) },
      });
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo agregar el horario.', 'error');
    }
  }

  async function handleRemoveSchedule() {
    if (!scheduleToRemove) return;
    try {
      await adminFetch(`/schedules/${scheduleToRemove.id}`, { method: 'DELETE' });
      setScheduleToRemove(null);
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo quitar el horario.', 'error');
    }
  }

  return (
    <Card className="p-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <h3 className="font-medium text-ink">
          {variant.name} — {variant.headsign}
          <span className="ml-2 text-caption text-ink-tertiary">
            {stops.length} paradas · {schedules.length} horarios
          </span>
        </h3>
        <span className={`text-ink-tertiary transition-transform ${expanded ? 'rotate-180' : ''}`}>
          ⌄
        </span>
      </button>

      {expanded ? (
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <div className="h-56 overflow-hidden rounded-md border border-line">
            <MapView geometry={variant.geometry} stops={stops} buses={[]} className="h-full" />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <h4 className="mb-2 text-callout font-semibold text-ink-secondary">Paradas</h4>
              <ul className="mb-3 flex flex-col gap-1">
                {stops.map((stop) => (
                  <li key={stop.id} className="flex items-center justify-between text-callout">
                    <span className="text-ink">
                      {stop.sequence}. {stop.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStopToDetach({ id: stop.id, name: stop.name })}
                      className="text-caption text-ink-tertiary hover:text-danger"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
              <form onSubmit={handleAttachStop} className="flex gap-2">
                <select
                  value={stopToAdd}
                  onChange={(e) => setStopToAdd(e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-callout text-ink"
                >
                  <option value="">Agregar parada…</option>
                  {allStops
                    .filter((s) => !stops.some((existing) => existing.id === s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
                <Button type="submit" size="sm" variant="secondary">
                  Agregar
                </Button>
              </form>
            </div>

            <div>
              <h4 className="mb-2 text-callout font-semibold text-ink-secondary">Horarios</h4>
              <ul className="mb-3 flex flex-col gap-1">
                {schedules.map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-callout">
                    <span className="text-ink">
                      {s.departureTime} — {copy.daysOfWeek(s.daysOfWeek)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setScheduleToRemove({
                          id: s.id,
                          label: `${s.departureTime} — ${copy.daysOfWeek(s.daysOfWeek)}`,
                        })
                      }
                      className="text-caption text-ink-tertiary hover:text-danger"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
              <form onSubmit={handleAddSchedule} className="flex flex-wrap gap-2">
                <input
                  type="time"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="rounded-md border border-line bg-surface px-2 py-1.5 text-callout text-ink"
                />
                <input
                  value={daysOfWeek}
                  onChange={(e) => setDaysOfWeek(e.target.value)}
                  className="w-24 rounded-md border border-line bg-surface px-2 py-1.5 text-callout text-ink"
                  title="Días (0=domingo)"
                />
                <Button type="submit" size="sm" variant="secondary">
                  Agregar horario
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {expanded ? (
        <button
          type="button"
          onClick={onChange}
          className="mt-3 text-caption text-ink-tertiary hover:text-ink"
        >
          Actualizar datos
        </button>
      ) : null}

      <ConfirmDialog
        open={stopToDetach !== null}
        title="¿Quitar esta parada de la ruta?"
        description={
          stopToDetach ? `"${stopToDetach.name}" dejará de aparecer en esta variante.` : undefined
        }
        confirmLabel="Quitar"
        onConfirm={handleDetachStop}
        onCancel={() => setStopToDetach(null)}
      />
      <ConfirmDialog
        open={scheduleToRemove !== null}
        title="¿Quitar este horario?"
        description={scheduleToRemove ? `"${scheduleToRemove.label}" se eliminará.` : undefined}
        confirmLabel="Quitar"
        onConfirm={handleRemoveSchedule}
        onCancel={() => setScheduleToRemove(null)}
      />
    </Card>
  );
}
