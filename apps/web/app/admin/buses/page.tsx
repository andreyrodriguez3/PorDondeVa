'use client';

import { useEffect, useState } from 'react';
import type { BusResponse } from '@tubus/contracts';
import { adminFetch } from '@/lib/adminAuth';
import { AdminShell } from '@/components/admin/AdminShell';

export default function BusesPage() {
  return (
    <AdminShell>
      <BusesContent />
    </AdminShell>
  );
}

function BusesContent() {
  const [buses, setBuses] = useState<BusResponse[]>([]);
  const [label, setLabel] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    try {
      await adminFetch('/buses', {
        method: 'POST',
        body: { label, licensePlate: licensePlate || undefined },
      });
      setLabel('');
      setLicensePlate('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el bus.');
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-xl font-semibold">Buses</h1>

      <form onSubmit={handleCreate} className="mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Etiqueta
          <input
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Bus 24"
            className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          Placa
          <input
            value={licensePlate}
            onChange={(e) => setLicensePlate(e.target.value)}
            className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
        <button type="submit" className="rounded bg-brand px-3 py-1.5 text-sm text-white">
          Agregar bus
        </button>
      </form>
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="text-gray-500">Cargando…</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2">Etiqueta</th>
              <th className="py-2">Placa</th>
              <th className="py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {buses.map((bus) => (
              <tr key={bus.id} className="border-b border-gray-100">
                <td className="py-2">{bus.label}</td>
                <td className="py-2">{bus.licensePlate ?? '—'}</td>
                <td className="py-2">{bus.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
