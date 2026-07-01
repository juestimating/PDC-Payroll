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
