import { getRestaurantById } from '../repositories/restaurant.repository.js';
import { getTablesBySector } from '../repositories/table.repository.js';
import { getOverlappingReservations } from '../repositories/reservation.repository.js';
import { generate15MinSlots, isWithinShift, addMinutesToDate, formatISODateTime } from '../utils/datetime.js';
import { Errors } from '../utils/errors.js';

const RESERVATION_DURATION_MINUTES = 90;

export interface AvailabilitySlot {
  start: string;
  available: boolean;
  tables?: string[];
  reason?: string;
}

export async function getAvailability(
  restaurantId: string,
  sectorId: string,
  date: Date,
  partySize: number
): Promise<AvailabilitySlot[]> {
  // 1. Get restaurant (for timezone and shifts)
  const restaurant = await getRestaurantById(restaurantId);
  if (!restaurant) {
    throw Errors.NOT_FOUND('Restaurant');
  }

  // 2. Get all tables in sector
  const tables = await getTablesBySector(sectorId);
  if (tables.length === 0) {
    throw Errors.NOT_FOUND('Sector');
  }

  // 3. Filter eligible tables
  const eligibleTables = tables.filter(
    (t) => t.minSize <= partySize && partySize <= t.maxSize
  );

  // 4. Generate 15-minute slots for the day
  const slots = generate15MinSlots(date, restaurant.timezone, restaurant.shifts || undefined);

  // 5. For each slot, check availability
  const availability: AvailabilitySlot[] = [];

  for (const slotStart of slots) {
    const slotStartISO = formatISODateTime(slotStart);
    const slotEnd = addMinutesToDate(slotStart, RESERVATION_DURATION_MINUTES);
    const slotEndISO = formatISODateTime(slotEnd);

    // Check if slot is within shifts
    if (!isWithinShift(slotStart, restaurant.timezone, restaurant.shifts || undefined)) {
      continue; // Skip slots outside shifts
    }

    // Check for available tables
    const availableTableIds: string[] = [];

    for (const table of eligibleTables) {
      const overlapping = await getOverlappingReservations(
        [table.id],
        slotStartISO,
        slotEndISO
      );

      if (overlapping.length === 0) {
        availableTableIds.push(table.id);
      }
    }

    availability.push({
      start: slotStartISO,
      available: availableTableIds.length > 0,
      tables: availableTableIds.length > 0 ? availableTableIds : undefined,
      reason: availableTableIds.length === 0 ? 'no_capacity' : undefined,
    });
  }

  return availability;
}
