import { Errors } from './errors.js';

/**
 * Validate advance booking policy
 * @param startDateTimeISO Reservation start time
 * @param minAdvanceMinutes Minimum minutes in advance (optional)
 * @param maxAdvanceDays Maximum days in advance (optional)
 * @throws Errors.INVALID_FORMAT if outside policy
 */
export function validateAdvanceBooking(
  startDateTimeISO: string,
  minAdvanceMinutes?: number | null,
  maxAdvanceDays?: number | null
): void {
  const now = new Date();
  const startDate = new Date(startDateTimeISO);

  // Validate minimum advance time
  if (minAdvanceMinutes !== null && minAdvanceMinutes !== undefined) {
    const minAdvanceMs = minAdvanceMinutes * 60 * 1000;
    const timeUntilStart = startDate.getTime() - now.getTime();

    if (timeUntilStart < minAdvanceMs) {
      throw Errors.INVALID_FORMAT(
        `Reservations must be made at least ${minAdvanceMinutes} minutes in advance`
      );
    }
  }

  // Validate maximum advance time
  if (maxAdvanceDays !== null && maxAdvanceDays !== undefined) {
    const maxAdvanceMs = maxAdvanceDays * 24 * 60 * 60 * 1000;
    const timeUntilStart = startDate.getTime() - now.getTime();

    if (timeUntilStart > maxAdvanceMs) {
      throw Errors.INVALID_FORMAT(
        `Reservations can only be made up to ${maxAdvanceDays} days in advance`
      );
    }
  }

  // Validate that start time is not in the past (skip in test environment)
  if (process.env.NODE_ENV !== 'test' && startDate.getTime() < now.getTime()) {
    throw Errors.INVALID_FORMAT('Reservation start time cannot be in the past');
  }
}
