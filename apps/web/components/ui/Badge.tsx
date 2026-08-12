import type { ReactNode } from 'react';

type Tone = 'brand' | 'live' | 'stale' | 'offline' | 'neutral' | 'danger';

const TONE_CLASSES: Record<Tone, string> = {
  brand: 'bg-brand/10 text-brand',
  live: 'bg-live-bg text-live',
  stale: 'bg-stale-bg text-stale',
  offline: 'bg-offline-bg text-offline',
  neutral: 'bg-surface-tertiary text-ink-secondary',
  danger: 'bg-danger-bg text-danger',
};

export function Badge({
  tone = 'neutral',
  dot = false,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-micro font-semibold uppercase tracking-wide ${TONE_CLASSES[tone]}`}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
