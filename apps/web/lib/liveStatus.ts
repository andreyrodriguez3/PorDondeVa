import type { BusLiveState } from '@tubus/contracts';
import { copy } from './copy';

export function relativeTimeLabel(deviceTimestamp: string, now: Date = new Date()): string {
  const seconds = Math.max(
    0,
    Math.round((now.getTime() - new Date(deviceTimestamp).getTime()) / 1000),
  );
  if (seconds < 5) return copy.updatedJustNow;
  if (seconds < 60) return copy.updatedSecondsAgo(seconds);
  return copy.updatedMinutesAgo(Math.round(seconds / 60));
}

export const stateColor: Record<BusLiveState, string> = {
  LIVE: '#16a34a',
  STALE: '#d97706',
  OFFLINE: '#6b7280',
};

export const stateLabel: Record<BusLiveState, string> = copy.liveState;
