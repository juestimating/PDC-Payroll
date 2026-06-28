// =============================================================================
// Core salary engine — the verified-exact reproduction of the workbook's
// per-employee row (cols D..O on every department sheet).
//
// Anchored on ONE input: the monthly contract Salary (col D). Everything else
// is derived. Reproduces every stored medical/basic/gross/taxable/net figure.
//
// Decisions baked in (owner-confirmed):
//  - "travel" is KEPT as an optional allowance line, but it is carved OUT of the
//    contract salary (basic = salary − medical − travel), so the headline gross
//    still equals the salary exactly. It defaults to 0 → basic = salary − medical,
//    which reproduces the sheet. Set a non-zero travel only for staff who really
//    draw one; it reclassifies basic→travel without changing gross/tax/net.
//  - Net = gross − WHT − otherDeductions − advance (the sheet's O = J−L−M−N).
//    The previous app dropped deductions/advance entirely — that bug is fixed.
//  - Arrears (col P) are tracked separately and are NOT inside net.
// =============================================================================
import { DAYS_IN_PAYROLL_MONTH } from "./constants";
import { medicalOf } from "./base";
import { calcWHT } from "./tax";
import { num } from "./money";

export { medicalOf };

export interface SalaryComponents {
  /** The full monthly contract salary (col D) — the canonical input. */
  salary: number;
  basic: number;
  medical: number;
  travel: number;
}

/** Inputs that vary per month for one employee. */
export interface PayrollInputs {
  /** Monthly contract salary (col D). */
  salary: number;
  /** Days worked out of 30 (col Q). */
  days?: number;
  /** Optional carved-out travel allowance (default 0). */
  travel?: number;
  /** Extra earnings folded into gross & taxable (cols G/H/I). Usually 0 here —
   *  overtime and incentives are normally paid via their own sheets. */
  overtime?: number;
  incentive?: number;
  bonus?: number;
  /** Other deductions (col M) and salary advance recovered (col N). */
  otherDeductions?: number;
  advance?: number;
  /** Arrears (col P) — informational, not part of net. */
  arrears?: number;
}

export interface PayrollComputation extends SalaryComponents {
  days: number;
  overtime: number;
  incentive: number;
  bonus: number;
  otherDeductions: number;
  advance: number;
  arrears: number;
  /** Prorated headline gross (col J). */
  gross: number;
  /** Full-month taxable base (col K) — NOT prorated. */
  taxable: number;
  /** Withholding tax (col L). */
  withholdingTax: number;
  /** Net payable (col O). */
  net: number;
}

/**
 * Decompose the contract salary into basic + medical + travel.
 * travel is carved out of salary; basic absorbs the remainder.
 */
export function decomposeSalary(salary: number, travel = 0): SalaryComponents {
  const s = num(salary);
  const medical = medicalOf(s);
  const t = num(travel);
  return { salary: s, medical, travel: t, basic: s - medical - t };
}

/**
 * The full per-employee monthly computation. Reproduces the sheet's row exactly:
 *   J (gross)   = (basic + medical + travel + OT + incentive + bonus) × days/30
 *               = (salary + OT + incentive + bonus) × days/30
 *   K (taxable) = salary − medical + OT + incentive + bonus     (full month)
 *   L (WHT)     = FBR_annual(taxable × 12) / 12 × days/30
 *   O (net)     = gross − WHT − otherDeductions − advance
 */
export function computePayroll(input: PayrollInputs): PayrollComputation {
  const salary = num(input.salary);
  const days = input.days ?? DAYS_IN_PAYROLL_MONTH;
  const travel = num(input.travel);
  const overtime = num(input.overtime);
  const incentive = num(input.incentive);
  const bonus = num(input.bonus);
  const otherDeductions = num(input.otherDeductions);
  const advance = num(input.advance);
  const arrears = num(input.arrears);

  const { basic, medical } = decomposeSalary(salary, travel);
  const extras = overtime + incentive + bonus;

  const proration = days / DAYS_IN_PAYROLL_MONTH;
  const gross = (salary + extras) * proration;
  const taxable = salary - medical + extras;
  const { wht } = calcWHT({ salary, days, overtime, incentive, bonus });
  const net = gross - wht - otherDeductions - advance;

  return {
    salary,
    basic,
    medical,
    travel,
    days,
    overtime,
    incentive,
    bonus,
    otherDeductions,
    advance,
    arrears,
    gross,
    taxable,
    withholdingTax: wht,
    net,
  };
}
