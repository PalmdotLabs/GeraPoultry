/**
 * Calculate hen-day egg production for one flock on one date.
 *
 * `eggsLaid` is the total number laid, regardless of grade or stock treatment.
 * `liveLayingHens` is the live laying-hen count for that same flock and date.
 * Returns null when the rate is undefined because there were no live hens.
 */
export function calculateHenDayProductionRate(
  eggsLaid: number,
  liveLayingHens: number,
): number | null {
  assertNonNegativeWholeNumber(eggsLaid, 'eggsLaid');
  assertNonNegativeWholeNumber(liveLayingHens, 'liveLayingHens');

  if (liveLayingHens === 0) {
    return null;
  }

  return (eggsLaid / liveLayingHens) * 100;
}

function assertNonNegativeWholeNumber(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative whole number.`);
  }
}
