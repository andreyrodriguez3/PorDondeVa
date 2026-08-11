'use client';

import { useEffect, useState } from 'react';
import type { TripResponse } from '@tubus/contracts';
import { adminFetch } from '@/lib/adminAuth';
import { AdminShell } from '@/components/admin/AdminShell';

export default function TripsPage() {
  return (
    <AdminShell>
      <TripsContent />
    </AdminShell>
  );
}

function TripsContent() {
  const [trips, setTrips] = useState<TripResponse[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const query = status ? `?status=${status}` : '';
      setTrips(await adminFetch<TripResponse[]>(`/trips${query}`));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status]);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-xl font-semibold">Viajes</h1>

      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="mb-4 rounded border border-gray-300 px-3 py-1.5 text-sm"
      >
        <option value="">Todos</option>
        <option value="ACTIVE">Activos</option>
        <option value="COMPLETED">Completados</option>
        <option value="CANCELLED">Cancelados</option>
      </select>

      {loading ? (
        <p className="text-gray-500">Cargando…</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2">Estado</th>
              <th className="py-2">Inicio</th>
              <th className="py-2">Fin</th>
              <th className="py-2">Puntos rechazados</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((trip) => (
              <tr key={trip.id} className="border-b border-gray-100">
                <td className="py-2">{trip.status}</td>
                <td className="py-2">{new Date(trip.startedAt).toLocaleString('es-CR')}</td>
                <td className="py-2">
                  {trip.endedAt ? new Date(trip.endedAt).toLocaleString('es-CR') : '—'}
                </td>
                <td className="py-2">{trip.rejectedPointCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
