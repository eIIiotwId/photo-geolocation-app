/**
 * Normalizes GPS coordinates to decimal numbers.
 * Handles both decimal format and array format [degrees, minutes, seconds].
 */
export function normalizeGps(
  value: number | number[] | undefined | null
): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return value;
  if (Array.isArray(value) && value.length >= 3) {
    // Convert [degrees, minutes, seconds] to decimal
    return value[0] + value[1] / 60 + value[2] / 3600;
  }
  return null;
}

