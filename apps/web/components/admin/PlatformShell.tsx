'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { clearSession, useRequireAdminAuth } from '@/lib/adminAuth';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ToastProvider } from '@/components/ui/Toast';

/**
 * SUPER_ADMIN is a platform-level account, not a company-scoped one (D-A7) — it has no
 * route/bus/driver data to show, so it gets its own minimal shell instead of AdminNav's
 * company-scoped sidebar. A COMPANY_ADMIN/OPERATOR/DRIVER landing here (e.g. a stale
 * bookmark) is bounced to their own dashboard rather than shown an empty platform view.
 */
export function PlatformShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = useRequireAdminAuth();

  // Navigating during render is a React anti-pattern — an effect guarantees the redirect
  // actually fires instead of possibly being dropped on a re-render.
  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') router.replace('/live');
  }, [user, router]);

  if (!user || user.role !== 'SUPER_ADMIN') return null;

  return (
    <ToastProvider>
      <div className="min-h-screen bg-surface-secondary">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-callout font-bold text-brand-fg">
              T
            </span>
            <span className="text-title text-ink">TuBus Plataforma</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                clearSession();
                router.replace('/login');
              }}
            >
              Cerrar sesión
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-4xl p-6 sm:p-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
