import { getRestaurantById } from '../repositories/restaurant.repository.js';
import { getSectorById } from '../repositories/sector.repository.js';
import { getTablesBySector } from '../repositories/table.repository.js';
import { getReservationsByDay, getOverlappingReservations } from '../repositories/reservation.repository.js';
import { generate15MinSlots, isWithinShift, addMinutesToDate, formatISODateTime } from '../utils/datetime.js';
import { calculateReservationDuration } from '../utils/duration.js';
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

  // 2. Verify sector exists first
  const sector = await getSectorById(sectorId);
  if (!sector) {
    throw Errors.NOT_FOUND('Sector');
  }

  // 3. Get all tables in sector
  const tables = await getTablesBySector(sectorId);
  if (tables.length === 0) {
    throw Errors.NOT_FOUND(`No tables found for sector ${sectorId}`);
  }

  // 4. Filter eligible tables
  const eligibleTables = tables.filter(
    (t) => t.minSize <= partySize && partySize <= t.maxSize
  );

  // 5. Get ALL reservations for the day ONCE (optimization: single query)
  // Pass timezone so it can calculate day bounds correctly
  const allReservations = await getReservationsByDay(
    restaurantId,
    date,
    sectorId,
    restaurant.timezone
  );

  // 6. Calculate reservation duration for this party size
  const reservationDurationMinutes = calculateReservationDuration(
    partySize,
    restaurant.durationRules || undefined,
    restaurant.reservationDurationMinutes || 90
  );

  // 7. Generate 15-minute slots for the day
  // Use max duration from rules to ensure all possible slots are generated
  const maxDuration = restaurant.durationRules && restaurant.durationRules.length > 0
    ? Math.max(...restaurant.durationRules.map(r => r.durationMinutes))
    : reservationDurationMinutes;

  const slots = generate15MinSlots(
    date,
    restaurant.timezone,
    restaurant.shifts || undefined,
    maxDuration
  );

  // 8. Process slots in memory (no additional DB queries)
  const availability: AvailabilitySlot[] = [];

  const now = Date.now();
  for (const slotStart of slots) {
    if (slotStart.getTime() < now) continue;
    const slotStartISO = formatISODateTime(slotStart);
    // Use party-size-specific duration for overlap checking
    const slotEnd = addMinutesToDate(slotStart, reservationDurationMinutes);
    const slotEndISO = formatISODateTime(slotEnd);

    // Check if slot is within shifts
    if (!isWithinShift(slotStart, restaurant.timezone, restaurant.shifts || undefined)) {
      continue; // Skip slots outside shifts
    }

    // Check for available tables (single or combinations)
    const slotStartTime = new Date(slotStartISO).getTime();
    const slotEndTime = new Date(slotEndISO).getTime();

    // First, try single tables
    const availableSingleTables: string[] = [];
    for (const table of eligibleTables) {
      const hasOverlap = allReservations.some((r) => {
        const rStartTime = new Date(r.startDateTime).getTime();
        const rEndTime = new Date(r.endDateTime).getTime();
        const overlaps = rStartTime < slotEndTime && rEndTime > slotStartTime;
        return overlaps && r.tableIds.includes(table.id);
      });

      if (!hasOverlap) {
        availableSingleTables.push(table.id);
      }
    }

    // If single tables available, use them
    if (availableSingleTables.length > 0) {
      availability.push({
        start: slotStartISO,
        available: true,
        tables: availableSingleTables,
      });
      continue;
    }

    // No single table fits - check for combinations
    // Get all tables that could contribute (minSize <= partySize)
    const candidateTables = tables.filter(t => t.minSize <= partySize);

    // Try to find a combination (2-5 tables)
    let foundCombination: string[] | null = null;
    const maxTables = 5;

    for (let numTables = 2; numTables <= maxTables && numTables <= candidateTables.length; numTables++) {
      // Generate combinations and check availability
      const combination = await findAvailableCombination(
        candidateTables,
        partySize,
        numTables,
        slotStartISO,
        slotEndISO,
        slotStartTime,
        slotEndTime,
        allReservations
      );

      if (combination) {
        foundCombination = combination;
        break; // Use first valid combination found
      }
    }

    if (foundCombination) {
      availability.push({
        start: slotStartISO,
        available: true,
        tables: foundCombination.sort(), // Sort for consistency
      });
    } else {
      availability.push({
        start: slotStartISO,
        available: false,
        reason: 'no_capacity',
      });
    }
  }

  return availability;
}

/**
 * Find an available combination of tables for a slot.
 * Returns table IDs if a valid combination is found, null otherwise.
 */
async function findAvailableCombination(
  candidateTables: Array<{ id: string; minSize: number; maxSize: number }>,
  partySize: number,
  numTables: number,
  slotStartISO: string,
  slotEndISO: string,
  slotStartTime: number,
  slotEndTime: number,
  allReservations: Array<{ startDateTime: string; endDateTime: string; tableIds: string[] }>
): Promise<string[] | null> {
  // Helper to generate combinations
  function* generateCombinations(
    arr: Array<{ id: string; minSize: number; maxSize: number }>,
    k: number
  ): Generator<string[]> {
    if (k === 1) {
      for (const item of arr) {
        yield [item.id];
      }
      return;
    }

    for (let i = 0; i <= arr.length - k; i++) {
      const rest = arr.slice(i + 1);
      for (const combo of generateCombinations(rest, k - 1)) {
        yield [arr[i].id, ...combo];
      }
    }
  }

  // Try all combinations of numTables
  for (const tableIds of generateCombinations(candidateTables, numTables)) {
    // Check capacity
    const totalMinCapacity = tableIds.reduce((sum, tid) => {
      const table = candidateTables.find(t => t.id === tid);
      return sum + (table?.minSize || 0);
    }, 0);

    const totalMaxCapacity = tableIds.reduce((sum, tid) => {
      const table = candidateTables.find(t => t.id === tid);
      return sum + (table?.maxSize || 0);
    }, 0);

    // Must have enough capacity
    if (totalMinCapacity > partySize || totalMaxCapacity < partySize) {
      continue;
    }

    // Check for overlaps
    const hasOverlap = allReservations.some((r) => {
      const rStartTime = new Date(r.startDateTime).getTime();
      const rEndTime = new Date(r.endDateTime).getTime();
      const overlaps = rStartTime < slotEndTime && rEndTime > slotStartTime;

      // Check if any table in the combination overlaps with any table in the reservation
      return overlaps && r.tableIds.some(tid => tableIds.includes(tid));
    });

    if (!hasOverlap) {
      return tableIds.sort(); // Found valid combination
    }
  }

  return null;
}
