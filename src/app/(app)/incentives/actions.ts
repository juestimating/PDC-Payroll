"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface NewIncentiveInput {
  employeeId: string;
  month: string;
  /** USD sale basis — optional, but all three must be > 0 together when used. */
  saleValueUsd?: number | null;
  commissionPct?: number | null;
  fxRate?: number | null;
  bonus: number;
  /** Manual PKR cells, entered directly (no derivation). */
  newSales?: number | null;
  recurring?: number | null;
  salesBonus?: number | null;
  kpiMet: boolean;
  alreadyPaid: boolean;
  note?: string | null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const MONTH_RE = /^\d{4}-\d{2}$/;

/** Round a money figure to 2dp before writing. */
const r2 = (n: number) => Number(n.toFixed(2));

/**
 * Shared validation for create + update. The USD-derived basis is OPTIONAL:
 * a record can carry only manual amounts, only the USD sale basis, or both —
 * but touching saleValueUsd/commissionPct commits you to the full basis.
 */
function validateIncentiveInput(input: NewIncentiveInput): string | null {
  if (!input.employeeId) return "Select an employee.";
  if (!input.month || !MONTH_RE.test(input.month)) return "Month must look like 2026-05.";

  const negatives: [string, number | null | undefined][] = [
    ["Sale value (USD)", input.saleValueUsd],
    ["Commission %", input.commissionPct],
    ["FX rate", input.fxRate],
    ["Bonus", input.bonus],
    ["New Sales", input.newSales],
    ["Recurring", input.recurring],
    ["Sales Bonus", input.salesBonus],
  ];
  for (const [label, v] of negatives) {
    if (v != null && v < 0) return `${label} can't be negative.`;
  }

  const usd = Number(input.saleValueUsd) || 0;
  const pct = Number(input.commissionPct) || 0;
  const fx = Number(input.fxRate) || 0;
  if ((usd > 0 || pct > 0) && !(usd > 0 && pct > 0 && fx > 0)) {
    return "For a USD commission, fill sale value, commission % and FX rate together (all above 0).";
  }

  const incentive = usd > 0 && pct > 0 && fx > 0 ? usd * (pct / 100) * fx : 0;
  const manual =
    (Number(input.bonus) || 0) +
    (Number(input.newSales) || 0) +
    (Number(input.recurring) || 0) +
    (Number(input.salesBonus) || 0);
  if (incentive <= 0 && manual <= 0) {
    return "Enter a USD sale basis or at least one manual amount above 0.";
  }
  return null;
}

/**
 * Compute the money model from the input + any carried prev balances:
 *   commissions = FX incentive + New Sales + Recurring   (never held)
 *   bonuses     = bonus + Sales Bonus                    (held until KPI met)
 *   accrued     = prev + commissions + bonuses           (full expense)
 *   payable     = already paid → 0 · KPI met → accrued · else prev + commissions
 *   withheld    = accrued − payable
 */
function computeIncentive(input: NewIncentiveInput, prevIncremental: number, prevIncentive: number) {
  const usd = Number(input.saleValueUsd) || 0;
  const pct = Number(input.commissionPct) || 0;
  const fx = Number(input.fxRate) || 0;
  const hasBasis = usd > 0 && pct > 0 && fx > 0;

  // Round the components first so accrued = payable + withheld holds exactly at 2dp.
  const incentiveAmount = r2(hasBasis ? usd * (pct / 100) * fx : 0);
  const bonus = r2(Number(input.bonus) || 0);
  const newSales = r2(Number(input.newSales) || 0);
  const recurring = r2(Number(input.recurring) || 0);
  const salesBonus = r2(Number(input.salesBonus) || 0);

  const commissionsTotal = incentiveAmount + newSales + recurring;
  const bonusesTotal = bonus + salesBonus;
  const prevTotal = prevIncremental + prevIncentive;
  const accruedTotal = prevTotal + commissionsTotal + bonusesTotal;

  const kpiMet = !!input.kpiMet;
  const alreadyPaid = !!input.alreadyPaid;
  const status = alreadyPaid ? "already_paid" : kpiMet ? "payable" : "held";
  const payableAmount = alreadyPaid ? 0 : kpiMet ? accruedTotal : prevTotal + commissionsTotal;
  const withheldAmount = accruedTotal - payableAmount;

  return {
    incentive_amount: incentiveAmount,
    bonus_amount: bonus,
    new_sales_amount: newSales,
    recurring_amount: recurring,
    sales_bonus_amount: salesBonus,
    accrued_total: r2(accruedTotal),
    payable_amount: r2(payableAmount),
    withheld_amount: r2(withheldAmount),
    status,
    kpi_met: kpiMet,
    incentive_basis: hasBasis ? { saleValueUsd: usd, commissionPct: pct, fxRate: fx } : null,
  };
}

function mapWriteError(error: { message: string }, verb: string): ActionResult {
  if (/row-level security|permission|privilege/i.test(error.message)) {
    return { ok: false, error: `You don't have permission to ${verb} incentives.` };
  }
  if (/duplicate key|unique/i.test(error.message)) {
    return { ok: false, error: "An incentive is already logged for this employee this month." };
  }
  return { ok: false, error: error.message };
}

/**
 * Log a monthly sales incentive. The FX commission (saleUSD × % × fx) is
 * optional — the three manual cells (New Sales / Recurring / Sales Bonus) and
 * the discretionary bonus can be entered directly. Payout policy:
 *   • already paid            → payable 0 (kept in accrual)
 *   • KPI met                 → payable = accrued (bonuses released)
 *   • KPI not met             → payable = commissions only (bonuses withheld)
 * One record per employee per month (upsert). RLS enforces super_admin / hr
 * (any entity) and sales_lead (their entity scope) may write.
 */
export async function createIncentiveAction(input: NewIncentiveInput): Promise<ActionResult> {
  const invalid = validateIncentiveInput(input);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createSupabaseServerClient();

  // Resolve the employee's company so the incentive is attributed to the right entity.
  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("entity_id")
    .eq("id", input.employeeId)
    .single();
  if (empErr || !emp) return { ok: false, error: "Employee not found." };

  // The upsert may silently update an existing month — keep its carried balances.
  const { data: existing } = await supabase
    .from("commission_records")
    .select("prev_incremental, prev_incentive")
    .eq("employee_id", input.employeeId)
    .eq("month", input.month)
    .maybeSingle();

  const computed = computeIncentive(
    input,
    Number(existing?.prev_incremental) || 0,
    Number(existing?.prev_incentive) || 0,
  );

  const { error } = await supabase
    .from("commission_records")
    .upsert(
      {
        employee_id: input.employeeId,
        entity_id: emp.entity_id,
        month: input.month,
        manual_override_pay_full: false,
        ...computed,
      },
      { onConflict: "employee_id,month" },
    );

  if (error) return mapWriteError(error, "log");

  revalidatePath("/incentives");
  return { ok: true };
}

/**
 * Edit an existing incentive record in place (keyed by id), recomputing the
 * payout from the new inputs while preserving the row's carried prev balances.
 */
export async function updateIncentiveAction(id: string, input: NewIncentiveInput): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Missing incentive id." };
  const invalid = validateIncentiveInput(input);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createSupabaseServerClient();

  const { data: row, error: rowErr } = await supabase
    .from("commission_records")
    .select("prev_incremental, prev_incentive")
    .eq("id", id)
    .maybeSingle();
  if (rowErr || !row) return { ok: false, error: "Incentive record not found." };

  // Re-resolve the entity in case the record was moved to another employee.
  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("entity_id")
    .eq("id", input.employeeId)
    .single();
  if (empErr || !emp) return { ok: false, error: "Employee not found." };

  const computed = computeIncentive(
    input,
    Number(row.prev_incremental) || 0,
    Number(row.prev_incentive) || 0,
  );

  const { data, error } = await supabase
    .from("commission_records")
    .update({
      employee_id: input.employeeId,
      entity_id: emp.entity_id,
      month: input.month,
      ...computed,
    })
    .eq("id", id)
    .select("id");

  if (error) return mapWriteError(error, "edit");
  // RLS silently filters rows it won't let you touch — surface that as a denial.
  if (!data?.length) {
    return { ok: false, error: "You don't have permission to edit incentives." };
  }

  revalidatePath("/incentives");
  return { ok: true };
}

/** Delete an incentive record. Audit triggers keep the history automatically. */
export async function deleteIncentiveAction(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Missing incentive id." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("commission_records").delete().eq("id", id).select("id");

  if (error) return mapWriteError(error, "delete");
  if (!data?.length) {
    return { ok: false, error: "You don't have permission to delete incentives." };
  }

  revalidatePath("/incentives");
  return { ok: true };
}
