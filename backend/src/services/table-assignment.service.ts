import { getEligibleTables, getTablesBySector } from '../repositories/table.repository.js';
import { getOverlappingReservations } from '../repositories/reservation.repository.js';
import { addMinutesToDate, formatISODateTime } from '../utils/datetime.js';

/**
 * Find a combination of tables that can accommodate the party size.
 * Returns an array of table IDs, or null if no combination is available.
 * 
 * Strategy:
 * 1. First try single table (best fit)
 * 2. If no single table fits, try combinations of 2, 3, etc. (up to maxTables)
 * 3. Prefer combinations that minimize number of tables and wasted capacity
 */
export async function assignTable(
  sectorId: string,
  startDateTimeISO: string,
  partySize: number,
  reservationDurationMinutes: number = 90,
  excludeReservationId?: string,
  maxTables: number = 5
): Promise<string[] | null> {
  // 1. Calculate end time
  const startDate = new Date(startDateTimeISO);
  const endDate = addMinutesToDate(startDate, reservationDurationMinutes);
  const endDateTimeISO = formatISODateTime(endDate);

  const startTime = new Date(startDateTimeISO).getTime();
  const endTime = new Date(endDateTimeISO).getTime();

  // 2. Try single table first (best fit)
  const eligibleTables = await getEligibleTables(sectorId, partySize);

  if (eligibleTables.length > 0) {
    // Sort by "best fit" - prefer tables with maxSize closest to partySize
    const sortedTables = eligibleTables.sort(
      (a, b) => (a.maxSize - partySize) - (b.maxSize - partySize)
    );

    for (const table of sortedTables) {
      const overlapping = await getOverlappingReservations(
        [table.id],
        startDateTimeISO,
        endDateTimeISO,
        excludeReservationId
      );

      const hasOverlap = overlapping.some((r) => {
        const rStart = new Date(r.startDateTime).getTime();
        const rEnd = new Date(r.endDateTime).getTime();
        return rStart < endTime && rEnd > startTime;
      });

      if (!hasOverlap) {
        return [table.id]; // Single table found
      }
    }
  }

  // 3. No single table fits - try combinations
  // Get all tables in sector (not just eligible ones)
  const allTables = await getTablesBySector(sectorId);

  if (allTables.length === 0) {
    return null;
  }

  // Filter tables that can contribute (minSize <= partySize)
  const candidateTables = allTables.filter(t => t.minSize <= partySize);

  if (candidateTables.length === 0) {
    return null;
  }

  // Sort by maxSize descending (prefer larger tables first)
  const sortedCandidates = candidateTables.sort((a, b) => b.maxSize - a.maxSize);

  // Try combinations of increasing size (2, 3, 4, ... up to maxTables)
  for (let numTables = 2; numTables <= maxTables && numTables <= sortedCandidates.length; numTables++) {
    const combination = await findTableCombination(
      sortedCandidates,
      partySize,
      numTables,
      startDateTimeISO,
      endDateTimeISO,
      startTime,
      endTime,
      excludeReservationId
    );

    if (combination) {
      return combination;
    }
  }

  return null; // No combination found
}

/**
 * Find a combination of exactly numTables tables that can accommodate partySize.
 * Uses a greedy approach: try combinations that minimize wasted capacity.
 */
async function findTableCombination(
  candidateTables: Array<{ id: string; minSize: number; maxSize: number }>,
  partySize: number,
  numTables: number,
  startDateTimeISO: string,
  endDateTimeISO: string,
  startTime: number,
  endTime: number,
  excludeReservationId?: string
): Promise<string[] | null> {
  // Generate combinations using a recursive approach
  // We'll use a greedy algorithm: try combinations starting with largest tables

  // Helper function to generate combinations
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

  // Try all combinations of numTables tables
  for (const tableIds of generateCombinations(candidateTables, numTables)) {
    // Check if combination has enough capacity
    const totalMinCapacity = tableIds.reduce((sum, tid) => {
      const table = candidateTables.find(t => t.id === tid);
      return sum + (table?.minSize || 0);
    }, 0);

    const totalMaxCapacity = tableIds.reduce((sum, tid) => {
      const table = candidateTables.find(t => t.id === tid);
      return sum + (table?.maxSize || 0);
    }, 0);

    // Must have enough capacity: minCapacity <= partySize <= maxCapacity
    if (totalMinCapacity > partySize || totalMaxCapacity < partySize) {
      continue;
    }

    // Check for overlaps
    const overlapping = await getOverlappingReservations(
      tableIds,
      startDateTimeISO,
      endDateTimeISO,
      excludeReservationId
    );

    const hasOverlap = overlapping.some((r) => {
      const rStart = new Date(r.startDateTime).getTime();
      const rEnd = new Date(r.endDateTime).getTime();
      return rStart < endTime && rEnd > startTime;
    });

    if (!hasOverlap) {
      // Found a valid combination - sort by table ID for consistency
      return tableIds.sort();
    }
  }

  return null;
}
