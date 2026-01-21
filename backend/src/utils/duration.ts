/**
 * Calculate reservation duration based on party size and duration rules.
 * Falls back to default duration if no rules are defined.
 */
export function calculateReservationDuration(
  partySize: number,
  durationRules?: Array<{ maxPartySize: number; durationMinutes: number }>,
  defaultDurationMinutes: number = 90
): number {
  if (!durationRules || durationRules.length === 0) {
    return defaultDurationMinutes;
  }

  // Sort rules by maxPartySize ascending
  const sortedRules = [...durationRules].sort((a, b) => a.maxPartySize - b.maxPartySize);

  // Find the first rule where partySize <= maxPartySize
  for (const rule of sortedRules) {
    if (partySize <= rule.maxPartySize) {
      return rule.durationMinutes;
    }
  }

  // If party size exceeds all rules, use the last (largest) rule
  return sortedRules[sortedRules.length - 1].durationMinutes;
}

/**
 * Example duration rules:
 * [
 *   { maxPartySize: 2, durationMinutes: 75 },
 *   { maxPartySize: 4, durationMinutes: 90 },
 *   { maxPartySize: 8, durationMinutes: 120 },
 *   { maxPartySize: 999, durationMinutes: 150 } // catch-all for >8
 * ]
 */
