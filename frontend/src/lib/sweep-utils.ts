/**
 * Sweep utility functions for batch mode.
 * Cartesian product, value generation, combo counting, size estimation.
 */

/**
 * Generate discrete values from min/max/step range.
 * Handles floating-point precision by rounding to step's decimal places.
 */
export function generateValues(min: number, max: number, step: number): number[] {
  if (step <= 0) return [];
  if (min > max) return [];
  if (min === max) return [min];

  const decimals = countDecimals(step);
  const values: number[] = [];
  let current = min;

  while (current <= max + step * 1e-9) {
    const rounded = parseFloat(current.toFixed(decimals));
    if (rounded > max) break;
    values.push(rounded);
    current += step;
  }

  return values;
}

/**
 * Compute cartesian product of multiple arrays.
 * cartesianProduct([[1,2], [3,4]]) → [[1,3], [1,4], [2,3], [2,4]]
 */
export function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]];
  if (arrays.some((a) => a.length === 0)) return [];

  return arrays.reduce<T[][]>(
    (acc, arr) => acc.flatMap((combo) => arr.map((val) => [...combo, val])),
    [[]],
  );
}

/**
 * Count total combinations without materializing the product.
 * Returns the product of all array lengths.
 */
export function countCombinations(valueSets: number[][]): number {
  if (valueSets.length === 0) return 1;
  return valueSets.reduce((product, set) => product * set.length, 1);
}

/**
 * Estimate total storage in bytes for a batch.
 */
export function estimateSizeBytes(
  totalRuns: number,
  avgFileSizeBytes: number,
): number {
  if (totalRuns <= 0) return 0;
  return totalRuns * avgFileSizeBytes;
}

/**
 * Format byte count as human-readable string.
 * e.g., 1024 → "1.0 KB", 1048576 → "1.0 MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Count decimal places in a number (for rounding precision). */
function countDecimals(n: number): number {
  const str = String(n);
  const idx = str.indexOf(".");
  return idx === -1 ? 0 : str.length - idx - 1;
}
