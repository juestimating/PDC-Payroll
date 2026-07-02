"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EXIT_REASONS, type ExitReason } from "@/lib/db/offboarding";

export interface MarkAsLeftInput {
  employeeId: string;
  lastWorkingDay: string;
  exitReason: string;
  exitNote?: string | null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Mark an employee as left: sets their last working day + exit metadata and
 * flips status to inactive. The payroll engine prorates the final month to the
 * last working day — there is no gratuity / end-of-service settlement. They
 * stay on payroll through their exit month and are unlisted from later months.
 * RLS restricts writes to super_admin / hr.
 */
export async function markAsLeftAction(input: MarkAsLeftInput): Promise<ActionResult> {
  if (!input.employeeId) return { ok: false, error: "Select an employee." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.lastWorkingDay ?? "")) {
    return { ok: false, error: "Last working day must look like 2026-05-31." };
  }
  if (!EXIT_REASONS.includes(input.exitReason as ExitReason)) {
    return { ok: false, error: "Pick a valid exit reason." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("employees")
    .update({
      last_working_day: input.lastWorkingDay,
      exit_reason: input.exitReason,
      exit_note: input.exitNote?.trim() || null,
      status: "inactive",
    })
    .eq("id", input.employeeId);

  if (error) {
    if (/row-level security|permission|privilege/i.test(error.message)) {
      return { ok: false, error: "Only HR / Super Admin can offboard employees." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/offboarding");
  revalidatePath("/payroll");
  revalidatePath("/tax");
  return { ok: true };
}
