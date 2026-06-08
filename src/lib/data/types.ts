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
  joinedOn: string; // ISO date
  salary: SalaryStructure; // current structure
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

  // --- components (the source of truth) ---
  basic: number;
  medical: number;
  travel: number;
  commission?: CommissionBreakdown; // sales only
  overtime?: OvertimeDetail; // technical only
  deductions: DeductionItem[];

  // --- derived headline figures (reconcile from the components above) ---
  gross: number;
  taxable: number;
  withholdingTax: number;
  net: number;
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
