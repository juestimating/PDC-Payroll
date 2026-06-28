// =============================================================================
// Payroll engine — invariants and policy constants.
//
// These are the locked rules extracted (and CA-level verified) from the real
// "Payroll May 2026" workbook. They are deliberately centralised so the few
// genuine business-policy numbers (FX rate, allocation splits) live in ONE place
// and stay auditable. Nothing here rounds — rounding is a display concern.
// =============================================================================

/**
 * Proration divisor is a FIXED 30, never the calendar day count. Every sheet
 * prorates with `days/30` even in a 31-day month. Do not "fix" this to 31.
 */
export const DAYS_IN_PAYROLL_MONTH = 30;

/**
 * Medical allowance = salary × 10/110 (i.e. salary ÷ 11). It is tax-exempt.
 * Basic = salary − medical − travel. The three always reconstitute the salary.
 */
export const MEDICAL_NUMERATOR = 10;
export const MEDICAL_DENOMINATOR = 110;

/**
 * FBR 2025-26 ANNUAL salaried withholding slabs: [upperBound, baseTax, rate].
 * Tax on annual taxable income A = baseTax + (A − previousUpper) × rate for the
 * band A falls in. Verified against every stored WHT figure in the workbook.
 */
export const FBR_SLABS: ReadonlyArray<readonly [upper: number, base: number, rate: number]> = [
  [600_000, 0, 0],
  [1_200_000, 0, 0.01],
  [2_200_000, 6_000, 0.11],
  [3_200_000, 116_000, 0.23],
  [4_100_000, 346_000, 0.3],
  [Number.POSITIVE_INFINITY, 616_000, 0.35],
];

// ---- Overtime (Estimation team only) ----------------------------------------
/** Overtime is paid on 65% of GROSS salary (NOT the payroll "basic"). */
export const OT_BASIC_FACTOR = 0.65;
/** Standard monthly hours = 22 working days × 8 hours. */
export const OT_STANDARD_HOURS = 22 * 8; // 176
/** Hour-rate multipliers by day type. */
export const OT_MULTIPLIER = {
  normal: 1.5, // weekday / normal day
  govt: 2, // government holiday
  eid: 2.5, // Eid holiday
} as const;
export type OvertimeDayType = keyof typeof OT_MULTIPLIER;

// ---- Sales incentives --------------------------------------------------------
/**
 * Default USD→PKR rate used to convert USD-denominated commission into PKR.
 * This is a per-month business parameter (overridable), not a market rate.
 */
export const DEFAULT_FX_PKR_PER_USD = 275;

// ---- Entities ----------------------------------------------------------------
/** The three owner entities payroll is allocated across (one shared database). */
export const ENTITY_CODES = ["JU", "PDC", "B4U"] as const;
export type EntityCode = (typeof ENTITY_CODES)[number];

export const ENTITY_NAME: Record<EntityCode, string> = {
  JU: "JU Estimation",
  PDC: "Pavilion Design Consultants",
  B4U: "B4U",
};

// ---- Offboarding / notice policy --------------------------------------------
/**
 * Company exit-pay policy (owner-confirmed):
 *  - Left AND served notice  → final salary is RELEASED on the 20th of the
 *    following month (deferred, still owed).
 *  - Left AND did NOT serve notice → pay is HELD (not disbursed).
 */
export const FINAL_SETTLEMENT_RELEASE_DAY = 20;

// ---- Precision ---------------------------------------------------------------
/** Tolerance for reconciling a recomputed total against a stored/sheet total. */
export const RECONCILE_EPSILON = 0.01;
