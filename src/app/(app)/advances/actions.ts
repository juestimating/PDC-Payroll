"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface NewAdvanceInput {
  employeeId: string;
  month: string;
  amount: number;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const MONTH_RE = /^\d{4}-\d{2}$/;

/**
 * Log a monthly advance. An advance is a fixed amount deducted IN FULL from that
 * same month's salary only (never scheduled). One advance per employee per month.
 * RLS enforces that only super_admin / hr may write.
 */
export async function createAdvanceAction(input: NewAdvanceInput): Promise<ActionResult> {
  // --- validate ---
  if (!input.employeeId) return { ok: false, error: "Select an employee." };
  if (!input.month || !MONTH_RE.test(input.month)) {
    return { ok: false, error: "Month must look like 2026-05." };
  }
  if (!input.amount || input.amount <= 0) {
    return { ok: false, error: "Advance amount must be greater than 0." };
  }

  const supabase = await createSupabaseServerClient();

  // Resolve the employee's company so the advance is attributed to the right entity.
  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("entity_id")
    .eq("id", input.employeeId)
    .single();
  if (empErr || !emp) return { ok: false, error: "Employee not found." };

  const { error } = await supabase.from("advances").insert({
    employee_id: input.employeeId,
    entity_id: emp.entity_id,
    month: input.month,
    amount: Number(input.amount),
  });

  if (error) {
    if (/row-level security|permission|privilege/i.test(error.message)) {
      return { ok: false, error: "You don't have permission to log advances." };
    }
    if (/duplicate key|unique/i.test(error.message)) {
      return { ok: false, error: "An advance is already logged for this employee this month." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/advances");
  return { ok: true };
}

/**
 * Correct a wrongly-entered advance amount. Employee, company and month are
 * immutable — to move an advance to another month, delete it and re-log it.
 * (The advances table stores no note.) RLS enforces super_admin / hr.
 */
export async function updateAdvanceAction(id: string, input: { amount: number }): Promise<ActionResult> {
  // --- validate ---
  if (!id) return { ok: false, error: "Missing advance." };
  if (!input.amount || input.amount <= 0) {
    return { ok: false, error: "Advance amount must be greater than 0." };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("advances")
    .update({ amount: Number(Number(input.amount).toFixed(2)) })
    .eq("id", id)
    .select("id");

  if (error) {
    if (/row-level security|permission|privilege/i.test(error.message)) {
      return { ok: false, error: "Only HR / Super Admin can edit advances." };
    }
    return { ok: false, error: error.message };
  }
  // RLS filters silently — zero rows touched means the caller may not write here.
  if (!data || data.length === 0) return { ok: false, error: "Only HR / Super Admin can edit advances." };

  revalidatePath("/advances");
  return { ok: true };
}

/** Remove an advance entirely (e.g. logged against the wrong month or person). */
export async function deleteAdvanceAction(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Missing advance." };

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.from("advances").delete().eq("id", id).select("id");

  if (error) {
    if (/row-level security|permission|privilege/i.test(error.message)) {
      return { ok: false, error: "Only HR / Super Admin can delete advances." };
    }
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) return { ok: false, error: "Only HR / Super Admin can delete advances." };

  revalidatePath("/advances");
  return { ok: true };
}
