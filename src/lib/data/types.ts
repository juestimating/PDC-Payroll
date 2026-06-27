// =============================================================================
// PDC Payroll — domain types.
// These mirror the intended Supabase tables so swapping mock -> live is a clean
// adapter change, not a rewrite. Headline figures (gross/taxable/wht/net) are
// always derived from components so a recomputation equals the stored total.
// =============================================================================

export type DepartmentKey = "sales" | "estimation" | "design" | "admin";
export type EmployeeStatus = "active" | "inactive";
export type PayrollStatus = "draft" | "processing" | "paid" | "closed";
export type Role = "admin" | "hr" | "dept_head" | "employee";
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

/** Why an employee left. Drives the final-settlement rules (e.g. notice shortfall). */
export type ExitReason = "resigned" | "terminated" | "contract_end" | "retired" | "other";

/** Whether the final dues have been paid out. */
export type SettlementStatus = "pending" | "cleared";

export const EXIT_REASON_LABEL: Record<ExitReason, string> = {
  resigned: "Resigned",
  terminated: "Terminated",
  contract_end: "End of contract",
  retired: "Retired",
  other: "Other",
};

export interface Department {
  id: string;
  key: DepartmentKey;
  name: string;
  /** Hex used for charts/tags. */
  color: string;
  /** Estimation + Design: track overtime & working days. */
  isTechnical: boolean;
  /** Sales & Marketing: track commission. */
  isSales: boolean;
}

export interface Team {
  id: string;
  name: string;
  departmentId: string;
}

export interface SalaryStructure {
  basic: number;
  medical: number;
  travel: number;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  departmentId: string;
  departmentKey: DepartmentKey;
  teamId: string;
  designation: string;
  status: EmployeeStatus;
  /** New hires still inside their probation window (status stays "active"). */
  onProbation?: boolean;
  joinedOn: string; // ISO date
  salary: SalaryStructure; // current (full-month) structure

  // --- payroll / disbursement details (real payroll grade) ---
  bank?: string; // disbursing bank
  account?: string; // account number / IBAN
  accountTitle?: string; // account holder name (may differ from employee)
  cnic?: string; // national ID (PII)
  city?: string;
  note?: string; // free-form payroll note (e.g. "8 days salary")

  // --- offboarding (present only once an employee has left) ---
  leftOn?: string; // ISO date — last working day
  exitReason?: ExitReason;
  exitNote?: string;
}

/** One line of a final settlement — an earning or a deduction. */
export interface SettlementLine {
  label: string;
  amount: number;
  note?: string;
}

/**
 * Full-and-final settlement ("dues") for a departed employee. Earnings minus
 * deductions give the net payable. Figures are derived from the salary
 * structure + tenure so a recomputation always reconciles.
 */
export interface FinalSettlement {
  employeeId: string;
  leftOn: string;
  exitReason: ExitReason;
  tenureMonths: number;
  completedYears: number;
  earnings: SettlementLine[];
  deductions: SettlementLine[];
  grossEarnings: number;
  totalDeductions: number;
  net: number;
  status: SettlementStatus;
}

/** Sales commission: one headline total composed of three tracked parts. */
export interface CommissionBreakdown {
  newSales: number;
  oldBonus: number;
  additionalBonus: number;
}

/** Technical teams: overtime feeds the salary sheet. */
export interface OvertimeDetail {
  hours: number;
  ratePerHour: number;
  workingDays: number;
  amount: number;
}

export interface DeductionItem {
  label: string;
  amount: number;
  kind: "loan" | "absence" | "advance" | "tax_adjustment" | "other";
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  month: string; // YYYY-MM
  status: PayrollStatus;

  // --- proration (real payroll: partial months are paid pro-rata) ---
  days: number; // days worked this month (out of 30)
  contractGross: number; // full-month salary; WHT is always computed on this

  // --- salary components (prorated by days; source of the headline gross) ---
  basic: number;
  medical: number;
  travel: number;
  deductions: DeductionItem[];

  // --- separate payouts: NOT part of gross/taxable/WHT (paid on top of salary) ---
  commission?: CommissionBreakdown; // sales only
  overtime?: OvertimeDetail; // technical (estimation) only

  // --- derived headline figures (salary only) ---
  gross: number; // = basic + medical + travel (prorated)
  taxable: number; // = gross - medical
  withholdingTax: number; // FBR slabs on full contract gross, prorated by days
  net: number; // = gross - withholdingTax - deductions
}

export interface IncrementEvent {
  id: string;
  employeeId: string;
  date: string; // ISO
  oldBasic: number;
  newBasic: number;
  reason: string;
  byUser: string;
}

export interface ExpenseItem {
  id: string;
  month: string; // YYYY-MM
  departmentId: string;
  category: string;
  label: string;
  amount: number;
  recurring: boolean;
  vendor?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  dueDate: string; // ISO
  month: string; // YYYY-MM
  kind: "payroll" | "general";
}

export interface AppUser {
  id: string;
  name: string;
  role: Role;
  departmentId?: string; // dept_head scope
  employeeId?: string; // employee self-service link
}
