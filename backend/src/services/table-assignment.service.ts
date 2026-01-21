import { getEligibleTables } from '../repositories/table.repository.js';
import { getOverlappingReservations } from '../repositories/reservation.repository.js';
import { addMinutesToDate, formatISODateTime } from '../utils/datetime.js';

export async function assignTable(
  sectorId: string,
  startDateTimeISO: string,
  partySize: number,
  reservationDurationMinutes: number = 90
): Promise<string | null> {
  // 1. Get eligible tables (minSize <= partySize <= maxSize)
  const eligibleTables = await getEligibleTables(sectorId, partySize);

  if (eligibleTables.length === 0) {
    return null;
  }

  // 2. Calculate end time
  const startDate = new Date(startDateTimeISO);
  const endDate = addMinutesToDate(startDate, reservationDurationMinutes);
  const endDateTimeISO = formatISODateTime(endDate);

  // 3. Sort by "best fit" - prefer tables with maxSize closest to partySize
  // This minimizes wasted capacity
  const sortedTables = eligibleTables.sort(
    (a, b) => (a.maxSize - partySize) - (b.maxSize - partySize)
  );

  // 4. Find first table without overlap
  // Use timestamp comparison to handle timezone differences
  const startTime = new Date(startDateTimeISO).getTime();
  const endTime = new Date(endDateTimeISO).getTime();

  for (const table of sortedTables) {
    const overlapping = await getOverlappingReservations(
      [table.id],
      startDateTimeISO,
      endDateTimeISO
    );

    // Double-check with timestamp comparison
    const hasOverlap = overlapping.some((r) => {
      const rStart = new Date(r.startDateTime).getTime();
      const rEnd = new Date(r.endDateTime).getTime();
      return rStart < endTime && rEnd > startTime;
    });

    if (!hasOverlap) {
      return table.id;
    }
  }

  return null; // No available table
}
