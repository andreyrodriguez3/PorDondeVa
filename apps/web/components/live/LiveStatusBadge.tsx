'use client';

import { useEffect, useState } from 'react';
import type { PublicBusUpdate } from '@tubus/contracts';
import { relativeTimeLabel, stateColor, stateLabel } from '@/lib/liveStatus';

const TONE_CLASS: Record<PublicBusUpdate['state'], string> = {
  LIVE: 'text-live',
  STALE: 'text-stale',
  OFFLINE: 'text-offline',
};

/**
 * Renders `—` until mounted, then fills in the relative time client-side (README.md —
 * avoids a hydration mismatch and prevents a cached page from showing a frozen
 * "hace 4 segundos" forever).
 */
export function LiveStatusBadge({ bus }: { bus: PublicBusUpdate }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setLabel(relativeTimeLabel(bus.deviceTimestamp));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [bus.deviceTimestamp]);

  return (
    <span className="inline-flex items-center gap-1.5 text-callout">
      <span className="relative inline-flex h-2 w-2">
        {bus.state === 'LIVE' ? (
          <span
            className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full"
            style={{ backgroundColor: stateColor[bus.state] }}
          />
        ) : null}
        <span
          className="relative inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: stateColor[bus.state] }}
        />
      </span>
      <span className={`font-semibold ${TONE_CLASS[bus.state]}`}>{stateLabel[bus.state]}</span>
      <span className="text-ink-tertiary">{label ?? '—'}</span>
    </span>
  );
}
