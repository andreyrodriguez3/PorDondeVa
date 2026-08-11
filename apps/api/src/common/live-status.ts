/**
 * D9/D10 in ROADMAP.md — connection status is derived at read time from the newest
 * `device_timestamp`, never stored. A bus dark for ten minutes that flushes its queue is
 * not "live" just because the bytes arrived a second ago.
 */
export type BusLiveState = 'LIVE' | 'STALE' | 'OFFLINE';

export function computeLiveState(
  deviceTimestamp: Date,
  now: Date,
  liveThresholdSeconds: number,
  staleThresholdSeconds: number,
): BusLiveState {
  const ageSeconds = (now.getTime() - deviceTimestamp.getTime()) / 1000;
  if (ageSeconds <= liveThresholdSeconds) return 'LIVE';
  if (ageSeconds <= staleThresholdSeconds) return 'STALE';
  return 'OFFLINE';
}
