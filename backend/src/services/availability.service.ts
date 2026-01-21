import { getRestaurantById } from '../repositories/restaurant.repository.js';
import { getTablesBySector } from '../repositories/table.repository.js';
import { getReservationsByDay } from '../repositories/reservation.repository.js';
import { generate15MinSlots, isWithinShift, addMinutesToDate, formatISODateTime } from '../utils/datetime.js';
import { Errors } from '../utils/errors.js';

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

  // 4. Get ALL reservations for the day ONCE (optimization: single query)
  // Pass timezone so it can calculate day bounds correctly
  const allReservations = await getReservationsByDay(
    restaurantId,
    date,
    sectorId,
    restaurant.timezone
  );

  // 5. Get reservation duration from restaurant (default to 90 if not set)
  const reservationDurationMinutes = restaurant.reservationDurationMinutes || 90;

  // 6. Generate 15-minute slots for the day
  const slots = generate15MinSlots(
    date,
    restaurant.timezone,
    restaurant.shifts || undefined,
    reservationDurationMinutes
  );

  // 7. Process slots in memory (no additional DB queries)
  const availability: AvailabilitySlot[] = [];

  for (const slotStart of slots) {
    const slotStartISO = formatISODateTime(slotStart);
    const slotEnd = addMinutesToDate(slotStart, reservationDurationMinutes);
    const slotEndISO = formatISODateTime(slotEnd);

    // Check if slot is within shifts
    if (!isWithinShift(slotStart, restaurant.timezone, restaurant.shifts || undefined)) {
      continue; // Skip slots outside shifts
    }

    // Check for available tables (in memory - no DB queries)
    const availableTableIds: string[] = [];

    for (const table of eligibleTables) {
      // Check overlaps in memory using timestamp comparison
      const slotStartTime = new Date(slotStartISO).getTime();
      const slotEndTime = new Date(slotEndISO).getTime();

      const hasOverlap = allReservations.some((r) => {
        const rStartTime = new Date(r.startDateTime).getTime();
        const rEndTime = new Date(r.endDateTime).getTime();

        // Overlap: (r.start < slotEnd) AND (r.end > slotStart)
        const overlaps = rStartTime < slotEndTime && rEndTime > slotStartTime;
        return overlaps && r.tableIds.includes(table.id);
      });

      if (!hasOverlap) {
        availableTableIds.push(table.id);
      }
    }

    // Slot is available if there's at least one table without overlap
    availability.push({
      start: slotStartISO,
      available: availableTableIds.length > 0,
      tables: availableTableIds.length > 0 ? availableTableIds : undefined,
      reason: availableTableIds.length === 0 ? 'no_capacity' : undefined,
    });
  }

  return availability;
}
