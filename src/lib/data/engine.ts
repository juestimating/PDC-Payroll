// =============================================================================
// Payroll engine — REAL logic ported from the production PDC payroll.
//
// Tax: Pakistan FBR 2025-26 salaried withholding slabs. WHT is computed on the
// EARNED salary — any unpaid-leave / partial-day deduction is removed first
// (earned = contractGross × days/30), then the slabs are applied to that base.
// The medical allowance (earned ÷ 110 × 10) is tax-exempt. Full-month staff are
// unchanged; partial-month staff are taxed on what they actually earned.
//
// Data: the headline payroll for the live month is REAL seed data (see seed.ts),
// not generated. The generators here are only for opening a NEW month, which
// carries each employee's salary forward (commission/overtime entered fresh).
// =============================================================================
import { formatMonthKey } from "../format";
import { departmentById } from "./org";
import { APRIL_PAYROLL } from "./seed";
import type {
  CommissionBreakdown,
  Employee,
  ExitReason,
  FinalSettlement,
  IncrementEvent,
  PayrollRecord,
  PayrollStatus,
  SalaryStructure,
  SettlementLine,
  SettlementStatus,
} from "./types";

/** The one real, locked month in the dataset. Also the current/open month. */
export const CURRENT_MONTH = "2026-04";

/** Selectable months. Real data ships a single month; more arrive via rollover. */
export const MONTHS: string[] = [CURRENT_MONTH];

export function buildMonths(start: string, count: number): string[] {
  const [sy, sm] = start.split("-").map(Number);
  const out: string[] = [];
  let y = sy;
  let m = sm;
  for (let i = 0; i < count; i++) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export function monthIndex(month: string): number {
  return MONTHS.indexOf(month);
}

export function previousMonth(month: string): string | null {
  const i = monthIndex(month);
  return i > 0 ? MONTHS[i - 1] : null;
}

/** Compare two "YYYY-MM" keys: <0, 0, >0. Works for months outside the window. */
export function monthCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The month immediately after a "YYYY-MM" key, e.g. "2026-12" -> "2027-01". */
export function monthAfter(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m >= 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Whole months between two ISO dates (clamped at 0). */
export function monthsBetween(fromISO: string, toISO: string): number {
  const [ay, am] = fromISO.slice(0, 7).split("-").map(Number);
  const [by, bm] = toISO.slice(0, 7).split("-").map(Number);
  return Math.max(0, (by - ay) * 12 + (bm - am));
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

// =============================================================================
// FBR 2025-26 salaried withholding tax (the real engine).
// =============================================================================
/** Annual salaried income-tax slabs: [upperBound, baseTax, marginalRate]. */
const FBR_SLABS: ReadonlyArray<readonly [upper: number, base: number, rate: number]> = [
  [600000, 0, 0],
  [1200000, 0, 0.01],
  [2200000, 6000, 0.11],
  [3200000, 116000, 0.23],
  [4100000, 346000, 0.3],
  [Number.POSITIVE_INFINITY, 616000, 0.35],
];

export interface WhtBreakdown {
  medical: number; // tax-exempt allowance
  taxable: number; // contract gross - medical
  annualTax: number;
  wht: number; // monthly, prorated by days
}

/**
 * Monthly withholding tax, computed on the EARNED (post-leave) salary.
 *
 * If an employee took unpaid leave / worked a partial month, the unpaid-leave
 * deduction is removed FIRST — earned = contractGross × days/30 — and the FBR
 * slabs are then applied to that reduced base. Because the slabs are annualised
 * on the reduced salary, this can drop a partial-month employee into a lower
 * bracket (intended) rather than just scaling the full-month tax by days/30.
 * Medical allowance (earned ÷ 110 × 10) is exempt. Full-month staff (days = 30)
 * are unaffected: earned == contractGross, so the result is identical.
 */
export function calcWHT(contractGross: number, days = 30): WhtBreakdown {
  const cg = Number(contractGross) || 0;
  const d = Number(days) || 30;
  const earned = (cg * d) / 30; // salary after removing the unpaid-leave deduction
  const medical = (earned / 110) * 10;
  const taxable = earned - medical;
  const annual = taxable * 12;
  let lower = 0;
  let annualTax = 0;
  for (const [upper, base, rate] of FBR_SLABS) {
    if (annual <= lower) break;
    if (annual <= upper) {
      annualTax = base + (annual - lower) * rate;
      break;
    }
    lower = upper;
  }
  const wht = r2(annualTax / 12);
  return { medical, taxable, annualTax, wht };
}

/**
 * Decompose a full-month contract gross into stored salary components.
 * Medical = gross ÷ 110 × 10 (exact, tax-exempt); Travel = 10%; Basic = the
 * remainder (absorbs the 65% basic + 15% HRA of the source payslip). The three
 * always sum back to the contract gross.
 */
export function decomposeSalary(contractGross: number): SalaryStructure {
  const cg = Number(contractGross) || 0;
  const medical = r2((cg / 110) * 10);
  const travel = r2(cg * 0.1);
  const basic = r2(cg - medical - travel);
  return { basic, medical, travel };
}

export function commissionTotal(c: CommissionBreakdown): number {
  return c.newSales + c.oldBonus + c.additionalBonus;
}

// =============================================================================
// Real payroll seed (April 2026). No synthetic generation.
// =============================================================================
export const PAYROLL: PayrollRecord[] = APRIL_PAYROLL;

/** No real increment history in the imported dataset. */
export const INCREMENTS: IncrementEvent[] = [];

// ---- indexes -----------------------------------------------------------------
export const payrollByMonth = new Map<string, PayrollRecord[]>();
for (const r of PAYROLL) {
  const list = payrollByMonth.get(r.month) ?? [];
  list.push(r);
  payrollByMonth.set(r.month, list);
}

export const payrollByEmployee = new Map<string, PayrollRecord[]>();
for (const r of PAYROLL) {
  const list = payrollByEmployee.get(r.employeeId) ?? [];
  list.push(r);
  payrollByEmployee.set(r.employeeId, list);
}

// =============================================================================
// New-month generation. Opening a month carries each employee's salary
// structure forward (full days), with variable components (commission /
// overtime / deductions) reset — they are entered during the month.
// =============================================================================
export function generateMonthForRoster(month: string, roster: Employee[]): PayrollRecord[] {
  return roster.map((emp) => {
    const { basic, medical, travel } = emp.salary;
    const contractGross = basic + medical + travel;
    const gross = contractGross; // full days
    const taxable = gross - medical;
    const { wht } = calcWHT(contractGross, 30);
    return {
      id: `pay-${emp.id}-${month}`,
      employeeId: emp.id,
      month,
      status: "processing" as PayrollStatus,
      days: 30,
      contractGross,
      basic,
      medical,
      travel,
      deductions: [],
      commission: undefined,
      overtime: undefined,
      gross,
      taxable,
      withholdingTax: wht,
      net: r2(gross - wht),
    };
  });
}

// =============================================================================
// Final settlement ("dues") for departed employees. No departures exist in the
// April dataset, so this is dormant; it stays available for offboarding and
// uses the same FBR-aware salary structure. Amounts that depend on company
// policy (leave encashment, gratuity) are derived from tenure + structure.
// =============================================================================
const sumLines = (lines: SettlementLine[]): number => lines.reduce((s, l) => s + l.amount, 0);

export function computeSettlement(emp: Employee): FinalSettlement {
  const leftOn = emp.leftOn ?? `${CURRENT_MONTH}-28`;
  const exitReason: ExitReason = emp.exitReason ?? "other";
  const { basic, medical, travel } = emp.salary;
  const baseGross = basic + medical + travel;
  const dailyBasic = basic / 30;

  const tenureMonths = monthsBetween(emp.joinedOn, leftOn);
  const completedYears = Math.floor(tenureMonths / 12);

  // ---- earnings ----
  const earnings: SettlementLine[] = [
    {
      label: "Salary payable (final month)",
      amount: Math.round(baseGross),
      note: formatMonthKey(leftOn.slice(0, 7)),
    },
  ];
  if (completedYears >= 1) {
    earnings.push({
      label: "Gratuity / severance",
      amount: completedYears * basic,
      note: `${completedYears} yr${completedYears > 1 ? "s" : ""} of service`,
    });
  }
  // Leave encashment placeholder line (0 days until real leave balances exist).
  earnings.push({ label: "Leave encashment", amount: 0, note: "0 days unused", });

  // ---- deductions ----
  const deductions: SettlementLine[] = [];
  if (exitReason === "resigned") {
    // Short-notice adjustment applies only when notice is not served; default 0.
    deductions.push({ label: "Short-notice adjustment", amount: 0, note: "Notice period served" });
  }

  const grossEarnings = sumLines(earnings);
  const totalDeductions = sumLines(deductions);
  const status: SettlementStatus =
    monthsBetween(leftOn, `${CURRENT_MONTH}-28`) <= 1 ? "pending" : "cleared";

  // Reference: daily basic available for future leave-encashment policy.
  void dailyBasic;
  void departmentById;

  return {
    employeeId: emp.id,
    leftOn,
    exitReason,
    tenureMonths,
    completedYears,
    earnings,
    deductions,
    grossEarnings,
    totalDeductions,
    net: grossEarnings - totalDeductions,
    status,
  };
}
