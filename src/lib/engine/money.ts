// =============================================================================
// Money helpers — FULL PRECISION is the rule.
//
// The workbook stores raw IEEE floats (e.g. medical 9090.90909…, net
// 936124.2515151515). We store and compute at full precision and round ONLY at
// the display/disbursement boundary. `r2` exists for that boundary, not for
// intermediate steps.
// =============================================================================

/** Round to 2 dp — DISPLAY/DISBURSEMENT ONLY. Never use mid-calculation. */
export function r2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/** Sum a list with a picker, at full precision. */
export function sumBy<T>(items: readonly T[], pick: (t: T) => number): number {
  return items.reduce((acc, t) => acc + (Number(pick(t)) || 0), 0);
}

/** Plain full-precision sum. */
export function sum(nums: readonly number[]): number {
  return nums.reduce((a, b) => a + (Number(b) || 0), 0);
}

/** Are two amounts equal within an epsilon (default 0.01 PKR)? */
export function approxEqual(a: number, b: number, eps = 0.01): boolean {
  return Math.abs(a - b) <= eps;
}

/** Coerce anything to a finite number, else 0. */
export function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
