import { toZonedTime } from 'date-fns-tz';

/**
 * The calendar date "now" falls on on in `timeZone`, as a UTC-midnight Date
 * matching the `@db.Date` column convention used for AttendanceRecord.date.
 */
export function businessDateUTC(timeZone: string, at: Date = new Date()): Date {
  const zoned = toZonedTime(at, timeZone);
  return new Date(Date.UTC(zoned.getFullYear(), zoned.getMonth(), zoned.getDate()));
}

/** Minutes since local midnight in `timeZone`, for comparing against a late-cutoff setting. */
export function minutesSinceLocalMidnight(timeZone: string, at: Date = new Date()): number {
  const zoned = toZonedTime(at, timeZone);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

/** Throws if `timeZone` isn't a name the runtime's ICU data recognizes. */
export function assertValidTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
  } catch {
    throw new RangeError(`Unknown time zone: ${timeZone}`);
  }
}
