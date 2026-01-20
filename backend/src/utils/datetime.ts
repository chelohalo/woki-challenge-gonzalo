import { format, parse, addMinutes, startOfDay, eachMinuteOfInterval } from 'date-fns';
import { formatInTimeZone, zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

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

export function getStartOfDay(date: Date, timezone: string): Date {
  const zonedDate = utcToZonedTime(date, timezone);
  const start = startOfDay(zonedDate);
  return zonedTimeToUtc(start, timezone);
}

export function generate15MinSlots(
  date: Date,
  timezone: string,
  shifts?: Array<{ start: string; end: string }>
): Date[] {
  const slots: Date[] = [];
  
  // Get the date in the restaurant's timezone
  const zonedDate = utcToZonedTime(date, timezone);
  const dayStart = startOfDay(zonedDate);
  
  if (!shifts || shifts.length === 0) {
    // Full day: 00:00 to 23:45 (last slot that can fit 90min reservation)
    const dayEnd = addMinutes(dayStart, 24 * 60 - 90);
    const intervalSlots = eachMinuteOfInterval(
      { start: dayStart, end: dayEnd },
      { step: 15 }
    );
    // Convert back to UTC
    return intervalSlots.map(slot => zonedTimeToUtc(slot, timezone));
  }

  // Generate slots for each shift
  for (const shift of shifts) {
    const [startHour, startMin] = shift.start.split(':').map(Number);
    const [endHour, endMin] = shift.end.split(':').map(Number);
    
    const shiftStart = new Date(dayStart);
    shiftStart.setHours(startHour, startMin, 0, 0);
    
    const shiftEnd = new Date(dayStart);
    shiftEnd.setHours(endHour, endMin, 0, 0);
    
    // Ensure we don't create slots that would end after shift end
    const maxSlotStart = addMinutes(shiftEnd, -90);
    const actualEnd = shiftStart > maxSlotStart ? shiftStart : maxSlotStart;
    
    const shiftSlots = eachMinuteOfInterval(
      { start: shiftStart, end: actualEnd },
      { step: 15 }
    );
    
    // Convert to UTC
    const utcSlots = shiftSlots.map(slot => zonedTimeToUtc(slot, timezone));
    slots.push(...utcSlots);
  }

  return slots;
}

export function isWithinShift(
  dateTime: Date,
  timezone: string,
  shifts?: Array<{ start: string; end: string }>
): boolean {
  if (!shifts || shifts.length === 0) {
    return true; // Full day available
  }

  const zonedDate = utcToZonedTime(dateTime, timezone);
  const timeStr = formatTime(zonedDate);

  for (const shift of shifts) {
    if (timeStr >= shift.start && timeStr < shift.end) {
      return true;
    }
  }

  return false;
}
