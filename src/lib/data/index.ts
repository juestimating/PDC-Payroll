// =============================================================================
// Data access layer (selectors + aggregations).
// The UI imports ONLY from here, never from raw arrays. These signatures are
// the contract the Supabase backend will fulfil in the logic phase.
// =============================================================================
import {
  DEPARTMENTS,
  DEPARTMENT_HEADS,
  EMPLOYEES,
  TEAMS,
  departmentById,
  employeeById,
  teamById,
} from "./org";
import {
  CURRENT_MONTH,
  INCREMENTS,
  MONTHS,
  commissionTotal,
  computeSettlement,
  payrollByEmployee,
} from "./engine";
import {
  allMonthKeys,
  createdRecordsForEmployee,
  effectiveEmployee,
  effectiveOpenMonth,
  isMonthCreated,
  orderIndex,
  recordsForMonth,
} from "./overlay";
import { EXPENSES, expensesByMonth } from "./expenses";
import { TASKS } from "./tasks";
import { DEMO_USERS, DEMO_USER_BY_ROLE } from "./users";
import { ROLE_NAV, ROLE_ORDER, ROLES } from "./roles";
import type {
  DepartmentKey,
  Employee,
  ExitReason,
  FinalSettlement,
  ExpenseItem,
  IncrementEvent,
  PayrollRecord,
  PayrollStatus,
  TaskItem,
} from "./types";

/** Overlay-aware previous month (spans created months too). */
function prevMonth(month: string): string | null {
  const i = orderIndex(month);
  return i > 0 ? allMonthKeys()[i - 1] : null;
}

// ---- re-exports --------------------------------------------------------------
export * from "./types";
export {
  DEPARTMENTS,
  TEAMS,
  EMPLOYEES,
  DEPARTMENT_HEADS,
  departmentById,
  employeeById,
  teamById,
} from "./org";
export { MONTHS, CURRENT_MONTH, INCREMENTS, computeSettlement, monthAfter } from "./engine";

// ---- months / open period (overlay-aware) -----------------------------------
/** All selectable months, including any opened via "Start new month". */
export function getMonths(): string[] {
  return allMonthKeys();
}
/** The current open / processing month. */
export function getOpenMonth(): string {
  return effectiveOpenMonth();
}
/** Whether a month was opened on top of the seed window. */
export { isMonthCreated };
export { ROLES, ROLE_NAV, ROLE_ORDER } from "./roles";
export { DEMO_USERS, DEMO_USER_BY_ROLE } from "./users";

const sum = <T>(items: T[], pick: (t: T) => number): number =>
  items.reduce((acc, t) => acc + pick(t), 0);

// =============================================================================
// Payroll
// =============================================================================
export type PayrollRow = PayrollRecord & { employee: Employee };

export interface PayrollQuery {
  departmentId?: string;
  teamId?: string;
  status?: PayrollStatus;
  search?: string;
}

function enrich(r: PayrollRecord): PayrollRow {
  return { ...r, employee: employeeById.get(r.employeeId)! };
}

export function getPayroll(month: string, q: PayrollQuery = {}): PayrollRow[] {
  let rows = recordsForMonth(month).map(enrich);
  if (q.departmentId) rows = rows.filter((r) => r.employee.departmentId === q.departmentId);
  if (q.teamId) rows = rows.filter((r) => r.employee.teamId === q.teamId);
  if (q.status) rows = rows.filter((r) => r.status === q.status);
  if (q.search) {
    const s = q.search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.employee.name.toLowerCase().includes(s) ||
        r.employee.designation.toLowerCase().includes(s),
    );
  }
  return rows.sort((a, b) => b.gross - a.gross);
}

export function getEmployeePayroll(employeeId: string): PayrollRecord[] {
  const open = effectiveOpenMonth();
  const base = (payrollByEmployee.get(employeeId) ?? []).map((r) =>
    r.month === open || r.status === "closed" ? r : { ...r, status: "closed" as PayrollStatus },
  );
  return [...base, ...createdRecordsForEmployee(employeeId)].sort(
    (a, b) => orderIndex(a.month) - orderIndex(b.month),
  );
}

export function getPayrollRecord(employeeId: string, month: string): PayrollRecord | undefined {
  const created = createdRecordsForEmployee(employeeId).find((r) => r.month === month);
  if (created) return created;
  const base = (payrollByEmployee.get(employeeId) ?? []).find((r) => r.month === month);
  if (!base) return undefined;
  return base.month === effectiveOpenMonth() ? base : { ...base, status: "closed" as PayrollStatus };
}

export { commissionTotal };

// =============================================================================
// Org + department totals
// =============================================================================
export interface OrgTotals {
  month: string;
  headcount: number;
  basic: number;
  medical: number;
  travel: number;
  commission: number;
  overtime: number;
  gross: number;
  taxable: number;
  tax: number;
  deductions: number;
  net: number;
  expenses: number;
  payrollCost: number; // = gross + commission + overtime
  totalCost: number; // = payrollCost + expenses
}

export function orgTotals(month: string): OrgTotals {
  const rows = recordsForMonth(month);
  const expenses = sum(expensesByMonth.get(month) ?? [], (e) => e.amount);
  // gross is salary only; commission and overtime are separate payouts, so the
  // true payroll cost is salary + commission + overtime.
  const gross = sum(rows, (r) => r.gross);
  const commission = sum(rows, (r) => (r.commission ? commissionTotal(r.commission) : 0));
  const overtime = sum(rows, (r) => r.overtime?.amount ?? 0);
  const payrollCost = gross + commission + overtime;
  return {
    month,
    headcount: rows.length,
    basic: sum(rows, (r) => r.basic),
    medical: sum(rows, (r) => r.medical),
    travel: sum(rows, (r) => r.travel),
    commission,
    overtime,
    gross,
    taxable: sum(rows, (r) => r.taxable),
    tax: sum(rows, (r) => r.withholdingTax),
    deductions: sum(rows, (r) => r.deductions.reduce((s, d) => s + d.amount, 0)),
    net: sum(rows, (r) => r.net),
    expenses,
    payrollCost,
    totalCost: payrollCost + expenses,
  };
}

export interface DeptTotals {
  departmentId: string;
  key: DepartmentKey;
  name: string;
  color: string;
  headcount: number;
  gross: number;
  tax: number;
  net: number;
  commission: number;
  overtime: number;
  expenses: number;
  payrollCost: number;
  totalCost: number;
}

export function departmentTotals(month: string): DeptTotals[] {
  const rows = recordsForMonth(month);
  const exp = expensesByMonth.get(month) ?? [];
  return DEPARTMENTS.map((d) => {
    const dr = rows.filter((r) => employeeById.get(r.employeeId)?.departmentId === d.id);
    const de = exp.filter((e) => e.departmentId === d.id);
    const gross = sum(dr, (r) => r.gross);
    const expenses = sum(de, (e) => e.amount);
    const commission = sum(dr, (r) => (r.commission ? commissionTotal(r.commission) : 0));
    const overtime = sum(dr, (r) => r.overtime?.amount ?? 0);
    const payrollCost = gross + commission + overtime;
    return {
      departmentId: d.id,
      key: d.key,
      name: d.name,
      color: d.color,
      headcount: dr.length,
      gross,
      tax: sum(dr, (r) => r.withholdingTax),
      net: sum(dr, (r) => r.net),
      commission,
      overtime,
      expenses,
      payrollCost,
      totalCost: payrollCost + expenses,
    };
  });
}

// =============================================================================
// Trends + KPIs
// =============================================================================
export interface TrendPoint {
  month: string;
  gross: number;
  net: number;
  tax: number;
  expenses: number;
  headcount: number;
  payrollCost: number;
  totalCost: number;
}

export function monthlyTrend(): TrendPoint[] {
  return allMonthKeys().map((m) => {
    const t = orgTotals(m);
    return {
      month: m,
      gross: t.gross,
      net: t.net,
      tax: t.tax,
      expenses: t.expenses,
      headcount: t.headcount,
      payrollCost: t.payrollCost,
      totalCost: t.totalCost,
    };
  });
}

export interface Kpi {
  value: number;
  previous: number | null;
  deltaPct: number | null;
}

function kpi(value: number, previous: number | null): Kpi {
  const deltaPct =
    previous == null || previous === 0 ? null : ((value - previous) / previous) * 100;
  return { value, previous, deltaPct };
}

export interface DashboardKpis {
  payrollCost: Kpi;
  headcount: Kpi;
  tax: Kpi;
  expenses: Kpi;
  net: Kpi;
  totalCost: Kpi;
}

export function dashboardKpis(month: string): DashboardKpis {
  const cur = orgTotals(month);
  const prevKey = prevMonth(month);
  const prev = prevKey ? orgTotals(prevKey) : null;
  return {
    payrollCost: kpi(cur.payrollCost, prev?.payrollCost ?? null),
    headcount: kpi(cur.headcount, prev?.headcount ?? null),
    tax: kpi(cur.tax, prev?.tax ?? null),
    expenses: kpi(cur.expenses, prev?.expenses ?? null),
    net: kpi(cur.net, prev?.net ?? null),
    totalCost: kpi(cur.totalCost, prev?.totalCost ?? null),
  };
}

// =============================================================================
// Tax
// =============================================================================
export interface TaxRow {
  employee: Employee;
  gross: number;
  taxable: number;
  tax: number;
  withoutTax: number; // take-home after tax
  effectiveRate: number; // tax / gross
}

export function taxRows(month: string, q: PayrollQuery = {}): TaxRow[] {
  return getPayroll(month, q).map((r) => ({
    employee: r.employee,
    gross: r.gross,
    taxable: r.taxable,
    tax: r.withholdingTax,
    withoutTax: r.gross - r.withholdingTax,
    effectiveRate: r.gross ? (r.withholdingTax / r.gross) * 100 : 0,
  }));
}

export interface TaxTotals {
  gross: number;
  taxable: number;
  tax: number;
  withoutTax: number;
  effectiveRate: number;
  byDepartment: { departmentId: string; name: string; color: string; gross: number; tax: number }[];
}

export function taxTotals(month: string): TaxTotals {
  const dts = departmentTotals(month);
  const gross = sum(dts, (d) => d.gross);
  const tax = sum(dts, (d) => d.tax);
  const taxable = sum(recordsForMonth(month), (r) => r.taxable);
  return {
    gross,
    taxable,
    tax,
    withoutTax: gross - tax,
    effectiveRate: gross ? (tax / gross) * 100 : 0,
    byDepartment: dts.map((d) => ({
      departmentId: d.departmentId,
      name: d.name,
      color: d.color,
      gross: d.gross,
      tax: d.tax,
    })),
  };
}

// =============================================================================
// Expenses
// =============================================================================
export function getExpenses(
  month: string,
  q: { departmentId?: string; category?: string } = {},
): ExpenseItem[] {
  let items = [...(expensesByMonth.get(month) ?? [])];
  if (q.departmentId) items = items.filter((e) => e.departmentId === q.departmentId);
  if (q.category) items = items.filter((e) => e.category === q.category);
  return items.sort((a, b) => b.amount - a.amount);
}

export interface ExpenseTotals {
  total: number;
  recurring: number;
  variable: number;
  byDepartment: { departmentId: string; name: string; color: string; total: number }[];
  byCategory: { category: string; total: number }[];
}

export function expenseTotals(month: string): ExpenseTotals {
  const items = expensesByMonth.get(month) ?? [];
  const byDept = DEPARTMENTS.map((d) => ({
    departmentId: d.id,
    name: d.name,
    color: d.color,
    total: sum(items.filter((e) => e.departmentId === d.id), (e) => e.amount),
  }));
  const catMap = new Map<string, number>();
  for (const e of items) catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amount);
  return {
    total: sum(items, (e) => e.amount),
    recurring: sum(items.filter((e) => e.recurring), (e) => e.amount),
    variable: sum(items.filter((e) => !e.recurring), (e) => e.amount),
    byDepartment: byDept.sort((a, b) => b.total - a.total),
    byCategory: [...catMap.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total),
  };
}

export function expenseTrend(): { month: string; total: number }[] {
  return allMonthKeys().map((m) => ({
    month: m,
    total: sum(expensesByMonth.get(m) ?? [], (e) => e.amount),
  }));
}

// =============================================================================
// Employees
// =============================================================================
export interface EmployeeQuery {
  departmentId?: string;
  teamId?: string;
  status?: Employee["status"];
  search?: string;
}

export function getEmployees(q: EmployeeQuery = {}): Employee[] {
  let list = EMPLOYEES.map(effectiveEmployee);
  if (q.departmentId) list = list.filter((e) => e.departmentId === q.departmentId);
  if (q.teamId) list = list.filter((e) => e.teamId === q.teamId);
  if (q.status) list = list.filter((e) => e.status === q.status);
  if (q.search) {
    const s = q.search.toLowerCase();
    list = list.filter(
      (e) => e.name.toLowerCase().includes(s) || e.designation.toLowerCase().includes(s),
    );
  }
  return list;
}

export function getEmployee(id: string): Employee | undefined {
  const e = employeeById.get(id);
  return e ? effectiveEmployee(e) : undefined;
}

export function teamsForDepartment(departmentId: string) {
  return TEAMS.filter((t) => t.departmentId === departmentId);
}

// =============================================================================
// Increments + deductions
// =============================================================================
export function getIncrements(q: { employeeId?: string } = {}): (IncrementEvent & {
  employee: Employee;
})[] {
  let list = [...INCREMENTS];
  if (q.employeeId) list = list.filter((i) => i.employeeId === q.employeeId);
  return list
    .map((i) => ({ ...i, employee: employeeById.get(i.employeeId)! }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export interface DeductionRow {
  employee: Employee;
  month: string;
  items: PayrollRecord["deductions"];
  total: number;
}

export function getDeductions(month: string, q: PayrollQuery = {}): DeductionRow[] {
  return getPayroll(month, q)
    .filter((r) => r.deductions.length > 0)
    .map((r) => ({
      employee: r.employee,
      month: r.month,
      items: r.deductions,
      total: r.deductions.reduce((s, d) => s + d.amount, 0),
    }));
}

// =============================================================================
// Overtime
// =============================================================================
export interface OvertimeRow {
  employee: Employee;
  month: string;
  hours: number;
  ratePerHour: number;
  workingDays: number;
  amount: number;
}

export function getOvertime(month: string, q: PayrollQuery = {}): OvertimeRow[] {
  return getPayroll(month, q)
    .filter((r) => r.overtime && r.overtime.hours > 0)
    .map((r) => ({
      employee: r.employee,
      month: r.month,
      hours: r.overtime!.hours,
      ratePerHour: r.overtime!.ratePerHour,
      workingDays: r.overtime!.workingDays,
      amount: r.overtime!.amount,
    }))
    .sort((a, b) => b.amount - a.amount);
}

// =============================================================================
// Commissions (sales teams) — the sales counterpart to overtime.
// One row per sales rep, decomposed into the tracked parts: new-sales
// commission, old bonus (carry-over deals), and any additional bonus.
// =============================================================================
export interface CommissionRow {
  employee: Employee;
  month: string;
  newSales: number;
  oldBonus: number;
  additionalBonus: number;
  total: number;
}

export function getCommissions(month: string, q: PayrollQuery = {}): CommissionRow[] {
  return getPayroll(month, q)
    .filter((r) => r.commission && commissionTotal(r.commission) > 0)
    .map((r) => ({
      employee: r.employee,
      month: r.month,
      newSales: r.commission!.newSales,
      oldBonus: r.commission!.oldBonus,
      additionalBonus: r.commission!.additionalBonus,
      total: commissionTotal(r.commission!),
    }))
    .sort((a, b) => b.total - a.total);
}

export interface CommissionTotals {
  total: number;
  newSales: number;
  oldBonus: number;
  additionalBonus: number;
  reps: number;
}

export function commissionTotals(month: string, q: PayrollQuery = {}): CommissionTotals {
  const rows = getCommissions(month, q);
  return {
    total: sum(rows, (r) => r.total),
    newSales: sum(rows, (r) => r.newSales),
    oldBonus: sum(rows, (r) => r.oldBonus),
    additionalBonus: sum(rows, (r) => r.additionalBonus),
    reps: rows.length,
  };
}

// =============================================================================
// Tasks
// =============================================================================
export function getTasks(
  q: { month?: string; status?: TaskItem["status"]; assigneeId?: string; kind?: TaskItem["kind"] } = {},
): (TaskItem & { assignee?: Employee })[] {
  let list = [...TASKS];
  if (q.month) list = list.filter((t) => t.month === q.month);
  if (q.status) list = list.filter((t) => t.status === q.status);
  if (q.assigneeId) list = list.filter((t) => t.assigneeId === q.assigneeId);
  if (q.kind) list = list.filter((t) => t.kind === q.kind);
  return list
    .map((t) => ({ ...t, assignee: t.assigneeId ? employeeById.get(t.assigneeId) : undefined }))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
}

// =============================================================================
// Offboarding — departed employees + their final settlement ("dues")
// =============================================================================
export interface DepartedEmployee extends Employee {
  leftOn: string;
  exitReason: ExitReason;
  settlement: FinalSettlement;
}

/** Everyone who has left: seed departures + anyone offboarded via the UI. */
function departedRoster(): Employee[] {
  const map = new Map<string, Employee>();
  for (const e of EMPLOYEES) {
    const eff = effectiveEmployee(e);
    if (eff.leftOn) map.set(eff.id, eff);
  }
  return [...map.values()];
}

export function getDepartedEmployees(): DepartedEmployee[] {
  return departedRoster()
    .map((e) => ({
      ...e,
      leftOn: e.leftOn as string,
      exitReason: e.exitReason ?? "other",
      settlement: computeSettlement(e),
    }))
    .sort((a, b) => (a.leftOn < b.leftOn ? 1 : -1));
}

export function getSettlement(employeeId: string): FinalSettlement | undefined {
  const e = departedRoster().find((x) => x.id === employeeId);
  return e ? computeSettlement(e) : undefined;
}

export interface OffboardingSummary {
  count: number;
  pending: number;
  cleared: number;
  netDue: number; // net of all settlements
  pendingDue: number; // net of settlements still pending
  thisYear: number; // departures in the open year
}

export function offboardingSummary(): OffboardingSummary {
  const list = getDepartedEmployees();
  const pending = list.filter((d) => d.settlement.status === "pending");
  const year = effectiveOpenMonth().slice(0, 4);
  return {
    count: list.length,
    pending: pending.length,
    cleared: list.length - pending.length,
    netDue: list.reduce((s, d) => s + d.settlement.net, 0),
    pendingDue: pending.reduce((s, d) => s + d.settlement.net, 0),
    thisYear: list.filter((d) => d.leftOn.slice(0, 4) === year).length,
  };
}
