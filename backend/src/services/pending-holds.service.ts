import { getReservationById } from '../repositories/reservation.repository.js';
import { updateReservation } from '../repositories/reservation.repository.js';
import { formatISODateTime } from '../utils/datetime.js';
import { Errors } from '../utils/errors.js';

/**
 * Check and expire pending holds that have passed their TTL
 * Should be called periodically or before creating new reservations
 */
export async function expirePendingHolds(): Promise<number> {
  const { db } = await import('../db/index.js');
  const { reservations } = await import('../db/schema.js');
  const { eq, and, lt } = await import('drizzle-orm');
  const now = formatISODateTime(new Date());
  const nowTime = new Date(now).getTime();

  // Get all pending reservations with expiresAt in the past
  const allPending = await db
    .select()
    .from(reservations)
    .where(eq(reservations.status, 'PENDING'));

  let expiredCount = 0;

  for (const reservation of allPending) {
    if (reservation.expiresAt) {
      const expiresTime = new Date(reservation.expiresAt).getTime();
      if (expiresTime < nowTime) {
        // Expire this hold
        await updateReservation(reservation.id, {
          status: 'CANCELLED',
          updatedAt: now,
        });
        expiredCount++;
      }
    }
  }

  return expiredCount;
}

/**
 * Approve a pending reservation (change status to CONFIRMED)
 */
export async function approvePendingReservation(id: string): Promise<void> {
  const reservation = await getReservationById(id);
  
  if (!reservation) {
    throw Errors.NOT_FOUND('Reservation');
  }

  if (reservation.status !== 'PENDING') {
    throw Errors.INVALID_FORMAT('Reservation is not pending approval');
  }

  // Check if expired
  if (reservation.expiresAt) {
    const expiresTime = new Date(reservation.expiresAt).getTime();
    const nowTime = Date.now();
    if (expiresTime < nowTime) {
      throw Errors.INVALID_FORMAT('Pending hold has expired');
    }
  }

  const now = formatISODateTime(new Date());
  await updateReservation(id, {
    status: 'CONFIRMED',
    expiresAt: null, // Clear expiration
    updatedAt: now,
  });
}

/**
 * Reject a pending reservation (change status to CANCELLED and release tables)
 */
export async function rejectPendingReservation(id: string): Promise<void> {
  const reservation = await getReservationById(id);
  
  if (!reservation) {
    throw Errors.NOT_FOUND('Reservation');
  }

  if (reservation.status !== 'PENDING') {
    throw Errors.INVALID_FORMAT('Reservation is not pending approval');
  }

  const now = formatISODateTime(new Date());
  await updateReservation(id, {
    status: 'CANCELLED',
    expiresAt: null,
    updatedAt: now,
  });
}
