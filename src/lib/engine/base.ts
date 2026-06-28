// =============================================================================
// Low-level salary primitives shared by salary.ts and tax.ts (no cycle).
// =============================================================================
import { MEDICAL_NUMERATOR, MEDICAL_DENOMINATOR } from "./constants";
import { num } from "./money";

/** Medical allowance = salary × 10/110 (= salary ÷ 11). Tax-exempt. */
export function medicalOf(salary: number): number {
  return (num(salary) * MEDICAL_NUMERATOR) / MEDICAL_DENOMINATOR;
}
