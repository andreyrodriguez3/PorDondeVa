'use client';

import type { ReactNode } from 'react';
import { clearSession, useRequireAdminAuth } from '@/lib/adminAuth';
import { useRouter } from 'next/navigation';
import { ToastProvider } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { AdminNav } from './AdminNav';

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = useRequireAdminAuth();
  if (!user) return null;

  // SUPER_ADMIN is a platform-level account (D-A7 in ROADMAP.md) — it cannot read a
  // company's operational data, so every screen here would 403. There's no platform
  // section built yet to send it to instead, so this stops it here with a clear
  // message rather than letting company-scoped fetches crash the page.
  if (user.role === 'SUPER_ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-secondary px-4">
        <div className="max-w-sm rounded-lg border border-line bg-surface p-6 text-center shadow-elevate-1">
          <p className="text-title text-ink">Cuenta de super administrador</p>
          <p className="mt-2 text-callout text-ink-secondary">
            Esta cuenta administra la plataforma (crear empresas, dominios), no los
            datos operativos de una empresa. Iniciá sesión con una cuenta de
            administrador de empresa para ver este panel.
          </p>
          <Button
            className="mt-4 w-full"
            variant="secondary"
            onClick={() => {
              clearSession();
              router.replace('/login');
            }}
          >
            Cerrar sesión
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-surface-secondary">
        <AdminNav />
        <main className="min-w-0 flex-1 p-6 sm:p-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
