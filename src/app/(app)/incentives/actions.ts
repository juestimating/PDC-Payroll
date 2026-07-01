"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface NewIncentiveInput {
  employeeId: string;
  month: string;
  saleValueUsd: number;
  commissionPct: number;
  fxRate: number;
  bonus: number;
  kpiMet: boolean;
  alreadyPaid: boolean;
  note?: string | null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const MONTH_RE = /^\d{4}-\d{2}$/;

/**
 * Log a monthly sales incentive. Computes the FX-commission earned on sales
 * (saleUSD × % × fx), accrues it with any discretionary bonus, then applies the
 * payout policy to derive the cash payable / withheld / status:
 *   • already paid            → payable 0 (kept in accrual)
 *   • KPI met                 → payable = accrued (bonus released)
 *   • KPI not met             → payable = incentive only (bonus withheld)
 * One record per employee per month. RLS enforces super_admin / hr (any entity)
 * and sales_lead (their entity scope) may write.
 */
export async function createIncentiveAction(input: NewIncentiveInput): Promise<ActionResult> {
  // --- validate ---
  if (!input.employeeId) return { ok: false, error: "Select an employee." };
  if (!input.month || !MONTH_RE.test(input.month)) {
    return { ok: false, error: "Month must look like 2026-05." };
  }
  if (input.saleValueUsd == null || input.saleValueUsd < 0) {
    return { ok: false, error: "Sale value (USD) can't be negative." };
  }
  if (input.commissionPct == null || input.commissionPct < 0) {
    return { ok: false, error: "Commission % can't be negative." };
  }
  if (!input.fxRate || input.fxRate <= 0) {
    return { ok: false, error: "FX rate must be greater than 0." };
  }

  const saleValueUsd = Number(input.saleValueUsd) || 0;
  const commissionPct = Number(input.commissionPct) || 0;
  const fxRate = Number(input.fxRate);
  const bonus = Number(input.bonus) || 0;
  const kpiMet = !!input.kpiMet;
  const alreadyPaid = !!input.alreadyPaid;

  // --- compute per the verified incentives engine ---
  const incentiveAmount = saleValueUsd * (commissionPct / 100) * fxRate;
  const accruedTotal = incentiveAmount + bonus;
  const status = alreadyPaid ? "already_paid" : kpiMet ? "payable" : "held";
  const payableAmount = alreadyPaid ? 0 : kpiMet ? accruedTotal : incentiveAmount;
  const withheldAmount = accruedTotal - payableAmount;

  const supabase = await createSupabaseServerClient();

  // Resolve the employee's company so the incentive is attributed to the right entity.
  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("entity_id")
    .eq("id", input.employeeId)
    .single();
  if (empErr || !emp) return { ok: false, error: "Employee not found." };

  const { error } = await supabase
    .from("commission_records")
    .upsert(
      {
        employee_id: input.employeeId,
        entity_id: emp.entity_id,
        month: input.month,
        incentive_amount: incentiveAmount,
        bonus_amount: bonus,
        accrued_total: accruedTotal,
        payable_amount: payableAmount,
        withheld_amount: withheldAmount,
        status,
        kpi_met: kpiMet,
        manual_override_pay_full: false,
        incentive_basis: { saleValueUsd, commissionPct, fxRate },
      },
      { onConflict: "employee_id,month" },
    );

  if (error) {
    if (/row-level security|permission|privilege/i.test(error.message)) {
      return { ok: false, error: "You don't have permission to log incentives." };
    }
    if (/duplicate key|unique/i.test(error.message)) {
      return { ok: false, error: "An incentive is already logged for this employee this month." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/incentives");
  return { ok: true };
}
