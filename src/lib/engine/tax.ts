// =============================================================================
// FBR withholding tax + filing-register math.
//
// WHT is ALWAYS computed on the FULL-MONTH taxable base, annualised, slabbed,
// de-annualised, then prorated by days/30. Medical allowance is tax-exempt.
// Reproduces every stored WHT figure: Aadil 204.545 @15d, Awais 9900 @22d,
// Yahya 2500 @30d, and the May filing total G34 = 26,972.506061.
// =============================================================================
import { DAYS_IN_PAYROLL_MONTH, FBR_SLABS } from "./constants";
import { medicalOf } from "./base";
import { num } from "./money";

/** Annual salaried income tax for an annual taxable income (full precision). */
export function fbrAnnualTax(annualTaxable: number): number {
  const a = num(annualTaxable);
  let lower = 0;
  for (const [upper, base, rate] of FBR_SLABS) {
    if (a <= lower) return 0;
    if (a <= upper) return base + (a - lower) * rate;
    lower = upper;
  }
  return 0;
}

export interface WhtInput {
  /** Monthly contract salary (col D). */
  salary: number;
  /** Days worked out of 30. */
  days?: number;
  /** Earnings that join the taxable base (cols G/H/I). Default 0. */
  overtime?: number;
  incentive?: number;
  bonus?: number;
}

export interface WhtBreakdown {
  medical: number;
  /** Full-month taxable base (col K). */
  taxable: number;
  annualTax: number;
  /** Monthly WHT after proration (col L). */
  wht: number;
}

/**
 * Monthly withholding tax. The taxable base is full-month (NOT prorated); only
 * the final WHT amount is prorated by days/30.
 */
export function calcWHT(input: WhtInput): WhtBreakdown {
  const salary = num(input.salary);
  const days = input.days ?? DAYS_IN_PAYROLL_MONTH;
  const extras = num(input.overtime) + num(input.incentive) + num(input.bonus);
  const medical = medicalOf(salary);
  const taxable = salary - medical + extras;
  const annualTax = fbrAnnualTax(taxable * 12);
  const wht = (annualTax / 12) * (days / DAYS_IN_PAYROLL_MONTH);
  return { medical, taxable, annualTax, wht };
}

// =============================================================================
// FBR filing register (the `May Tax` / `March Tax 2026` sheets).
//
// Per employee per month: gross (days-prorated), taxable (off the FULL contract,
// so for partial months taxable can EXCEED gross), WHT, and a refundable-tax
// carry-forward from the prior month. net_payable = WHT − refundable_adjustment.
// =============================================================================
export interface TaxRegisterInput {
  salary: number;
  days?: number;
  /** Days-prorated paid gross (col J / register col E). */
  gross: number;
  /** Refundable tax carried from the prior month (register col K). */
  refundableAdjustment?: number;
}

export interface TaxRegisterEntry {
  /** Register col E — days-prorated gross. */
  gross: number;
  /** Register col F — taxable off full contract salary (salary − medical). */
  taxable: number;
  /** Register col G — withholding tax. */
  wht: number;
  refundableAdjustment: number;
  /** Amount actually deposited to FBR = WHT − refundable carry-forward. */
  netPayable: number;
}

/** Build one filing-register row. Taxable is the full-contract base (not prorated). */
export function taxRegisterEntry(input: TaxRegisterInput): TaxRegisterEntry {
  const salary = num(input.salary);
  const days = input.days ?? DAYS_IN_PAYROLL_MONTH;
  const refundableAdjustment = num(input.refundableAdjustment);
  const medical = medicalOf(salary);
  const taxable = salary - medical; // full contract, register basis
  const { wht } = calcWHT({ salary, days });
  return {
    gross: num(input.gross),
    taxable,
    wht,
    refundableAdjustment,
    netPayable: wht - refundableAdjustment,
  };
}
