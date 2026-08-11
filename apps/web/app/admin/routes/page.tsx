'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { RouteResponse } from '@tubus/contracts';
import { adminFetch } from '@/lib/adminAuth';
import { AdminShell } from '@/components/admin/AdminShell';

export default function RoutesPage() {
  return (
    <AdminShell>
      <RoutesContent />
    </AdminShell>
  );
}

function RoutesContent() {
  const [routes, setRoutes] = useState<RouteResponse[]>([]);
  const [name, setName] = useState('');
  const [originLabel, setOriginLabel] = useState('');
  const [destinationLabel, setDestinationLabel] = useState('');
  const [publicSlug, setPublicSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    try {
      await adminFetch('/routes', {
        method: 'POST',
        body: { name, originLabel, destinationLabel, publicSlug },
      });
      setName('');
      setOriginLabel('');
      setDestinationLabel('');
      setPublicSlug('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la ruta.');
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-xl font-semibold">Rutas</h1>

      <form onSubmit={handleCreate} className="mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Nombre
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          Origen
          <input
            required
            value={originLabel}
            onChange={(e) => setOriginLabel(e.target.value)}
            className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          Destino
          <input
            required
            value={destinationLabel}
            onChange={(e) => setDestinationLabel(e.target.value)}
            className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          Slug público
          <input
            required
            pattern="[a-z0-9-]+"
            value={publicSlug}
            onChange={(e) => setPublicSlug(e.target.value)}
            placeholder="sanjose-palmares"
            className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
        <button type="submit" className="rounded bg-brand px-3 py-1.5 text-sm text-white">
          Crear ruta
        </button>
      </form>
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="text-gray-500">Cargando…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {routes.map((route) => (
            <li key={route.id}>
              <Link
                href={`/routes/${route.id}`}
                className="block rounded border border-gray-200 px-4 py-3 hover:border-brand"
              >
                <span className="font-medium">{route.name}</span>
                <span className="ml-2 text-sm text-gray-500">
                  {route.originLabel} → {route.destinationLabel} (/{route.publicSlug})
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
