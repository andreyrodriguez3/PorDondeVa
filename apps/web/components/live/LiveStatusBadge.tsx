'use client';

import { useEffect, useState } from 'react';
import type { PublicBusUpdate } from '@tubus/contracts';
import { relativeTimeLabel, stateColor, stateLabel } from '@/lib/liveStatus';

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
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: stateColor[bus.state] }}
      />
      <span className="font-medium">{stateLabel[bus.state]}</span>
      <span className="text-gray-400">{label ?? '—'}</span>
    </span>
  );
}
