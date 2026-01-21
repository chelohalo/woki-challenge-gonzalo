import { nanoid } from 'nanoid';
import { getRestaurantById } from '../repositories/restaurant.repository.js';
import { getSectorById } from '../repositories/sector.repository.js';
import { assignTable } from './table-assignment.service.js';
import {
  createReservation,
  getReservationById,
  cancelReservation as cancelReservationRepo,
} from '../repositories/reservation.repository.js';
import { addMinutesToDate, formatISODateTime, isWithinShift } from '../utils/datetime.js';
import { calculateReservationDuration } from '../utils/duration.js';
import { validateAdvanceBooking } from '../utils/booking-policy.js';
import { acquireLock } from '../utils/locks.js';
import { Errors } from '../utils/errors.js';
import type { CustomerInput } from '../types/index.js';

export async function createReservationService(data: {
  restaurantId: string;
  sectorId: string;
  partySize: number;
  startDateTimeISO: string;
  customer: CustomerInput;
  notes?: string;
}) {
  // Acquire lock for this sector+slot to prevent concurrent bookings
  const releaseLock = await acquireLock(data.sectorId, data.startDateTimeISO);

  try {
    // 1. Validate restaurant and sector exist
    const restaurant = await getRestaurantById(data.restaurantId);
    if (!restaurant) {
      throw Errors.NOT_FOUND('Restaurant');
    }

    const sector = await getSectorById(data.sectorId);
    if (!sector) {
      throw Errors.NOT_FOUND('Sector');
    }

    // 2. Validate time is within shifts
    const startDate = new Date(data.startDateTimeISO);
    if (!isWithinShift(startDate, restaurant.timezone, restaurant.shifts || undefined)) {
      throw Errors.OUTSIDE_SERVICE_WINDOW();
    }

    // 3. Validate advance booking policy
    validateAdvanceBooking(
      data.startDateTimeISO,
      restaurant.minAdvanceMinutes ?? undefined,
      restaurant.maxAdvanceDays ?? undefined
    );

    // 4. Calculate reservation duration based on party size and rules
    const reservationDurationMinutes = calculateReservationDuration(
      data.partySize,
      restaurant.durationRules || undefined,
      restaurant.reservationDurationMinutes || 90
    );

    // 5. Check if this is a large group requiring approval
    const isLargeGroup = restaurant.largeGroupThreshold !== null && 
                         restaurant.largeGroupThreshold !== undefined &&
                         data.partySize >= restaurant.largeGroupThreshold;

    // 6. Assign table(s) (within lock to prevent race conditions)
    const tableIds = await assignTable(
      data.sectorId,
      data.startDateTimeISO,
      data.partySize,
      reservationDurationMinutes
    );
    if (!tableIds || tableIds.length === 0) {
      throw Errors.NO_CAPACITY();
    }

    // 7. Calculate end time
    const endDate = addMinutesToDate(startDate, reservationDurationMinutes);
    const endDateTimeISO = formatISODateTime(endDate);

    // 8. Determine status and expiration
    let status: 'CONFIRMED' | 'PENDING' = 'CONFIRMED';
    let expiresAt: string | null = null;

    if (isLargeGroup && restaurant.pendingHoldTTLMinutes) {
      status = 'PENDING';
      // Calculate expiration time
      const expirationDate = addMinutesToDate(new Date(), restaurant.pendingHoldTTLMinutes);
      expiresAt = formatISODateTime(expirationDate);
    }

    // 9. Expire any old pending holds before creating new reservation
    const { expirePendingHolds } = await import('./pending-holds.service.js');
    const expiredCount = await expirePendingHolds();
    if (expiredCount > 0) {
      // Log expiration for observability
      // (logger not available here, but could add if needed)
    }

    // 10. Create reservation
    const now = formatISODateTime(new Date());
    const reservationId = `RES_${nanoid(8).toUpperCase()}`;

    const reservation = await createReservation({
      id: reservationId,
      restaurantId: data.restaurantId,
      sectorId: data.sectorId,
      tableIds: tableIds,
      partySize: data.partySize,
      startDateTime: data.startDateTimeISO,
      endDateTime: endDateTimeISO,
      status: status,
      expiresAt: expiresAt,
      customerName: data.customer.name,
      customerPhone: data.customer.phone,
      customerEmail: data.customer.email,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    });

    if (!reservation) {
      throw new Error('Failed to create reservation');
    }

    // 11. Format response
    return {
      id: reservation.id,
      restaurantId: reservation.restaurantId,
      sectorId: reservation.sectorId,
      tableIds: reservation.tableIds,
      partySize: reservation.partySize,
      start: reservation.startDateTime,
      end: reservation.endDateTime,
      status: reservation.status,
      expiresAt: reservation.expiresAt || undefined,
      customer: {
        name: reservation.customerName,
        phone: reservation.customerPhone,
        email: reservation.customerEmail,
        createdAt: reservation.createdAt,
        updatedAt: reservation.updatedAt,
      },
      createdAt: reservation.createdAt,
      updatedAt: reservation.updatedAt,
    };
  } finally {
    // Always release lock, even if there's an error
    releaseLock();
  }
}

export async function cancelReservationService(id: string) {
  const reservation = await getReservationById(id);
  if (!reservation) {
    throw Errors.NOT_FOUND('Reservation');
  }

  if (reservation.status === 'CANCELLED') {
    return; // Already cancelled
  }

  const now = formatISODateTime(new Date());
  await cancelReservationRepo(id, now);
}

export async function getReservationsByDayService(
  restaurantId: string,
  date: Date,
  sectorId?: string
) {
  const { getReservationsByDay } = await import('../repositories/reservation.repository.js');
  // Get restaurant to pass timezone
  const restaurant = await getRestaurantById(restaurantId);
  const reservations = await getReservationsByDay(
    restaurantId,
    date,
    sectorId,
    restaurant?.timezone
  );

  return reservations.map((r) => ({
    id: r.id,
    sectorId: r.sectorId,
    tableIds: r.tableIds,
    partySize: r.partySize,
    start: r.startDateTime,
    end: r.endDateTime,
    status: r.status,
    customer: {
      name: r.customerName,
      phone: r.customerPhone,
      email: r.customerEmail,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    },
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function updateReservationService(
  id: string,
  data: {
    sectorId?: string;
    partySize?: number;
    startDateTimeISO?: string;
    customer?: CustomerInput;
    notes?: string;
  }
) {
  // Get existing reservation
  const existingReservation = await getReservationById(id);
  if (!existingReservation) {
    throw Errors.NOT_FOUND('Reservation');
  }

  if (existingReservation.status === 'CANCELLED') {
    throw Errors.INVALID_FORMAT('Cannot update a cancelled reservation');
  }

  // Get restaurant
  const restaurant = await getRestaurantById(existingReservation.restaurantId);
  if (!restaurant) {
    throw Errors.NOT_FOUND('Restaurant');
  }

  // Determine what changed
  const newSectorId = data.sectorId || existingReservation.sectorId;
  const newPartySize = data.partySize ?? existingReservation.partySize;
  const newStartDateTimeISO = data.startDateTimeISO || existingReservation.startDateTime;
  const newCustomer = data.customer || {
    name: existingReservation.customerName,
    phone: existingReservation.customerPhone,
    email: existingReservation.customerEmail,
  };
  const newNotes = data.notes !== undefined ? data.notes : (existingReservation.notes || undefined);

  // Check if sector changed
  if (data.sectorId && data.sectorId !== existingReservation.sectorId) {
    const sector = await getSectorById(data.sectorId);
    if (!sector) {
      throw Errors.NOT_FOUND('Sector');
    }
  }

  // Validate time is within shifts (if time changed)
  if (data.startDateTimeISO) {
    const startDate = new Date(newStartDateTimeISO);
    if (!isWithinShift(startDate, restaurant.timezone, restaurant.shifts || undefined)) {
      throw Errors.OUTSIDE_SERVICE_WINDOW();
    }

    // Validate advance booking policy
    validateAdvanceBooking(
      newStartDateTimeISO,
      restaurant.minAdvanceMinutes ?? undefined,
      restaurant.maxAdvanceDays ?? undefined
    );
  }

  // Calculate new duration based on party size
  const reservationDurationMinutes = calculateReservationDuration(
    newPartySize,
    restaurant.durationRules || undefined,
    restaurant.reservationDurationMinutes || 90
  );

  // Acquire lock for the new slot (or existing if time didn't change)
  const releaseLock = await acquireLock(newSectorId, newStartDateTimeISO);

  try {
    // If time or sector changed, need to re-assign table
    let newTableIds = existingReservation.tableIds;
    
    if (data.startDateTimeISO || data.sectorId || data.partySize !== undefined) {
      // Release old table assignment by checking if we need to reassign
      const needsReassignment = 
        data.startDateTimeISO !== undefined ||
        data.sectorId !== undefined ||
        (data.partySize !== undefined && data.partySize !== existingReservation.partySize);

      if (needsReassignment) {
        // Assign new table(s) (exclude current reservation from overlap check)
        const assignedTableIds = await assignTable(
          newSectorId,
          newStartDateTimeISO,
          newPartySize,
          reservationDurationMinutes,
          id // Exclude current reservation
        );
        
        if (!assignedTableIds || assignedTableIds.length === 0) {
          throw Errors.NO_CAPACITY('No available table(s) for the updated reservation parameters');
        }
        
        newTableIds = assignedTableIds;
      }
    }

    // Calculate new end time
    const startDate = new Date(newStartDateTimeISO);
    const endDate = addMinutesToDate(startDate, reservationDurationMinutes);
    const endDateTimeISO = formatISODateTime(endDate);

    // Update reservation
    const { updateReservation } = await import('../repositories/reservation.repository.js');
    const now = formatISODateTime(new Date());
    
    await updateReservation(id, {
      sectorId: newSectorId,
      tableIds: newTableIds,
      partySize: newPartySize,
      startDateTime: newStartDateTimeISO,
      endDateTime: endDateTimeISO,
      customerName: newCustomer.name,
      customerPhone: newCustomer.phone,
      customerEmail: newCustomer.email,
      notes: newNotes,
      updatedAt: now,
    });

    // Return updated reservation
    const updated = await getReservationById(id);
    if (!updated) {
      throw new Error('Failed to retrieve updated reservation');
    }

    return {
      id: updated.id,
      restaurantId: updated.restaurantId,
      sectorId: updated.sectorId,
      tableIds: updated.tableIds,
      partySize: updated.partySize,
      start: updated.startDateTime,
      end: updated.endDateTime,
      status: updated.status,
      customer: {
        name: updated.customerName,
        phone: updated.customerPhone,
        email: updated.customerEmail,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  } finally {
    releaseLock();
  }
}
