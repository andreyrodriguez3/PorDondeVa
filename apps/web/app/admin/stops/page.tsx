'use client';

import { useEffect, useState } from 'react';
import type { StopResponse } from '@tubus/contracts';
import { adminFetch } from '@/lib/adminAuth';
import { AdminShell } from '@/components/admin/AdminShell';

export default function StopsPage() {
  return (
    <AdminShell>
      <StopsContent />
    </AdminShell>
  );
}

function StopsContent() {
  const [stops, setStops] = useState<StopResponse[]>([]);
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    try {
      await adminFetch('/stops', {
        method: 'POST',
        body: { name, latitude: Number(latitude), longitude: Number(longitude) },
      });
      setName('');
      setLatitude('');
      setLongitude('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la parada.');
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-xl font-semibold">Paradas</h1>

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
          Latitud
          <input
            required
            type="number"
            step="any"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            className="mt-1 block w-32 rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          Longitud
          <input
            required
            type="number"
            step="any"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            className="mt-1 block w-32 rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
        <button type="submit" className="rounded bg-brand px-3 py-1.5 text-sm text-white">
          Agregar parada
        </button>
      </form>
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="text-gray-500">Cargando…</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2">Nombre</th>
              <th className="py-2">Latitud</th>
              <th className="py-2">Longitud</th>
            </tr>
          </thead>
          <tbody>
            {stops.map((stop) => (
              <tr key={stop.id} className="border-b border-gray-100">
                <td className="py-2">{stop.name}</td>
                <td className="py-2">{stop.latitude}</td>
                <td className="py-2">{stop.longitude}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
