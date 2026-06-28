// =============================================================================
// Overtime engine (Estimation team only) — sheet "Overtime May 2026".
//
// Pays technical staff for hours worked beyond the standard month. The basis is
// NOT the payroll "basic": it is 65% of GROSS salary, spread over a fixed
// 176-hour standard month (22 working days × 8 h). Each hour is then paid at a
// day-type multiplier (May 2026 used 'normal' = 1.5× for every row).
//
//   rate    = (gross × OT_BASIC_FACTOR) / OT_STANDARD_HOURS          // per hour
//   amount  = totalHours × rate × OT_MULTIPLIER[dayType]
//   totalHours = weekdayHours + weekendHours
//   subTotal = amount + bonus + previousPending
//
// Probation: no overtime is earned during probation → amount 0 (subTotal still
// carries any bonus / previousPending so nothing owed is silently dropped).
//
// MODELLED BUG (faithfully reproduced, then corrected):
//   The sheet pulls each person's gross from the PRIOR-month external file, so a
//   few grosses are STALE. We bind the engine to the CURRENT-month payroll gross
//   and expose `staleGross` when an input gross disagrees, so the difference is
//   auditable instead of hidden.
//
// VERIFIED CONTROL TOTALS (sheet col I total, cell I17):
//   • Using the sheet's STALE grosses               → 15,092.10255681818
//     (e.g. Shehroz gross 75,000, 7.14 h → 2,966.548)
//   • "Honest" recomputation with CURRENT grosses   →    14,103.25312500
//     (Shehroz's true gross 50,000, 7.14 h → 1,977.699)
//   The only row that moves is Shehroz; the delta is exactly 988.849432.
//   Spot rows: Uzaer 102000/2.18 h → 1231.824; Rafia 150000/5.34 → 4437.358;
//   Zain 125000/6.25 → 4327.947; Mahnoor 64900/5.92 → 2128.425.
// =============================================================================
import { num, sumBy, approxEqual } from "./money";
import {
  OT_BASIC_FACTOR,
  OT_STANDARD_HOURS,
  OT_MULTIPLIER,
  type OvertimeDayType,
} from "./constants";

/** One person's overtime claim for the month. */
export interface OvertimeInput {
  /** Display name (for traceability / reporting). */
  name: string;
  /**
   * The gross salary the SHEET used for this row — may be stale (prior month).
   * Pass this when reproducing the workbook's stored I-column figures.
   */
  sheetGross: number;
  /**
   * The CURRENT-month payroll gross for this person. When provided and it
   * differs from `sheetGross`, the row is flagged `staleGross` and `amount`
   * is computed from THIS value (the honest figure).
   */
  currentGross?: number;
  /** Hours worked on normal weekdays. */
  weekdayHours?: number;
  /** Hours worked on weekends. */
  weekendHours?: number;
  /** Day-type multiplier bucket (May 2026 = 'normal'). Defaults to 'normal'. */
  dayType?: OvertimeDayType;
  /** Flat bonus added to the sub-total (not multiplied by the rate). */
  bonus?: number;
  /** Carried-forward unpaid overtime from a prior month. */
  previousPending?: number;
  /** True while the employee is on probation → no overtime is earned. */
  onProbation?: boolean;
}

/** Fully-resolved overtime line for one person. */
export interface OvertimeLine {
  name: string;
  /** Gross actually used to compute the amount (current if given, else sheet). */
  gross: number;
  /** Per-hour overtime rate = gross × 0.65 / 176. */
  ratePerHour: number;
  dayType: OvertimeDayType;
  multiplier: number;
  weekdayHours: number;
  weekendHours: number;
  totalHours: number;
  bonus: number;
  previousPending: number;
  onProbation: boolean;
  /** Overtime earned = totalHours × rate × multiplier (0 on probation). */
  amount: number;
  /** amount + bonus + previousPending. */
  subTotal: number;
  /** True when the sheet's gross differs from the current-month gross. */
  staleGross: boolean;
}

/** Aggregate of a roster of overtime lines. */
export interface OvertimeRegister {
  lines: OvertimeLine[];
  /** Sum of `amount` across all lines — reproduces sheet cell I17. */
  totalAmount: number;
  /** Sum of `subTotal` across all lines. */
  totalSubTotal: number;
  /** Sum of overtime hours across all lines. */
  totalHours: number;
  /** Lines whose sheet gross disagrees with the current-month gross. */
  staleRows: OvertimeLine[];
}

/**
 * Per-hour overtime rate for a given gross salary.
 *   rate = gross × OT_BASIC_FACTOR / OT_STANDARD_HOURS
 * Full precision — never round here.
 */
export function overtimeRate(gross: number): number {
  return (num(gross) * OT_BASIC_FACTOR) / OT_STANDARD_HOURS;
}

/**
 * Resolve one overtime row.
 * Binds to `currentGross` when supplied (the honest figure); otherwise uses
 * `sheetGross` (reproduces the workbook's stale value). Sets `staleGross` when
 * the two disagree. Returns amount 0 during probation.
 */
export function computeOvertimeLine(input: OvertimeInput): OvertimeLine {
  const name = input.name;
  const sheetGross = num(input.sheetGross);
  const hasCurrent = input.currentGross !== undefined && input.currentGross !== null;
  const currentGross = hasCurrent ? num(input.currentGross) : sheetGross;
  // The gross the engine actually pays on: current-month when known, else sheet.
  const gross = hasCurrent ? currentGross : sheetGross;

  const dayType: OvertimeDayType = input.dayType ?? "normal";
  const multiplier = OT_MULTIPLIER[dayType];

  const weekdayHours = num(input.weekdayHours);
  const weekendHours = num(input.weekendHours);
  const totalHours = weekdayHours + weekendHours;

  const bonus = num(input.bonus);
  const previousPending = num(input.previousPending);
  const onProbation = Boolean(input.onProbation);

  const ratePerHour = overtimeRate(gross);
  // No overtime is earned during probation.
  const amount = onProbation ? 0 : totalHours * ratePerHour * multiplier;
  const subTotal = amount + bonus + previousPending;

  const staleGross = hasCurrent && !approxEqual(sheetGross, currentGross);

  return {
    name,
    gross,
    ratePerHour,
    dayType,
    multiplier,
    weekdayHours,
    weekendHours,
    totalHours,
    bonus,
    previousPending,
    onProbation,
    amount,
    subTotal,
    staleGross,
  };
}

/**
 * Build the overtime register for a whole roster and total it.
 * `totalAmount` reproduces the sheet's I17 column total.
 */
export function computeOvertimeRegister(inputs: readonly OvertimeInput[]): OvertimeRegister {
  const lines = inputs.map(computeOvertimeLine);
  return {
    lines,
    totalAmount: sumBy(lines, (l) => l.amount),
    totalSubTotal: sumBy(lines, (l) => l.subTotal),
    totalHours: sumBy(lines, (l) => l.totalHours),
    staleRows: lines.filter((l) => l.staleGross),
  };
}
