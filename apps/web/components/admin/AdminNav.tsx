'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession } from '@/lib/adminAuth';

const LINKS = [
  { href: '/live', label: 'Flota en vivo' },
  { href: '/trips', label: 'Viajes' },
  { href: '/buses', label: 'Buses' },
  { href: '/drivers', label: 'Conductores' },
  { href: '/routes', label: 'Rutas' },
  { href: '/stops', label: 'Paradas' },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="flex w-48 shrink-0 flex-col gap-1 border-r border-gray-200 p-4">
      <span className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
        TuBus Admin
      </span>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`rounded px-3 py-2 text-sm ${
            pathname === link.href ? 'bg-brand text-white' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          {link.label}
        </Link>
      ))}
      <button
        type="button"
        onClick={() => {
          clearSession();
          router.replace('/login');
        }}
        className="mt-6 rounded px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100"
      >
        Cerrar sesión
      </button>
    </nav>
  );
}
