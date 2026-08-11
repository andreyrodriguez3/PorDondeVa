'use client';

import { useEffect, useState } from 'react';
import type {
  RouteResponse,
  RouteVariantResponse,
  ScheduleResponse,
  StopResponse,
} from '@tubus/contracts';
import { adminFetch } from '@/lib/adminAuth';
import { AdminShell } from '@/components/admin/AdminShell';

export default function RouteDetailPage({ params }: { params: { id: string } }) {
  return (
    <AdminShell>
      <RouteDetailContent routeId={params.id} />
    </AdminShell>
  );
}

function RouteDetailContent({ routeId }: { routeId: string }) {
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [variants, setVariants] = useState<RouteVariantResponse[]>([]);
  const [allStops, setAllStops] = useState<StopResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [variantName, setVariantName] = useState('');
  const [direction, setDirection] = useState<'OUTBOUND' | 'INBOUND'>('OUTBOUND');
  const [headsign, setHeadsign] = useState('');
  const [geometryJson, setGeometryJson] = useState(
    '{\n  "type": "LineString",\n  "coordinates": [[-84.08, 9.93], [-84.43, 10.06]]\n}',
  );

  async function load() {
    const [routeData, variantList, stopList] = await Promise.all([
      adminFetch<RouteResponse>(`/routes/${routeId}`),
      adminFetch<RouteVariantResponse[]>(`/routes/${routeId}/variants`),
      adminFetch<StopResponse[]>('/stops'),
    ]);
    setRoute(routeData);
    setVariants(variantList);
    setAllStops(stopList);
  }

  useEffect(() => {
    load();
  }, [routeId]);

  async function handleCreateVariant(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const geometry = JSON.parse(geometryJson);
      await adminFetch(`/routes/${routeId}/variants`, {
        method: 'POST',
        body: { name: variantName, direction, headsign, geometry },
      });
      setVariantName('');
      setHeadsign('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la variante.');
    }
  }

  if (!route) return <p className="text-gray-500">Cargando…</p>;

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold">{route.name}</h1>
      <p className="mb-6 text-sm text-gray-500">
        {route.originLabel} → {route.destinationLabel}
      </p>

      <h2 className="mb-2 text-base font-semibold">Variantes</h2>
      <form
        onSubmit={handleCreateVariant}
        className="mb-6 flex flex-col gap-3 rounded border border-gray-200 p-4"
      >
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            Nombre
            <input
              required
              value={variantName}
              onChange={(e) => setVariantName(e.target.value)}
              className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            Dirección
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'OUTBOUND' | 'INBOUND')}
              className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="OUTBOUND">Ida</option>
              <option value="INBOUND">Vuelta</option>
            </select>
          </label>
          <label className="text-sm">
            Rótulo (headsign)
            <input
              required
              value={headsign}
              onChange={(e) => setHeadsign(e.target.value)}
              placeholder="Hacia Palmares"
              className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
          </label>
        </div>
        <label className="text-sm">
          Geometría (GeoJSON LineString)
          <textarea
            required
            rows={4}
            value={geometryJson}
            onChange={(e) => setGeometryJson(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-1.5 font-mono text-xs"
          />
        </label>
        <button type="submit" className="w-fit rounded bg-brand px-3 py-1.5 text-sm text-white">
          Crear variante
        </button>
      </form>
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

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
  const [stops, setStops] = useState<(StopResponse & { sequence: number })[]>([]);
  const [schedules, setSchedules] = useState<ScheduleResponse[]>([]);
  const [stopToAdd, setStopToAdd] = useState('');
  const [departureTime, setDepartureTime] = useState('06:00');
  const [daysOfWeek, setDaysOfWeek] = useState('1,2,3,4,5');

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
    await adminFetch(`/variants/${variant.id}/stops`, {
      method: 'POST',
      body: { stopId: stopToAdd },
    });
    setStopToAdd('');
    await load();
  }

  async function handleAddSchedule(e: React.FormEvent) {
    e.preventDefault();
    await adminFetch(`/variants/${variant.id}/schedules`, {
      method: 'POST',
      body: {
        departureTime,
        daysOfWeek: daysOfWeek.split(',').map((d) => Number(d.trim())),
      },
    });
    await load();
  }

  return (
    <div className="rounded border border-gray-200 p-4">
      <h3 className="font-medium">
        {variant.name} — {variant.headsign}
      </h3>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <h4 className="mb-1 text-sm font-semibold text-gray-600">Paradas</h4>
          <ol className="mb-2 list-decimal pl-4 text-sm">
            {stops.map((stop) => (
              <li key={stop.id}>{stop.name}</li>
            ))}
          </ol>
          <form onSubmit={handleAttachStop} className="flex gap-2">
            <select
              value={stopToAdd}
              onChange={(e) => setStopToAdd(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
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
            <button type="submit" className="rounded border border-gray-300 px-2 py-1 text-sm">
              Agregar
            </button>
          </form>
        </div>

        <div>
          <h4 className="mb-1 text-sm font-semibold text-gray-600">Horarios</h4>
          <ul className="mb-2 text-sm">
            {schedules.map((s) => (
              <li key={s.id}>
                {s.departureTime} — días {s.daysOfWeek.join(',')}
              </li>
            ))}
          </ul>
          <form onSubmit={handleAddSchedule} className="flex flex-wrap gap-2">
            <input
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <input
              value={daysOfWeek}
              onChange={(e) => setDaysOfWeek(e.target.value)}
              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
              title="Días (0=domingo)"
            />
            <button type="submit" className="rounded border border-gray-300 px-2 py-1 text-sm">
              Agregar horario
            </button>
          </form>
        </div>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="mt-3 text-xs text-gray-400 hover:text-gray-600"
      >
        Actualizar
      </button>
    </div>
  );
}
