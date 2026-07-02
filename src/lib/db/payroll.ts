// =============================================================================
// Live payroll computation for a month, from the DB (RLS-gated). Uses the
// owner-chosen EARNED-salary WHT method: tax is computed on the days-worked
// (post-leave / post-exit) salary, medical excluded. Deductions (advance + loan
// installments) reduce net; net is floored at 0.
// Roster is MONTH-AWARE: active employees always; leavers stay listed through
// their exit month (final month prorated) and drop off in later months.
// =============================================================================
import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const DAYS_IN_MONTH = 30;

/** FBR 2025-26 annual salaried slabs. */
export function fbrAnnualTax(annual: number): number {
  if (annual <= 600000) return 0;
  if (annual <= 1200000) return (annual - 600000) * 0.01;
  if (annual <= 2200000) return 6000 + (annual - 1200000) * 0.11;
  if (annual <= 3200000) return 116000 + (annual - 2200000) * 0.23;
  if (annual <= 4100000) return 346000 + (annual - 3200000) * 0.3;
  return 616000 + (annual - 4100000) * 0.35;
}

/** Monthly WHT on the EARNED (days-worked) salary; medical (×10/110) excluded. */
export function earnedWht(earnedGross: number): number {
  const taxable = (earnedGross * 100) / 110; // earned − medical(=earned×10/110)
  return fbrAnnualTax(taxable * 12) / 12;
}

export interface PayrollRow {
  employeeId: string;
  name: string;
  code: string | null;
  entityId: string | null;
  teamName: string | null;
  designation: string;
  cnic: string | null;
  salary: number; // full-month contract gross (D)
  workedDays: number;
  // display components (on full D)
  basic: number;
  ta: number;
  medical: number;
  hra: number;
  earnedGross: number;
  taxable: number;
  wht: number;
  advance: number;
  loanInstallment: number;
  leaveDays: number;
  net: number;
  onHold: boolean;
  lastWorkingDay: string | null; // "YYYY-MM-DD" once offboarded
  exitReason: string | null;
}

function workedDaysFor(month: string, leaveDays: number, lastWorkingDay: string | null): number {
  let worked = Math.max(0, DAYS_IN_MONTH - leaveDays);
  if (lastWorkingDay) {
    const [ly, lm, ld] = lastWorkingDay.split("-").map(Number);
    const [y, m] = month.split("-").map(Number);
    if (ly < y || (ly === y && lm < m)) return 0; // left before this month → no pay (safety net; roster filter excludes these)
    if (ly === y && lm === m) worked = Math.min(worked, Math.min(DAYS_IN_MONTH, ld)); // prorate to last day
  }
  return worked;
}

/** Compute payroll rows for a month: everyone active, plus leavers whose exit month is this month or later. */
export async function computePayrollForMonth(month: string): Promise<PayrollRow[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: emps, error }, { data: structs }, { data: advances }, { data: leaves }, { data: insts }] =
    await Promise.all([
      supabase
        .from("employees")
        .select("id, name, employee_code, entity_id, designation, cnic, status, last_working_day, exit_reason, teams(name)")
        .order("employee_code"),
      supabase.from("salary_structures").select("employee_id, salary, basic, medical, travel").is("effective_to", null),
      supabase.from("advances").select("employee_id, amount").eq("month", month),
      supabase.from("unpaid_leaves").select("employee_id, leave_days").eq("month", month),
      supabase.from("loan_installments").select("employee_id, amount, status").eq("month", month),
    ]);
  if (error) throw error;

  const salaryBy = new Map<string, number>();
  for (const s of structs ?? []) {
    const g = s.salary ?? (Number(s.basic) || 0) + (Number(s.medical) || 0) + (Number(s.travel) || 0);
    salaryBy.set(s.employee_id, Number(g) || 0);
  }
  const advBy = new Map<string, number>();
  for (const a of advances ?? []) advBy.set(a.employee_id, (advBy.get(a.employee_id) ?? 0) + (Number(a.amount) || 0));
  const leaveBy = new Map<string, number>();
  for (const l of leaves ?? []) leaveBy.set(l.employee_id, (leaveBy.get(l.employee_id) ?? 0) + (Number(l.leave_days) || 0));
  const loanBy = new Map<string, number>();
  for (const i of insts ?? []) {
    if (["cancelled", "skipped"].includes(i.status)) continue;
    loanBy.set(i.employee_id, (loanBy.get(i.employee_id) ?? 0) + (Number(i.amount) || 0));
  }

  return (emps ?? [])
    // Month-aware roster: active always; a leaver stays in the payroll of their
    // exit month (and any earlier month) but is unlisted from later months.
    // last_working_day is "YYYY-MM-DD" from PostgREST, so a string compare of
    // its "YYYY-MM" prefix against the month key is safe.
    .filter((e) => e.status === "active" || (!!e.last_working_day && String(e.last_working_day).slice(0, 7) >= month))
    .map((e: any) => {
      const team = (Array.isArray(e.teams) ? e.teams[0] : e.teams) as { name: string } | null;
      const D = salaryBy.get(e.id) ?? 0;
      const leaveDays = leaveBy.get(e.id) ?? 0;
      const workedDays = workedDaysFor(month, leaveDays, e.last_working_day);
      const earnedGross = (D * workedDays) / DAYS_IN_MONTH;
      const wht = earnedWht(earnedGross);
      const advance = advBy.get(e.id) ?? 0;
      const loanInstallment = loanBy.get(e.id) ?? 0;
      const net = Math.max(0, earnedGross - wht - advance - loanInstallment);
      return {
        employeeId: e.id,
        name: e.name,
        code: e.employee_code,
        entityId: e.entity_id,
        teamName: team?.name ?? null,
        designation: e.designation,
        cnic: e.cnic,
        salary: D,
        workedDays,
        basic: D * 0.65,
        ta: D * 0.1,
        medical: D * 0.1,
        hra: D * 0.15,
        earnedGross,
        taxable: (earnedGross * 100) / 110,
        wht,
        advance,
        loanInstallment,
        leaveDays,
        net,
        onHold: workedDays <= 0,
        lastWorkingDay: (e.last_working_day as string | null) ?? null,
        exitReason: (e.exit_reason as string | null) ?? null,
      };
    });
}
