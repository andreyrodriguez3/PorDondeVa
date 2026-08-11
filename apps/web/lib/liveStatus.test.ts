import { describe, expect, it } from 'vitest';
import { relativeTimeLabel } from './liveStatus';

describe('relativeTimeLabel', () => {
  const now = new Date('2026-08-10T12:00:00Z');

  it('reads as "just now" within the first few seconds', () => {
    expect(relativeTimeLabel('2026-08-10T11:59:58Z', now)).toBe('actualizado justo ahora');
  });

  it('counts seconds under a minute', () => {
    expect(relativeTimeLabel('2026-08-10T11:59:40Z', now)).toBe('actualizado hace 20 segundos');
  });

  it('counts minutes at and beyond a minute, using singular for one', () => {
    expect(relativeTimeLabel('2026-08-10T11:59:00Z', now)).toBe('actualizado hace 1 minuto');
    expect(relativeTimeLabel('2026-08-10T11:55:00Z', now)).toBe('actualizado hace 5 minutos');
  });
});
