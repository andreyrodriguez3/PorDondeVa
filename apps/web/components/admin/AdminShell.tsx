'use client';

import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRequireAdminAuth } from '@/lib/adminAuth';
import { useRouter } from 'next/navigation';
import { ToastProvider } from '@/components/ui/Toast';
import { springOrFade } from '@/lib/motionPresets';
import { AdminNav } from './AdminNav';

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = useRequireAdminAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const reduced = useReducedMotion();
  if (!user) return null;

  // SUPER_ADMIN is a platform-level account (D-A7 in ROADMAP.md) — it cannot read a
  // company's operational data, so every screen here would 403. It manages companies
  // from its own section instead (A20).
  if (user.role === 'SUPER_ADMIN') {
    router.replace('/platform');
    return null;
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-surface-secondary">
        <AnimatePresence>
          {mobileNavOpen ? (
            <motion.div
              className="fixed inset-0 z-40 bg-scrim lg:hidden"
              {...springOrFade(Boolean(reduced), {
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                exit: { opacity: 0 },
                transition: { duration: 0.18 },
              })}
              onClick={() => setMobileNavOpen(false)}
            />
          ) : null}
        </AnimatePresence>

        <AdminNav mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Abrir menú"
              className="flex h-9 w-9 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-tertiary hover:text-ink"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <span className="text-title text-ink">TuBus Admin</span>
          </header>

          <main className="min-w-0 flex-1 p-6 sm:p-8">
            <div className="mx-auto max-w-5xl">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
