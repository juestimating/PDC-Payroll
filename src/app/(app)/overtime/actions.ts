"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface NewOvertimeInput {
  employeeId: string;
  month: string;
  weekdayHours: number;
  weekendHours: number;
  dayType: "normal" | "govt" | "eid";
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const MONTH_RE = /^\d{4}-\d{2}$/;
const OT_BASIC_FACTOR = 0.65;
const STANDARD_HOURS = 176; // 22 working days × 8 hours
const MULTIPLIERS: Record<NewOvertimeInput["dayType"], number> = {
  normal: 1.5,
  govt: 2,
  eid: 2.5,
};

/**
 * Log overtime for an estimation-team employee. The rate is derived from the
 * employee's open (current) gross salary: rate = (gross × 0.65) / 176, i.e. the
 * monthly Basic spread over 22 working days × 8 hours. Pay = totalHours × rate ×
 * multiplier (1.5× normal, 2× govt, 2.5× Eid); sub_total = amount + bonus.
 * `total_hours` is a GENERATED column so we never write it. RLS restricts writes
 * to super_admin / hr, and estimation_lead within their entity scope.
 */
export async function createOvertimeAction(input: NewOvertimeInput): Promise<ActionResult> {
  // --- validate ---
  if (!input.employeeId) return { ok: false, error: "Select an employee." };
  if (!input.month || !MONTH_RE.test(input.month)) {
    return { ok: false, error: "Month must look like 2026-05." };
  }
  const weekday = Number(input.weekdayHours) || 0;
  const weekend = Number(input.weekendHours) || 0;
  if (weekday < 0 || weekend < 0) return { ok: false, error: "Hours can't be negative." };
  if (weekday + weekend <= 0) return { ok: false, error: "Enter at least some overtime hours." };
  const multiplier = MULTIPLIERS[input.dayType] ?? 1.5;

  const supabase = await createSupabaseServerClient();

  // Resolve the employee's company so the overtime is attributed to the right entity.
  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("entity_id")
    .eq("id", input.employeeId)
    .single();
  if (empErr || !emp) return { ok: false, error: "Employee not found." };

  // Pull the employee's open (current) salary structure for the gross basis.
  const { data: structure } = await supabase
    .from("salary_structures")
    .select("salary, basic, medical, travel")
    .eq("employee_id", input.employeeId)
    .is("effective_to", null)
    .maybeSingle();

  const gross =
    Number(structure?.salary) ||
    (Number(structure?.basic) || 0) + (Number(structure?.medical) || 0) + (Number(structure?.travel) || 0);
  if (!gross) return { ok: false, error: "This employee has no active salary — set one first." };

  const ratePerHour = (gross * OT_BASIC_FACTOR) / STANDARD_HOURS;
  const totalHours = weekday + weekend;
  const amount = totalHours * ratePerHour * multiplier;
  const subTotal = amount; // no bonus captured in this quick-log form

  const { error } = await supabase.from("overtime_details").insert({
    employee_id: input.employeeId,
    entity_id: emp.entity_id,
    month: input.month,
    gross_basis: gross,
    ot_basic_factor: OT_BASIC_FACTOR,
    standard_hours: STANDARD_HOURS,
    weekday_hours: weekday,
    weekend_hours: weekend,
    // total_hours is a GENERATED column — never write it.
    day_type: input.dayType,
    multiplier,
    bonus: 0,
    rate_per_hour: Number(ratePerHour.toFixed(4)),
    amount: Number(amount.toFixed(2)),
    sub_total: Number(subTotal.toFixed(2)),
  });

  if (error) {
    if (/row-level security|permission|privilege/i.test(error.message)) {
      return { ok: false, error: "You don't have permission to log overtime for this company." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/overtime");
  return { ok: true };
}

export interface UpdateOvertimeInput {
  weekdayHours: number;
  weekendHours: number;
  dayType: "normal" | "govt" | "eid";
}

/**
 * Correct a wrongly-entered overtime entry. Hours and day type are editable;
 * rate_per_hour / amount / sub_total are recomputed exactly like
 * createOvertimeAction (open gross × 0.65 ÷ 176, pay = hours × rate ×
 * multiplier, sub_total = amount + bonus). Employee and month are immutable —
 * to move an entry, delete it and re-log it. `total_hours` is a GENERATED
 * column so we never write it. RLS restricts writes as on create.
 */
export async function updateOvertimeAction(id: string, input: UpdateOvertimeInput): Promise<ActionResult> {
  // --- validate ---
  if (!id) return { ok: false, error: "Missing overtime entry." };
  const weekday = Number(input.weekdayHours) || 0;
  const weekend = Number(input.weekendHours) || 0;
  if (weekday < 0 || weekend < 0) return { ok: false, error: "Hours can't be negative." };
  if (weekday + weekend <= 0) return { ok: false, error: "Enter at least some overtime hours." };
  const multiplier = MULTIPLIERS[input.dayType] ?? 1.5;

  const supabase = await createSupabaseServerClient();

  // Load the entry — the employee and any imported bonus stay as they are.
  const { data: row, error: rowErr } = await supabase
    .from("overtime_details")
    .select("id, employee_id, bonus")
    .eq("id", id)
    .maybeSingle();
  if (rowErr) return { ok: false, error: rowErr.message };
  if (!row?.employee_id) return { ok: false, error: "Overtime entry not found." };

  // Pull the employee's open (current) salary structure for the gross basis.
  const { data: structure } = await supabase
    .from("salary_structures")
    .select("salary, basic, medical, travel")
    .eq("employee_id", row.employee_id)
    .is("effective_to", null)
    .maybeSingle();

  const gross =
    Number(structure?.salary) ||
    (Number(structure?.basic) || 0) + (Number(structure?.medical) || 0) + (Number(structure?.travel) || 0);
  if (!gross) return { ok: false, error: "This employee has no active salary — set one first." };

  const ratePerHour = (gross * OT_BASIC_FACTOR) / STANDARD_HOURS;
  const totalHours = weekday + weekend;
  const amount = totalHours * ratePerHour * multiplier;
  const subTotal = amount + (Number(row.bonus) || 0);

  const { data, error } = await supabase
    .from("overtime_details")
    .update({
      gross_basis: gross,
      ot_basic_factor: OT_BASIC_FACTOR,
      standard_hours: STANDARD_HOURS,
      weekday_hours: weekday,
      weekend_hours: weekend,
      // total_hours is a GENERATED column — never write it.
      day_type: input.dayType,
      multiplier,
      rate_per_hour: Number(ratePerHour.toFixed(4)),
      amount: Number(amount.toFixed(2)),
      sub_total: Number(subTotal.toFixed(2)),
    })
    .eq("id", id)
    .select("id");

  if (error) {
    if (/row-level security|permission|privilege/i.test(error.message)) {
      return { ok: false, error: "You don't have permission to edit overtime for this company." };
    }
    return { ok: false, error: error.message };
  }
  // RLS filters silently — zero rows touched means the caller may not write here.
  if (!data || data.length === 0) {
    return { ok: false, error: "You don't have permission to edit overtime for this company." };
  }

  revalidatePath("/overtime");
  return { ok: true };
}

/** Remove an overtime entry entirely (e.g. logged against the wrong month or person). */
export async function deleteOvertimeAction(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Missing overtime entry." };

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.from("overtime_details").delete().eq("id", id).select("id");

  if (error) {
    if (/row-level security|permission|privilege/i.test(error.message)) {
      return { ok: false, error: "You don't have permission to delete overtime for this company." };
    }
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "You don't have permission to delete overtime for this company." };
  }

  revalidatePath("/overtime");
  return { ok: true };
}
