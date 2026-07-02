// =============================================================================
// Server-side reads for the estimation-team Overtime module (RLS-gated by the
// caller's session). Shapes are flattened for the UI. The overtime rate is
// derived from the employee's monthly Basic: rate = (gross × 0.65) / 176, i.e.
// Basic ÷ (22 working days × 8 hours).
// =============================================================================
import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listEmployees } from "@/lib/db/employees";

export interface OvertimeRow {
  id: string;
  employeeId: string | null;
  employeeName: string;
  employeeCode: string | null;
  entityId: string | null;
  month: string;
  dayType: string;
  /** The gross salary the rate was derived from when the entry was written. */
  grossBasis: number;
  weekdayHours: number;
  weekendHours: number;
  totalHours: number;
  multiplier: number;
  ratePerHour: number;
  bonus: number;
  amount: number;
  subTotal: number;
}

export interface EstimationEmployee {
  id: string;
  code: string | null;
  name: string;
  entityId: string | null;
  salary: number;
}

/** All overtime entries, joined to employee (name/code/entity), newest month first. */
export async function listOvertime(month: string): Promise<OvertimeRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("overtime_details")
    .select(
      "id, employee_id, entity_id, month, day_type, gross_basis, weekday_hours, weekend_hours, total_hours, multiplier, rate_per_hour, bonus, amount, sub_total, employees(name, employee_code, entity_id)",
    )
    .eq("month", month)
    .order("employee_id", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []).map((r: any) => {
    const emp = (Array.isArray(r.employees) ? r.employees[0] : r.employees) as
      | { name: string; employee_code: string | null; entity_id: string | null }
      | null;
    return {
      id: r.id as string,
      employeeId: r.employee_id as string | null,
      employeeName: emp?.name ?? "—",
      employeeCode: emp?.employee_code ?? null,
      entityId: (r.entity_id as string | null) ?? emp?.entity_id ?? null,
      month: (r.month as string) ?? "",
      dayType: (r.day_type as string) ?? "normal",
      grossBasis: Number(r.gross_basis) || 0,
      weekdayHours: Number(r.weekday_hours) || 0,
      weekendHours: Number(r.weekend_hours) || 0,
      totalHours: Number(r.total_hours) || 0,
      multiplier: Number(r.multiplier) || 0,
      ratePerHour: Number(r.rate_per_hour) || 0,
      bonus: Number(r.bonus) || 0,
      amount: Number(r.amount) || 0,
      subTotal: Number(r.sub_total) || 0,
    };
  });

  rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  return rows;
}

/** Active employees on the estimation team, with their open gross salary, for the OT picker. */
export async function listEstimationEmployees(): Promise<EstimationEmployee[]> {
  const employees = await listEmployees();
  return employees
    .filter((e) => e.status === "active" && e.teamKind === "estimation")
    .map((e) => ({
      id: e.id,
      code: e.employeeCode,
      name: e.name,
      entityId: e.entityId,
      salary: e.salary,
    }));
}
