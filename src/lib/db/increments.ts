// =============================================================================
// Server-side reads for the Increments module (RLS-gated by the caller's
// session). An increment lifts an employee's gross salary (a % on gross, or a
// flat absolute amount) and is split across the four components 65/10/10/15.
// Applying one also rolls the employee's open salary_structure forward so the
// next payroll run uses the new figure. Shapes are flattened for the UI.
// =============================================================================
import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Reuse the shared active-employee picker so the same list/entity mapping is used
// everywhere. Re-exported for convenience of the Increments page.
export { listEmployeeOptions } from "@/lib/db/adjustments";
export type { EmployeeOption } from "@/lib/db/adjustments";

export interface IncrementRow {
  id: string;
  employeeId: string | null;
  employeeName: string;
  employeeCode: string | null;
  date: string;
  kind: "percent" | "absolute";
  percent: number | null;
  oldSalary: number;
  newSalary: number;
  reason: string | null;
  byUser: string | null;
}

/** All increments, joined to employee (name/code), newest first. */
export async function listIncrements(): Promise<IncrementRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("increments")
    .select("id, employee_id, date, kind, percent, old_salary, new_salary, reason, by_user, employees(name, employee_code)")
    .order("date", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((r: any) => {
    const emp = (Array.isArray(r.employees) ? r.employees[0] : r.employees) as
      | { name: string; employee_code: string | null }
      | null;
    return {
      id: r.id as string,
      employeeId: r.employee_id as string | null,
      employeeName: emp?.name ?? "—",
      employeeCode: emp?.employee_code ?? null,
      date: (r.date as string) ?? "",
      kind: (r.kind as "percent" | "absolute") ?? "percent",
      percent: r.percent == null ? null : Number(r.percent),
      oldSalary: Number(r.old_salary) || 0,
      newSalary: Number(r.new_salary) || 0,
      reason: (r.reason as string) ?? null,
      byUser: (r.by_user as string) ?? null,
    };
  });
}
