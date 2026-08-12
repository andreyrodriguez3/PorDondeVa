'use client';

import type { ReactNode } from 'react';
import { useRequireAdminAuth } from '@/lib/adminAuth';
import { ToastProvider } from '@/components/ui/Toast';
import { AdminNav } from './AdminNav';

export function AdminShell({ children }: { children: ReactNode }) {
  const user = useRequireAdminAuth();
  if (!user) return null;

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
