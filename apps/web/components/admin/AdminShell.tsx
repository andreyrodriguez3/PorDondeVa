'use client';

import type { ReactNode } from 'react';
import { useRequireAdminAuth } from '@/lib/adminAuth';
import { AdminNav } from './AdminNav';

export function AdminShell({ children }: { children: ReactNode }) {
  const user = useRequireAdminAuth();
  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      <AdminNav />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
