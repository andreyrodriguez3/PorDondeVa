import { computeLiveState } from './live-status';

describe('computeLiveState', () => {
  const now = new Date('2026-08-10T12:00:00Z');

  it('is LIVE within the live threshold', () => {
    const deviceTimestamp = new Date('2026-08-10T11:59:45Z'); // 15s ago
    expect(computeLiveState(deviceTimestamp, now, 30, 180)).toBe('LIVE');
  });

  it('is STALE between the live and stale thresholds', () => {
    const deviceTimestamp = new Date('2026-08-10T11:58:00Z'); // 120s ago
    expect(computeLiveState(deviceTimestamp, now, 30, 180)).toBe('STALE');
  });

  it('is OFFLINE beyond the stale threshold', () => {
    const deviceTimestamp = new Date('2026-08-10T11:50:00Z'); // 600s ago
    expect(computeLiveState(deviceTimestamp, now, 30, 180)).toBe('OFFLINE');
  });

  it('flips back to LIVE the moment a fresh fix lands after a long gap (D10)', () => {
    const deviceTimestamp = new Date('2026-08-10T11:59:59Z'); // 1s ago, even after an outage
    expect(computeLiveState(deviceTimestamp, now, 30, 180)).toBe('LIVE');
  });
});
