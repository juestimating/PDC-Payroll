// =============================================================================
// Sales incentives / commission engine — sheet 'Sales - Incentives (May)'.
//
// Each rep row carries four EARNED components and one PAYABLE:
//   C prevIncremental   — carried-over incremental from a prior month
//   D prevIncentive     — carried-over incentive from a prior month
//   E incentive         — FX-commission earned on sales: saleUSD × % × 275
//   F bonus             — discretionary bonus
//   G accruedTotal      = SUM(C:F)   (books the FULL P&L Sales-Commissions line)
//   I payable           = the CASH actually disbursed this run
//
// Payout policy (owner-confirmed, faithfully reproduced incl. the row-7 quirk):
//   • normal (KPI met)              → payable I = accrued G
//   • KPI NOT met & bonus held      → payable I = incentive E only; withhold F
//   • 'Already Paid'                → payable I = 0 (stays in accrual G)
//   • manual override               → pays the FULL accrued G despite a held
//                                     note (row 7 Muhammad Nabeel: paid 31,408
//                                     in full even though the note says held) —
//                                     surfaced as a validation WARNING.
//
// withheld = accrued − payable (per row); the cash gap to the accrual is
// Σ withheld(held rows) + Σ accrued(already-paid rows).
//
// FX incentive formula: incentive = Σ(tier.saleValueUsd × tier.rate) × fxRate,
// fxRate defaulting to 275 PKR/USD (a per-month business parameter, not a market
// rate). Single-tier example E3 = 5000 × 1% × 275 = 13,750; the tiered scratch
// example 5000@1% + 11000@0.5%, each × 275, sums to 28,875.
//
// VERIFIED CONTROL TOTALS reproduced (Sales - Incentives (May)):
//   E15 incentives = 118,676   F15 bonus    = 112,026   G15 accrued = 230,702
//   I15 payable    = 162,581   withheld     = 37,163  (= Σ bonus on held rows)
//   accrued − payable = 68,121 = 37,163 withheld + 30,958 already-paid (Maryam).
//   Expense books FULL accrual G15 (230,702); cash out is I15 (162,581).
// =============================================================================
import { num, sumBy } from "./money";
import { DEFAULT_FX_PKR_PER_USD } from "./constants";

/** Payout outcome for a single incentive row. */
export type IncentiveStatus = "payable" | "held" | "already_paid";

/** One sale tier: a USD sale slice taxed at a commission rate (e.g. 0.01 = 1%). */
export interface CommissionTier {
  /** Sale value attributable to this tier, in USD. */
  saleValueUsd: number;
  /** Commission rate as a fraction (1% → 0.01). */
  rate: number;
}

/**
 * Compute a single-sale incentive in PKR: saleUSD × ratePct × fx.
 * `ratePct` is a PERCENT figure (1 = 1%), matching the sheet's `5000 × 1% × 275`.
 *   commissionFromSale(5000, 1)        → 13,750
 */
export function commissionFromSale(
  saleUSD: number,
  ratePct: number,
  fx: number = DEFAULT_FX_PKR_PER_USD,
): number {
  return num(saleUSD) * (num(ratePct) / 100) * num(fx);
}

/**
 * Compute a tiered incentive in PKR: Σ(saleValueUsd × rate) × fx.
 * Here `rate` is a FRACTION (0.01 = 1%), matching CommissionTier.
 *   commissionFromTiers([{5000,0.01},{11000,0.005}]) → 28,875
 */
export function commissionFromTiers(
  tiers: readonly CommissionTier[],
  fx: number = DEFAULT_FX_PKR_PER_USD,
): number {
  const usdCommission = sumBy(tiers, (t) => num(t.saleValueUsd) * num(t.rate));
  return usdCommission * num(fx);
}

/** Raw inputs for one rep's incentive row (cols C..F + policy flags). */
export interface IncentiveInput {
  /** Optional label for warnings / register output. */
  name?: string;
  /** Col C — prior-month incremental carried in (default 0). */
  prevIncremental?: number;
  /** Col D — prior-month incentive carried in (default 0). */
  prevIncentive?: number;
  /** Col E — incentive earned this month (FX-commission on sales). */
  incentive?: number;
  /** Col F — discretionary bonus earned this month. */
  bonus?: number;
  /** True when the rep met KPI (bonus is released). Defaults true. */
  kpiMet?: boolean;
  /** Already-settled in a prior run: excluded from this cash run, kept in accrual. */
  alreadyPaid?: boolean;
  /**
   * Manual override that pays the FULL accrued total despite a held note
   * (reproduces row 7). When set, payable = accrued and a warning is raised.
   */
  manualOverridePayFull?: boolean;
}

/** Fully-resolved incentive row (cols C..G + I, status, and accrual/cash split). */
export interface IncentiveRow {
  name: string;
  prevIncremental: number;
  prevIncentive: number;
  incentive: number;
  bonus: number;
  /** Col G — accrued total = sum(C..F). Feeds the P&L expense line. */
  accruedTotal: number;
  /** Col I — cash payable this run. */
  payable: number;
  /** accrued − payable (the bonus held back, or the full already-paid accrual). */
  withheld: number;
  status: IncentiveStatus;
  /** True when payable diverges from the policy default (a held row paid full). */
  overrideApplied: boolean;
  /** Human-readable warning when an override masks a held note, else null. */
  warning: string | null;
}

/**
 * Resolve one incentive row: accrue all four components, then apply the payout
 * policy to derive the cash payable, withheld amount, and status.
 *
 * payable =
 *   alreadyPaid                         → 0
 *   manualOverridePayFull               → accrued G            (+ warning if held)
 *   kpiMet                              → accrued G
 *   else (KPI not met, bonus held)      → incentive E only
 */
export function resolveIncentive(input: IncentiveInput): IncentiveRow {
  const name = input.name ?? "";
  const prevIncremental = num(input.prevIncremental);
  const prevIncentive = num(input.prevIncentive);
  const incentive = num(input.incentive);
  const bonus = num(input.bonus);
  const kpiMet = input.kpiMet ?? true;
  const alreadyPaid = input.alreadyPaid ?? false;
  const overridePayFull = input.manualOverridePayFull ?? false;

  const accruedTotal = prevIncremental + prevIncentive + incentive + bonus;

  let status: IncentiveStatus;
  let payable: number;
  let overrideApplied = false;
  let warning: string | null = null;

  if (alreadyPaid) {
    // Settled previously: kept in accrual, excluded from cash.
    status = "already_paid";
    payable = 0;
  } else if (overridePayFull) {
    // Manual override: full payout regardless of KPI/held state.
    payable = accruedTotal;
    if (!kpiMet) {
      // Held note present but paid in full — flag the inconsistency.
      status = "payable";
      overrideApplied = true;
      warning =
        `${name || "Row"}: bonus marked HELD (KPI not met) but a manual ` +
        `override paid the full accrued total (${accruedTotal}). Verify this ` +
        `is intentional and not a data-entry error.`;
    } else {
      status = "payable";
    }
  } else if (kpiMet) {
    // Normal: pay the full accrual.
    status = "payable";
    payable = accruedTotal;
  } else {
    // KPI not met, bonus held: pay incentive only, withhold the bonus.
    status = "held";
    payable = incentive;
  }

  return {
    name,
    prevIncremental,
    prevIncentive,
    incentive,
    bonus,
    accruedTotal,
    payable,
    withheld: accruedTotal - payable,
    status,
    overrideApplied,
    warning,
  };
}

/** Aggregate totals across an incentive register (the col-15 control row). */
export interface IncentiveTotals {
  /** E15 — Σ incentive. */
  incentive: number;
  /** F15 — Σ bonus. */
  bonus: number;
  /** G15 — Σ accrued total (the FULL P&L Sales-Commissions accrual). */
  accrued: number;
  /** I15 — Σ payable (the CASH disbursed this run). */
  payable: number;
  /** Σ withheld = accrued − payable (held bonus + already-paid accrual). */
  withheld: number;
  /** Σ withheld over HELD rows only (= the sheet's "37,163 withheld" note). */
  withheldOnHeld: number;
  /** Σ accrued over already-paid rows only (= the 30,958 already-paid). */
  alreadyPaidAccrued: number;
  /** Collected warnings from any override rows. */
  warnings: string[];
}

/**
 * Build the col-15 control totals over the SAME row set (accrual and payable
 * must be summed across identical rows so the gap reconciles).
 */
export function incentiveTotals(rows: readonly IncentiveRow[]): IncentiveTotals {
  return {
    incentive: sumBy(rows, (r) => r.incentive),
    bonus: sumBy(rows, (r) => r.bonus),
    accrued: sumBy(rows, (r) => r.accruedTotal),
    payable: sumBy(rows, (r) => r.payable),
    withheld: sumBy(rows, (r) => r.withheld),
    withheldOnHeld: sumBy(
      rows,
      (r) => (r.status === "held" ? r.withheld : 0),
    ),
    alreadyPaidAccrued: sumBy(
      rows,
      (r) => (r.status === "already_paid" ? r.accruedTotal : 0),
    ),
    warnings: rows.flatMap((r) => (r.warning ? [r.warning] : [])),
  };
}

/** Resolve a whole register in one pass: rows + their col-15 totals. */
export function buildIncentiveRegister(
  inputs: readonly IncentiveInput[],
): { rows: IncentiveRow[]; totals: IncentiveTotals } {
  const rows = inputs.map(resolveIncentive);
  return { rows, totals: incentiveTotals(rows) };
}
