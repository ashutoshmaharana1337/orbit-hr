import { describe, expect, it } from 'vitest';
import { assertValidTimeZone, businessDateUTC, minutesSinceLocalMidnight } from './business-time.js';

describe('businessDateUTC', () => {
  it('uses the tenant timezone, not UTC, to decide the calendar day', () => {
    // 19:15 UTC on the 6th is 00:45 IST on the 7th — already tomorrow in India.
    const at = new Date('2026-09-06T19:15:00.000Z');
    expect(businessDateUTC('UTC', at).toISOString()).toBe('2026-09-06T00:00:00.000Z');
    expect(businessDateUTC('Asia/Kolkata', at).toISOString()).toBe('2026-09-07T00:00:00.000Z');
  });

  it('handles a timezone behind UTC without rolling the date backwards incorrectly', () => {
    // 02:00 UTC is 22:00 the previous day in America/New_York (EDT, UTC-4).
    const at = new Date('2026-09-07T02:00:00.000Z');
    expect(businessDateUTC('America/New_York', at).toISOString()).toBe('2026-09-06T00:00:00.000Z');
  });
});

describe('minutesSinceLocalMidnight', () => {
  it('computes wall-clock minutes in the target zone', () => {
    // 04:35 UTC = 10:05 IST.
    const at = new Date('2026-09-07T04:35:00.000Z');
    expect(minutesSinceLocalMidnight('Asia/Kolkata', at)).toBe(10 * 60 + 5);
    expect(minutesSinceLocalMidnight('UTC', at)).toBe(4 * 60 + 35);
  });
});

describe('assertValidTimeZone', () => {
  it('accepts a real IANA zone', () => {
    expect(() => assertValidTimeZone('Asia/Kolkata')).not.toThrow();
  });

  it('rejects a made-up zone', () => {
    expect(() => assertValidTimeZone('Not/AZone')).toThrow(RangeError);
  });
});
