import { format, parse, addMinutes, eachMinuteOfInterval } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Helpers
 */
function ymdFromUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISODateTime(iso: string): Date {
  return new Date(iso);
}

export function formatISODateTime(date: Date): string {
  return date.toISOString();
}

export function parseTime(timeStr: string): Date {
  // Parse "HH:mm" format
  return parse(timeStr, 'HH:mm', new Date());
}

export function formatTime(date: Date): string {
  return format(date, 'HH:mm');
}

export function addMinutesToDate(date: Date, minutes: number): Date {
  return addMinutes(date, minutes);
}

/**
 * Get the start of a calendar day in the restaurant's timezone, converted to UTC.
 * IMPORTANT:
 * - Treats the input Date as a "calendar day" (YYYY-MM-DD)
 * - Builds the day from UTC parts to avoid JS Date timezone pitfalls
 */
export function getZonedDayStartUTC(date: Date, timezone: string): Date {
  const ymd = ymdFromUTC(date);
  const localMidnight = parse(
    `${ymd}T00:00:00`,
    "yyyy-MM-dd'T'HH:mm:ss",
    new Date()
  );
  return fromZonedTime(localMidnight, timezone);
}

/**
 * Convert a local time (HH:mm) on a given calendar day to UTC,
 * interpreting it as being in the restaurant's timezone.
 */
function localTimeToUTC(date: Date, timeStr: string, timezone: string): Date {
  const ymd = ymdFromUTC(date);
  const localTimeStr = `${ymd}T${timeStr}:00`;

  const parsed = parse(
    localTimeStr,
    "yyyy-MM-dd'T'HH:mm:ss",
    new Date()
  );

  return fromZonedTime(parsed, timezone);
}

export function getStartOfDay(date: Date, timezone: string): Date {
  return getZonedDayStartUTC(date, timezone);
}

export function generate15MinSlots(
  date: Date,
  timezone: string,
  shifts?: Array<{ start: string; end: string }>
): Date[] {
  // Start of the calendar day (UTC)
  const dayStartUTC = getZonedDayStartUTC(date, timezone);

  // Full-day scheduling (00:00 → last slot that can fit 90 minutes)
  if (!shifts || shifts.length === 0) {
    const dayEndUTC = addMinutes(dayStartUTC, 24 * 60 - 90);
    return eachMinuteOfInterval(
      { start: dayStartUTC, end: dayEndUTC },
      { step: 15 }
    );
  }

  // Shifts-based scheduling
  const slots: Date[] = [];

  for (const shift of shifts) {
    const shiftStartUTC = localTimeToUTC(date, shift.start, timezone);
    const shiftEndUTC = localTimeToUTC(date, shift.end, timezone);

    // Last slot start that can still fit a 90-minute reservation
    const maxSlotStart = addMinutes(shiftEndUTC, -90);
    const actualEnd =
      shiftStartUTC > maxSlotStart ? shiftStartUTC : maxSlotStart;

    const shiftSlots = eachMinuteOfInterval(
      { start: shiftStartUTC, end: actualEnd },
      { step: 15 }
    );

    slots.push(...shiftSlots);
  }

  return slots;
}

export function isWithinShift(
  dateTime: Date,
  timezone: string,
  shifts?: Array<{ start: string; end: string }>
): boolean {
  if (!shifts || shifts.length === 0) {
    return true;
  }

  const zonedDate = toZonedTime(dateTime, timezone);
  const timeStr = formatTime(zonedDate);

  return shifts.some(
    (shift) => timeStr >= shift.start && timeStr < shift.end
  );
}
