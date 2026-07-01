"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface NewLeaveInput {
  employeeId: string;
  month: string;
  leaveDays: number;
  note: string | null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const MONTH_RE = /^\d{4}-\d{2}$/;

/**
 * Log unpaid-leave days for an employee in a month. Days are allowed in 0.5
 * steps (half-day granularity). The deduction (computed at payroll time) is
 * employee_gross × leave_days / 30. One record per employee per month.
 * RLS enforces that only super_admin / hr may write.
 */
export async function createLeaveAction(input: NewLeaveInput): Promise<ActionResult> {
  // --- validate ---
  if (!input.employeeId) return { ok: false, error: "Select an employee." };
  if (!input.month || !MONTH_RE.test(input.month)) {
    return { ok: false, error: "Month must look like 2026-05." };
  }
  if (!input.leaveDays || input.leaveDays <= 0) {
    return { ok: false, error: "Leave days must be greater than 0." };
  }
  if ((input.leaveDays * 2) % 1 !== 0) {
    return { ok: false, error: "Leave days must be in half-day steps (e.g. 1, 1.5, 2.5)." };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("unpaid_leaves").insert({
    employee_id: input.employeeId,
    month: input.month,
    leave_days: Number(input.leaveDays),
    note: input.note?.trim() || null,
  });

  if (error) {
    if (/row-level security|permission|privilege/i.test(error.message)) {
      return { ok: false, error: "You don't have permission to log unpaid leave." };
    }
    if (/duplicate key|unique/i.test(error.message)) {
      return { ok: false, error: "Unpaid leave is already logged for this employee this month." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/leaves");
  return { ok: true };
}
