// =============================================================================
// Server-side DERIVED deductions view for a month (RLS-gated). Deductions are
// never stored as their own rows — this recomputes them exactly as payroll
// counts them (mirroring src/lib/db/payroll.ts):
//   advance          = advances.amount logged for the month
//   leave deduction  = open-structure gross × leave_days / 30
//   loan installment = loan_installments.amount due that month (not cancelled /
//                      skipped)
// Read-only by design: edit the sources in Advances / Unpaid Leaves / Loans.
// =============================================================================
import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DAYS_IN_MONTH = 30;

export interface DeductionRow {
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  entityId: string | null;
  /** Open-structure gross the leave deduction is computed from. */
  gross: number;
  advance: number;
  leaveDays: number;
  leaveDeduction: number;
  loanInstallment: number;
  total: number;
}

/** Per-employee deduction components for a month (active employees with any deduction). */
export async function getDeductionsForMonth(month: string): Promise<DeductionRow[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: emps, error }, { data: structs }, { data: advances }, { data: leaves }, { data: insts }] =
    await Promise.all([
      supabase.from("employees").select("id, name, employee_code, entity_id, status, last_working_day").order("employee_code"),
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
    // Same roster rule as payroll: leavers count through their exit month.
    .filter((e) => e.status === "active" || (!!e.last_working_day && String(e.last_working_day).slice(0, 7) >= month))
    .map((e) => {
      const gross = salaryBy.get(e.id) ?? 0;
      const advance = advBy.get(e.id) ?? 0;
      const leaveDays = leaveBy.get(e.id) ?? 0;
      const leaveDeduction = (gross * leaveDays) / DAYS_IN_MONTH;
      const loanInstallment = loanBy.get(e.id) ?? 0;
      return {
        employeeId: e.id as string,
        employeeName: e.name as string,
        employeeCode: (e.employee_code as string | null) ?? null,
        entityId: (e.entity_id as string | null) ?? null,
        gross,
        advance,
        leaveDays,
        leaveDeduction,
        loanInstallment,
        total: advance + leaveDeduction + loanInstallment,
      };
    })
    .filter((r) => r.total > 0);
}

/** Distinct months that have any advance / leave / installment logged, newest first. */
export async function listDeductionMonths(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: a }, { data: l }, { data: i }] = await Promise.all([
    supabase.from("advances").select("month"),
    supabase.from("unpaid_leaves").select("month"),
    supabase.from("loan_installments").select("month"),
  ]);
  const months = new Set<string>();
  for (const r of [...(a ?? []), ...(l ?? []), ...(i ?? [])]) {
    if (r.month && /^\d{4}-\d{2}$/.test(r.month)) months.add(r.month);
  }
  return [...months].sort().reverse();
}
