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

/** The USD sale basis behind a derived FX commission (from incentive_basis jsonb). */
export interface IncentiveBasis {
  saleValueUsd: number;
  commissionPct: number;
  fxRate: number;
}

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
  /** Manual "New Sales" commission cell (PKR, entered directly). */
  newSales: number;
  /** Manual "Recurring" commission cell (PKR, entered directly). */
  recurring: number;
  /** Manual "Sales Bonus" cell (PKR, KPI-holdable like the bonus). */
  salesBonus: number;
  /** accrued = commissions + bonuses (+ any carried prev). Books the full expense. */
  accruedTotal: number;
  /** Cash payable this run. */
  payableAmount: number;
  /** accrued − payable (held bonuses, or full already-paid accrual). */
  withheldAmount: number;
  status: IncentiveStatus;
  kpiMet: boolean;
  manualOverridePayFull: boolean;
  /** USD sale basis when the commission was derived (null for manual-only rows). */
  incentiveBasis: IncentiveBasis | null;
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
      "id, employee_id, entity_id, month, prev_incremental, prev_incentive, incentive_amount, bonus_amount, new_sales_amount, recurring_amount, sales_bonus_amount, accrued_total, payable_amount, withheld_amount, status, kpi_met, manual_override_pay_full, incentive_basis, bank_name, account_number, employees(name, employee_code), entities(name)",
    )
    .order("month", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []).map((r: any) => {
    const emp = (Array.isArray(r.employees) ? r.employees[0] : r.employees) as
      | { name: string; employee_code: string | null }
      | null;
    const entity = (Array.isArray(r.entities) ? r.entities[0] : r.entities) as { name: string } | null;
    const basis = r.incentive_basis as Partial<IncentiveBasis> | null;
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
      newSales: Number(r.new_sales_amount) || 0,
      recurring: Number(r.recurring_amount) || 0,
      salesBonus: Number(r.sales_bonus_amount) || 0,
      accruedTotal: Number(r.accrued_total) || 0,
      payableAmount: Number(r.payable_amount) || 0,
      withheldAmount: Number(r.withheld_amount) || 0,
      status: (r.status as IncentiveStatus) ?? "payable",
      kpiMet: r.kpi_met ?? true,
      manualOverridePayFull: r.manual_override_pay_full ?? false,
      incentiveBasis:
        basis && (Number(basis.saleValueUsd) || 0) > 0
          ? {
              saleValueUsd: Number(basis.saleValueUsd) || 0,
              commissionPct: Number(basis.commissionPct) || 0,
              fxRate: Number(basis.fxRate) || 0,
            }
          : null,
      bankName: (r.bank_name as string) ?? null,
      accountNumber: (r.account_number as string) ?? null,
    };
  });

  // Secondary ordering by employee name within a month (DB already sorted by month desc).
  rows.sort((a, b) => (a.month === b.month ? a.employeeName.localeCompare(b.employeeName) : 0));
  return rows;
}
