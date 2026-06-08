// =============================================================================
// Deterministic payroll generator. Seeded PRNG => server and client produce
// identical data (no React hydration mismatch). All figures derive from
// components so any recomputation equals the stored headline total.
//
// The tax function here is a clearly-labelled PLACEHOLDER. Replace with real
// FBR withholding slabs in the logic phase.
// =============================================================================
import { EMPLOYEES, departmentById } from "./org";
import type {
  CommissionBreakdown,
  DeductionItem,
  Employee,
  IncrementEvent,
  OvertimeDetail,
  PayrollRecord,
  PayrollStatus,
} from "./types";

/** Latest (open) month. Everything before it is a closed, immutable month. */
export const CURRENT_MONTH = "2026-06";

/** 12 months ending at CURRENT_MONTH: 2025-07 .. 2026-06. */
export const MONTHS: string[] = buildMonths("2025-07", 12);

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

// ---- deterministic randomness ------------------------------------------------
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFor(...parts: string[]): () => number {
  return mulberry32(hashStr(parts.join("|")));
}

function between(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

// ---- placeholder tax (REPLACE with real FBR slabs) ---------------------------
const TAX_BANDS: ReadonlyArray<readonly [upper: number, rate: number]> = [
  [600000, 0],
  [1200000, 0.05],
  [2200000, 0.125],
  [3200000, 0.2],
  [4100000, 0.25],
  [Number.POSITIVE_INFINITY, 0.325],
];

/** MOCK monthly withholding tax from monthly taxable income. Illustrative only. */
export function mockWithholdingTax(monthlyTaxable: number): number {
  const annual = monthlyTaxable * 12;
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of TAX_BANDS) {
    if (annual <= lower) break;
    const slice = Math.min(annual, upper) - lower;
    tax += slice * rate;
    lower = upper;
  }
  return Math.round(tax / 12);
}

// ---- increments --------------------------------------------------------------
const INCREMENT_REASONS = [
  "Annual review increment",
  "Promotion adjustment",
  "Performance reward",
  "Market correction",
  "Role expansion",
];

function buildIncrements(): IncrementEvent[] {
  const events: IncrementEvent[] = [];
  for (const emp of EMPLOYEES) {
    if (emp.status !== "active") continue;
    const rng = rngFor("inc", emp.id);
    // ~45% of employees got one increment within the window.
    if (rng() > 0.45) continue;
    const idx = Math.floor(between(rng, 2, 9)); // not the very edges
    const month = MONTHS[idx];
    const pct = [0.08, 0.1, 0.12, 0.15][Math.floor(rng() * 4)];
    const newBasic = emp.salary.basic; // current = post-increment
    const oldBasic = roundTo(newBasic / (1 + pct), 1000);
    events.push({
      id: `inc-${emp.id}-${month}`,
      employeeId: emp.id,
      date: `${month}-05`,
      oldBasic,
      newBasic,
      reason: INCREMENT_REASONS[Math.floor(rng() * INCREMENT_REASONS.length)],
      byUser: rng() > 0.5 ? "Sadia Rauf (HR)" : "Imran Baig (Finance)",
    });
  }
  return events;
}

export const INCREMENTS: IncrementEvent[] = buildIncrements();

const incrementByEmployee = new Map<string, IncrementEvent>();
for (const inc of INCREMENTS) incrementByEmployee.set(inc.employeeId, inc);

/** Basic salary for an employee in a given month (respects mid-window increments). */
function basicForMonth(emp: Employee, month: string): number {
  const inc = incrementByEmployee.get(emp.id);
  if (!inc) return emp.salary.basic;
  return monthIndex(month) < monthIndex(inc.date.slice(0, 7)) ? inc.oldBasic : inc.newBasic;
}

// ---- per-month component builders -------------------------------------------
function buildCommission(emp: Employee, month: string): CommissionBreakdown {
  const rng = rngFor("comm", emp.id, month);
  const tier = emp.salary.basic > 150000 ? 1.6 : 1;
  const newSales = roundTo(between(rng, 20000, 260000) * tier, 1000);
  const oldBonus = roundTo(between(rng, 0, 60000), 1000);
  const additionalBonus = rng() > 0.6 ? roundTo(between(rng, 10000, 45000), 1000) : 0;
  return { newSales, oldBonus, additionalBonus };
}

function commissionTotal(c: CommissionBreakdown): number {
  return c.newSales + c.oldBonus + c.additionalBonus;
}

function buildOvertime(emp: Employee, month: string): OvertimeDetail {
  const rng = rngFor("ot", emp.id, month);
  const hours = rng() > 0.25 ? Math.round(between(rng, 4, 38)) : 0;
  const ratePerHour = roundTo((emp.salary.basic / 176) * 1.5, 50); // 1.5x hourly
  const workingDays = Math.round(between(rng, 22, 26));
  return { hours, ratePerHour, workingDays, amount: hours * ratePerHour };
}

function buildDeductions(emp: Employee, month: string): DeductionItem[] {
  const rng = rngFor("ded", emp.id, month);
  const items: DeductionItem[] = [];
  if (rng() > 0.78) {
    items.push({ label: "Salary advance recovery", amount: roundTo(between(rng, 10000, 40000), 1000), kind: "advance" });
  }
  if (rng() > 0.9) {
    items.push({ label: "Unpaid leave", amount: roundTo(between(rng, 5000, 25000), 1000), kind: "absence" });
  }
  return items;
}

// ---- assemble payroll --------------------------------------------------------
function statusFor(month: string): PayrollStatus {
  return month === CURRENT_MONTH ? "processing" : "closed";
}

function buildPayroll(): PayrollRecord[] {
  const records: PayrollRecord[] = [];
  for (const emp of EMPLOYEES) {
    if (emp.status !== "active") continue;
    const dept = departmentById.get(emp.departmentId);
    for (const month of MONTHS) {
      const basic = basicForMonth(emp, month);
      const medical = emp.salary.medical;
      const travel = emp.salary.travel;

      const commission = dept?.isSales ? buildCommission(emp, month) : undefined;
      const overtime = dept?.isTechnical ? buildOvertime(emp, month) : undefined;
      const deductions = buildDeductions(emp, month);

      const extra = commission ? commissionTotal(commission) : overtime ? overtime.amount : 0;
      const gross = basic + medical + travel + extra;
      const taxable = gross - medical; // mock: medical treated as exempt
      const withholdingTax = mockWithholdingTax(taxable);
      const deductionTotal = deductions.reduce((s, d) => s + d.amount, 0);
      const net = gross - withholdingTax - deductionTotal;

      records.push({
        id: `pay-${emp.id}-${month}`,
        employeeId: emp.id,
        month,
        status: statusFor(month),
        basic,
        medical,
        travel,
        commission,
        overtime,
        deductions,
        gross,
        taxable,
        withholdingTax,
        net,
      });
    }
  }
  return records;
}

export const PAYROLL: PayrollRecord[] = buildPayroll();

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

export { commissionTotal };
