'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { clearSession, getCurrentUser } from '@/lib/adminAuth';
import { ThemeToggle } from '../ui/ThemeToggle';
import {
  BusIcon,
  DriverIcon,
  LiveIcon,
  LogoutIcon,
  QrIcon,
  RouteIcon,
  SettingsIcon,
  StopIcon,
  TripsIcon,
} from './icons';

const LINKS = [
  { href: '/live', label: 'Flota en vivo', icon: LiveIcon },
  { href: '/trips', label: 'Viajes', icon: TripsIcon },
  { href: '/buses', label: 'Buses', icon: BusIcon },
  { href: '/drivers', label: 'Conductores', icon: DriverIcon },
  { href: '/routes', label: 'Rutas', icon: RouteIcon },
  { href: '/stops', label: 'Paradas', icon: StopIcon },
  { href: '/qr', label: 'Códigos QR', icon: QrIcon },
  { href: '/settings', label: 'Configuración', icon: SettingsIcon },
];

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super admin',
  COMPANY_ADMIN: 'Administrador',
  OPERATOR: 'Operador',
  DRIVER: 'Conductor',
};

interface AdminNavProps {
  /** Off-canvas drawer state below `lg` — ignored (nav is always visible) at `lg` and up. */
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function AdminNav({ mobileOpen = false, onCloseMobile }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = getCurrentUser();
  const reduced = useReducedMotion();

  return (
    <nav
      className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-line bg-surface px-3 py-4 transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-56 lg:translate-x-0 lg:transition-none ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="mb-5 flex items-center gap-2 px-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-callout font-bold text-brand-fg">
          T
        </span>
        <span className="text-title text-ink">TuBus Admin</span>
      </div>

      <div className="flex flex-col gap-0.5">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onCloseMobile}
              className={`relative flex items-center gap-2.5 rounded-md px-3 py-2 text-callout font-medium transition-colors duration-150 ${
                active ? 'text-brand' : 'text-ink-secondary hover:text-ink'
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="admin-nav-active"
                  className="absolute inset-0 rounded-md bg-brand/10"
                  transition={
                    reduced ? { duration: 0 } : { type: 'spring', bounce: 0, duration: 0.35 }
                  }
                />
              ) : null}
              <span className="relative z-10">
                <Icon />
              </span>
              <span className="relative z-10">{link.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3">
        {user ? (
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="min-w-0">
              <p className="truncate text-callout font-medium text-ink">{user.name}</p>
              <p className="text-caption text-ink-tertiary">{ROLE_LABEL[user.role] ?? user.role}</p>
            </div>
            <ThemeToggle />
          </div>
        ) : (
          <div className="flex justify-end px-2">
            <ThemeToggle />
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            clearSession();
            router.replace('/login');
          }}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-callout font-medium text-ink-secondary transition-colors hover:bg-surface-tertiary hover:text-ink"
        >
          <LogoutIcon />
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}
