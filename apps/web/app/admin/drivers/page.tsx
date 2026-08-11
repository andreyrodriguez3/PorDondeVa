'use client';

import { useEffect, useState } from 'react';
import type { BusResponse, DriverResponse } from '@tubus/contracts';
import { adminFetch } from '@/lib/adminAuth';
import { AdminShell } from '@/components/admin/AdminShell';

export default function DriversPage() {
  return (
    <AdminShell>
      <DriversContent />
    </AdminShell>
  );
}

function DriversContent() {
  const [drivers, setDrivers] = useState<DriverResponse[]>([]);
  const [buses, setBuses] = useState<BusResponse[]>([]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [defaultBusId, setDefaultBusId] = useState('');
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    try {
      await adminFetch('/drivers', {
        method: 'POST',
        body: { name, username, password, defaultBusId: defaultBusId || undefined },
      });
      setName('');
      setUsername('');
      setPassword('');
      setDefaultBusId('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el conductor.');
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-xl font-semibold">Conductores</h1>

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
          Usuario
          <input
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          Contraseña
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          Bus asignado
          <select
            value={defaultBusId}
            onChange={(e) => setDefaultBusId(e.target.value)}
            className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">—</option>
            {buses.map((bus) => (
              <option key={bus.id} value={bus.id}>
                {bus.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded bg-brand px-3 py-1.5 text-sm text-white">
          Agregar conductor
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
              <th className="py-2">Usuario</th>
              <th className="py-2">Bus asignado</th>
              <th className="py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver) => (
              <tr key={driver.id} className="border-b border-gray-100">
                <td className="py-2">{driver.name}</td>
                <td className="py-2">{driver.username}</td>
                <td className="py-2">
                  {buses.find((b) => b.id === driver.defaultBusId)?.label ?? '—'}
                </td>
                <td className="py-2">{driver.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
