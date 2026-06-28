// =============================================================================
// Offboarding / final-settlement engine — owner-confirmed exit policy.
//
// Sits ON TOP of the verified core salary engine: the departing employee's
// final-month pay is the SAME prorated `computePayroll` row everyone else gets
// (so it still reconciles to the cent). This engine layers the EXIT POLICY on
// top of that net:
//
//   • LEFT and SERVED notice → final pay is OWED but DEFERRED. It is RELEASED on
//     the 20th (FINAL_SETTLEMENT_RELEASE_DAY) of the month AFTER the exit month.
//     status = 'scheduled', releaseDate set, disbursedNow = 0 (paid later).
//   • LEFT and did NOT serve notice → pay is HELD. status = 'held',
//     disbursedNow = 0, releaseDate = null. The computed amount is retained as a
//     reference (what they WOULD have been owed) but is not released.
//   • 'ghosted' (stopped showing up, no resignation) is treated as
//     notice-not-served regardless of the servedNotice flag → HELD.
//
// Earnings:
//   - final-month salary, prorated via computePayroll(...).net (the core engine).
//   - gratuity = completedYears × monthly basic, only once tenure ≥ 1 year.
//   - leave encashment — placeholder 0 (no policy data yet).
// Deductions:
//   - notice shortfall — only when applicable (currently 0; reserved hook).
//
// VERIFIED CONTROL CASES (from the dump 'ALL PAYROLL' / 'Technical Department'
// notes; reproduces the POLICY OUTCOME, the final-month net comes from the core
// engine which already matches the workbook to the cent):
//   • Awais Munir   — resigned, last day 22 May, served → SCHEDULED,
//       releaseDate 2026-06-20, final net 151,433.3333 (gross @22d).
//   • Umar Rashid   — last day 31 May, served ('20th' note) → SCHEDULED,
//       releaseDate 2026-06-20, final net 74,818.1818.
//   • Haiqa Ashfaq  — 'Ghosted without clarification - no salary' → HELD,
//       disbursedNow 0, releaseDate null.
//   • Laraib Naeem  — 'No salary - Notice Period not served' → HELD,
//       disbursedNow 0, releaseDate null.
//   • Hassan        — Draftsman, last day 12 May → prorated 12-day final pay,
//       net 14,000 (compute case).
// =============================================================================
import { FINAL_SETTLEMENT_RELEASE_DAY } from "./constants";
import { num } from "./money";
import { computePayroll } from "./salary";

/** Reason an employee left. Mirrors the app's ExitReason plus 'ghosted'. */
export type SettlementExitReason =
  | "resigned"
  | "terminated"
  | "contract_end"
  | "retired"
  | "ghosted"
  | "other";

/** Settlement lifecycle: deferred-and-owed, withheld, or already paid out. */
export type SettlementStatus = "scheduled" | "held" | "cleared";

/** One line on the settlement breakdown (earning or deduction). */
export interface SettlementLine {
  label: string;
  amount: number;
  note?: string;
}

export interface FinalSettlementInput {
  /** Monthly contract salary (col D) — the canonical core-engine input. */
  salary: number;
  /** Days worked in the FINAL month (out of 30). */
  days: number;
  /** Hire date (ISO yyyy-mm-dd) — drives tenure / gratuity. Null if unknown. */
  joinedOn: string | null;
  /** Last working day (ISO yyyy-mm-dd) — drives the release date. */
  leftOn: string;
  /** Why they left. 'ghosted' always forces the held path. */
  exitReason: SettlementExitReason;
  /** Whether they served their notice period. */
  servedNotice: boolean;
  /** Notice-shortfall deduction, if the policy levies one (default 0). */
  noticeShortfall?: number;
  /** Optional carved-out travel allowance, passed through to computePayroll. */
  travel?: number;
  /** Other final-month deductions / advance recovered, passed to computePayroll. */
  otherDeductions?: number;
  advance?: number;
}

export interface FinalSettlement {
  /** Earnings lines: prorated final salary, gratuity, leave encashment. */
  earnings: SettlementLine[];
  /** Deduction lines: notice shortfall, etc. */
  deductions: SettlementLine[];
  /** Sum of earnings (full precision). */
  grossEarnings: number;
  /** Sum of deductions (full precision). */
  totalDeductions: number;
  /** Net owed = grossEarnings − totalDeductions (full precision). */
  net: number;
  /** Completed FULL years of service at exit. */
  completedYears: number;
  /** scheduled (deferred & owed) | held (withheld) | cleared (paid). */
  status: SettlementStatus;
  /** ISO release date (20th of the month after exit); null when held. */
  releaseDate: string | null;
  /** Amount actually paid out NOW. 0 when scheduled (deferred) or held. */
  disbursedNow: number;
}

/**
 * Completed FULL years of service between joinedOn and leftOn.
 * Returns 0 when either date is missing or tenure is under a year.
 */
export function completedYearsOfService(
  joinedOn: string | null,
  leftOn: string,
): number {
  if (!joinedOn || !leftOn) return 0;
  const start = new Date(joinedOn);
  const end = new Date(leftOn);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  // Step back a year if the anniversary month/day hasn't been reached yet.
  const beforeAnniversary =
    end.getUTCMonth() < start.getUTCMonth() ||
    (end.getUTCMonth() === start.getUTCMonth() && end.getUTCDate() < start.getUTCDate());
  if (beforeAnniversary) years -= 1;
  return years < 0 ? 0 : years;
}

/**
 * The 20th (FINAL_SETTLEMENT_RELEASE_DAY) of the month AFTER the exit month,
 * as an ISO yyyy-mm-dd string. e.g. leftOn 2026-05-22 → 2026-06-20.
 */
export function settlementReleaseDate(leftOn: string): string {
  const d = new Date(leftOn);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`settlementReleaseDate: invalid leftOn "${leftOn}"`);
  }
  let year = d.getUTCFullYear();
  let month = d.getUTCMonth() + 1; // 0-based → next month (0-based index of next)
  if (month > 11) {
    month = 0;
    year += 1;
  }
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(FINAL_SETTLEMENT_RELEASE_DAY).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Whether the exit path is HELD (pay withheld). True when the employee did not
 * serve notice, OR ghosted (which always overrides the servedNotice flag).
 */
function isHeld(input: FinalSettlementInput): boolean {
  if (input.exitReason === "ghosted") return true;
  return !input.servedNotice;
}

/**
 * Build a departing employee's final settlement.
 *
 * Final-month pay reuses the verified core engine (computePayroll), so the
 * prorated net matches the workbook to the cent. Gratuity = completedYears ×
 * monthly basic for tenure ≥ 1 year. Leave encashment is a 0 placeholder.
 *
 * Policy outcome:
 *   served notice  → status 'scheduled', releaseDate = 20th of next month,
 *                    disbursedNow = 0 (deferred, still owed).
 *   not served / ghosted → status 'held', releaseDate = null, disbursedNow = 0.
 */
export function computeFinalSettlement(input: FinalSettlementInput): FinalSettlement {
  const salary = num(input.salary);
  const days = num(input.days);

  // --- Final-month pay via the proven core engine -------------------------
  const pay = computePayroll({
    salary,
    days,
    travel: input.travel,
    otherDeductions: input.otherDeductions,
    advance: input.advance,
  });

  // --- Gratuity: completedYears × monthly basic, only at ≥ 1 year ---------
  const completedYears = completedYearsOfService(input.joinedOn, input.leftOn);
  const gratuity = completedYears >= 1 ? completedYears * pay.basic : 0;

  const earnings: SettlementLine[] = [
    {
      label: "Final month salary",
      amount: pay.net,
      note: `${days}/30 days worked`,
    },
  ];
  if (gratuity > 0) {
    earnings.push({
      label: "Gratuity",
      amount: gratuity,
      note: `${completedYears} completed year${completedYears > 1 ? "s" : ""} × basic`,
    });
  }
  earnings.push({ label: "Leave encashment", amount: 0, note: "No accrued-leave policy data" });

  // --- Deductions: notice shortfall (reserved hook) -----------------------
  const noticeShortfall = num(input.noticeShortfall);
  const deductions: SettlementLine[] = [];
  if (noticeShortfall > 0) {
    deductions.push({
      label: "Notice-period shortfall",
      amount: noticeShortfall,
      note: "Notice not fully served",
    });
  }

  const grossEarnings = earnings.reduce((a, l) => a + l.amount, 0);
  const totalDeductions = deductions.reduce((a, l) => a + l.amount, 0);
  const net = grossEarnings - totalDeductions;

  // --- Policy: held vs scheduled ------------------------------------------
  const held = isHeld(input);
  const status: SettlementStatus = held ? "held" : "scheduled";
  const releaseDate = held ? null : settlementReleaseDate(input.leftOn);
  // Deferred (scheduled) pay is owed but not released NOW; held pay is withheld.
  const disbursedNow = 0;

  return {
    earnings,
    deductions,
    grossEarnings,
    totalDeductions,
    net,
    completedYears,
    status,
    releaseDate,
    disbursedNow,
  };
}
