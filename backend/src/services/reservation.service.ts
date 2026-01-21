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

    // 3. Get reservation duration from restaurant (default to 90 if not set)
    const reservationDurationMinutes = restaurant.reservationDurationMinutes || 90;

    // 4. Assign table (within lock to prevent race conditions)
    const tableId = await assignTable(
      data.sectorId,
      data.startDateTimeISO,
      data.partySize,
      reservationDurationMinutes
    );
    if (!tableId) {
      throw Errors.NO_CAPACITY();
    }

    // 5. Calculate end time
    const endDate = addMinutesToDate(startDate, reservationDurationMinutes);
    const endDateTimeISO = formatISODateTime(endDate);

    // 6. Create reservation
    const now = formatISODateTime(new Date());
    const reservationId = `RES_${nanoid(8).toUpperCase()}`;

    const reservation = await createReservation({
      id: reservationId,
      restaurantId: data.restaurantId,
      sectorId: data.sectorId,
      tableIds: [tableId],
      partySize: data.partySize,
      startDateTime: data.startDateTimeISO,
      endDateTime: endDateTimeISO,
      status: 'CONFIRMED',
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

    // 7. Format response
    return {
      id: reservation.id,
      restaurantId: reservation.restaurantId,
      sectorId: reservation.sectorId,
      tableIds: reservation.tableIds,
      partySize: reservation.partySize,
      start: reservation.startDateTime,
      end: reservation.endDateTime,
      status: reservation.status,
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
