// =============================================================================
// Server-side reads for HR adjustments (advances + unpaid leaves) from Supabase.
// RLS-gated by the caller's session. Shapes are flattened for the UI, joining
// through to the employee (name, code, company) and the open salary structure.
// =============================================================================
import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listEmployees } from "@/lib/db/employees";

export interface AdvanceRow {
  id: string;
  employeeId: string | null;
  employeeName: string;
  employeeCode: string | null;
  entityId: string | null;
  entityName: string | null;
  month: string;
  amount: number;
}

export interface UnpaidLeaveRow {
  id: string;
  employeeId: string | null;
  employeeName: string;
  employeeCode: string | null;
  entityId: string | null;
  entityName: string | null;
  month: string;
  leaveDays: number;
  note: string | null;
  /** Current gross salary (open salary_structure) so the UI can show gross×days/30. */
  gross: number;
  /** Convenience: gross × leaveDays / 30, rounded by the UI's Money formatter. */
  deduction: number;
}

export interface EmployeeOption {
  id: string;
  code: string | null;
  name: string;
  entityId: string | null;
  salary: number;
  /** Set for leavers (last working day) — final-month adjustments stay loggable. */
  leftOn: string | null;
}

/** All advances, joined to employee (name/code) + entity, newest month first. */
export async function listAdvances(): Promise<AdvanceRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("advances")
    .select("id, employee_id, entity_id, month, amount, employees(name, employee_code), entities(name)")
    .order("month", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []).map((r: any) => {
    const emp = (Array.isArray(r.employees) ? r.employees[0] : r.employees) as
      | { name: string; employee_code: string | null }
      | null;
    const entity = (Array.isArray(r.entities) ? r.entities[0] : r.entities) as { name: string } | null;
    return {
      id: r.id as string,
      employeeId: r.employee_id as string | null,
      employeeName: emp?.name ?? "—",
      employeeCode: emp?.employee_code ?? null,
      entityId: r.entity_id as string | null,
      entityName: entity?.name ?? null,
      month: (r.month as string) ?? "",
      amount: Number(r.amount) || 0,
    };
  });

  // Secondary ordering by employee name within a month (DB already sorted by month desc).
  rows.sort((a, b) => (a.month === b.month ? a.employeeName.localeCompare(b.employeeName) : 0));
  return rows;
}

/** All unpaid leaves, joined to employee + entity + the employee's open gross salary. */
export async function listUnpaidLeaves(): Promise<UnpaidLeaveRow[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, { data: structures }] = await Promise.all([
    supabase
      .from("unpaid_leaves")
      .select("id, employee_id, month, leave_days, note, employees(name, employee_code, entity_id, entities(name))")
      .order("month", { ascending: false }),
    supabase.from("salary_structures").select("employee_id, salary, basic, medical, travel").is("effective_to", null),
  ]);
  if (error) throw error;

  const grossByEmp = new Map<string, number>();
  for (const s of structures ?? []) {
    const gross = s.salary ?? (Number(s.basic) || 0) + (Number(s.medical) || 0) + (Number(s.travel) || 0);
    grossByEmp.set(s.employee_id, Number(gross) || 0);
  }

  const rows = (data ?? []).map((r: any) => {
    const emp = (Array.isArray(r.employees) ? r.employees[0] : r.employees) as
      | { name: string; employee_code: string | null; entity_id: string | null; entities: any }
      | null;
    const entity = emp ? ((Array.isArray(emp.entities) ? emp.entities[0] : emp.entities) as { name: string } | null) : null;
    const leaveDays = Number(r.leave_days) || 0;
    const gross = r.employee_id ? grossByEmp.get(r.employee_id) ?? 0 : 0;
    return {
      id: r.id as string,
      employeeId: r.employee_id as string | null,
      employeeName: emp?.name ?? "—",
      employeeCode: emp?.employee_code ?? null,
      entityId: emp?.entity_id ?? null,
      entityName: entity?.name ?? null,
      month: (r.month as string) ?? "",
      leaveDays,
      note: (r.note as string) ?? null,
      gross,
      deduction: (gross * leaveDays) / 30,
    };
  });

  rows.sort((a, b) => (a.month === b.month ? a.employeeName.localeCompare(b.employeeName) : 0));
  return rows;
}

/**
 * Employees for the advance/leave/incentive pickers: everyone active, plus
 * leavers (labelled "(left …)") so their final-month entries can still be
 * logged or corrected. Callers that must not see leavers (offboarding,
 * increments, loans) filter on !leftOn.
 */
export async function listEmployeeOptions(): Promise<EmployeeOption[]> {
  const employees = await listEmployees();
  return employees
    .filter((e) => e.status === "active" || !!e.lastWorkingDay)
    .map((e) => ({
      id: e.id,
      code: e.employeeCode,
      name: e.status === "active" ? e.name : `${e.name} (left ${e.lastWorkingDay})`,
      entityId: e.entityId,
      salary: e.salary,
      leftOn: e.status === "active" ? null : e.lastWorkingDay,
    }));
}
