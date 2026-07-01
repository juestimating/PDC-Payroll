// =============================================================================
// Server-side reads for Sales Incentives (commission_records) from Supabase.
// RLS-gated by the caller's session (all authenticated read; super_admin/hr and
// entity-scoped sales_lead write). Shapes are flattened for the UI, joining
// through to the employee (name, code) and the entity (name).
// =============================================================================
import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listEmployeeOptions } from "@/lib/db/adjustments";

/** Re-export the shared employee picker so the incentives page has one import. */
export { listEmployeeOptions };
export type { EmployeeOption } from "@/lib/db/adjustments";

/** Payout outcome persisted on a commission_records row. */
export type IncentiveStatus = "payable" | "held" | "already_paid";

/** One flattened incentive row for the UI (joins employee + entity). */
export interface IncentiveRow {
  id: string;
  employeeId: string | null;
  employeeName: string;
  employeeCode: string | null;
  entityId: string | null;
  entityName: string | null;
  month: string;
  prevIncremental: number;
  prevIncentive: number;
  /** FX-commission earned on sales this month (saleUSD × % × fx). */
  incentiveAmount: number;
  bonusAmount: number;
  /** accrued = incentive + bonus (+ any carried prev). Books the full expense. */
  accruedTotal: number;
  /** Cash payable this run. */
  payableAmount: number;
  /** accrued − payable (held bonus, or full already-paid accrual). */
  withheldAmount: number;
  status: IncentiveStatus;
  kpiMet: boolean;
  manualOverridePayFull: boolean;
  bankName: string | null;
  accountNumber: string | null;
}

/**
 * All incentive records, joined to employee (name/code) + entity, newest month
 * first and then by employee name within a month.
 */
export async function listIncentives(): Promise<IncentiveRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("commission_records")
    .select(
      "id, employee_id, entity_id, month, prev_incremental, prev_incentive, incentive_amount, bonus_amount, accrued_total, payable_amount, withheld_amount, status, kpi_met, manual_override_pay_full, bank_name, account_number, employees(name, employee_code), entities(name)",
    )
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
      prevIncremental: Number(r.prev_incremental) || 0,
      prevIncentive: Number(r.prev_incentive) || 0,
      incentiveAmount: Number(r.incentive_amount) || 0,
      bonusAmount: Number(r.bonus_amount) || 0,
      accruedTotal: Number(r.accrued_total) || 0,
      payableAmount: Number(r.payable_amount) || 0,
      withheldAmount: Number(r.withheld_amount) || 0,
      status: (r.status as IncentiveStatus) ?? "payable",
      kpiMet: r.kpi_met ?? true,
      manualOverridePayFull: r.manual_override_pay_full ?? false,
      bankName: (r.bank_name as string) ?? null,
      accountNumber: (r.account_number as string) ?? null,
    };
  });

  // Secondary ordering by employee name within a month (DB already sorted by month desc).
  rows.sort((a, b) => (a.month === b.month ? a.employeeName.localeCompare(b.employeeName) : 0));
  return rows;
}
