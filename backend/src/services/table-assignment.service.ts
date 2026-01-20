import { getEligibleTables } from '../repositories/table.repository.js';
import { getOverlappingReservations } from '../repositories/reservation.repository.js';
import { addMinutesToDate, formatISODateTime } from '../utils/datetime.js';

const RESERVATION_DURATION_MINUTES = 90;

export async function assignTable(
  sectorId: string,
  startDateTimeISO: string,
  partySize: number
): Promise<string | null> {
  // 1. Get eligible tables (minSize <= partySize <= maxSize)
  const eligibleTables = await getEligibleTables(sectorId, partySize);

  if (eligibleTables.length === 0) {
    return null;
  }

  // 2. Calculate end time
  const startDate = new Date(startDateTimeISO);
  const endDate = addMinutesToDate(startDate, RESERVATION_DURATION_MINUTES);
  const endDateTimeISO = formatISODateTime(endDate);

  // 3. Sort by "best fit" - prefer tables with maxSize closest to partySize
  // This minimizes wasted capacity
  const sortedTables = eligibleTables.sort(
    (a, b) => (a.maxSize - partySize) - (b.maxSize - partySize)
  );

  // 4. Find first table without overlap
  for (const table of sortedTables) {
    const overlapping = await getOverlappingReservations(
      [table.id],
      startDateTimeISO,
      endDateTimeISO
    );

    if (overlapping.length === 0) {
      return table.id;
    }
  }

  return null; // No available table
}
