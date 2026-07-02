"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface NewIncrementInput {
  employeeId: string;
  kind: "percent" | "absolute";
  percent: number | null;
  amount: number | null;
  reason: string;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Component split of a gross salary, mirroring the payroll model: Basic 65%,
 * Medical 10%, Travel 10%, "Other" 15%. Only Basic/Medical/Travel are stored on
 * salary_structures (the remaining 15% is implicit); the full four-way split is
 * captured in the increment's component_split for the audit trail.
 */
function splitComponents(gross: number) {
  return {
    basic: Number((gross * 0.65).toFixed(2)),
    medical: Number((gross * 0.1).toFixed(2)),
    travel: Number((gross * 0.1).toFixed(2)),
    other: Number((gross * 0.15).toFixed(2)),
  };
}

/**
 * Apply an increment. Percent lifts gross by `percent`%; absolute adds a flat
 * `amount`. Applying it rolls the salary_structure forward (closes the open row,
 * inserts a new open row at the new gross) so the next payroll run recalculates
 * from it, and records an `increments` audit row. RLS restricts writes to
 * super_admin / hr.
 */
export async function applyIncrementAction(input: NewIncrementInput): Promise<ActionResult> {
  // --- validate ---
  if (!input.employeeId) return { ok: false, error: "Select an employee." };
  if (input.kind === "percent") {
    if (!input.percent || input.percent <= 0) return { ok: false, error: "Enter a percentage greater than 0." };
  } else {
    if (!input.amount || input.amount <= 0) return { ok: false, error: "Enter an amount greater than 0." };
  }
  if (!input.reason?.trim()) return { ok: false, error: "Give a reason for the increment." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Read the employee's current open salary structure (the gross we lift from).
  const { data: current, error: curErr } = await supabase
    .from("salary_structures")
    .select("id, salary, basic, medical, travel")
    .eq("employee_id", input.employeeId)
    .is("effective_to", null)
    .maybeSingle();
  if (curErr) return { ok: false, error: curErr.message };
  if (!current) return { ok: false, error: "This employee has no active salary to increment." };

  const oldGross =
    Number(current.salary) ||
    (Number(current.basic) || 0) + (Number(current.medical) || 0) + (Number(current.travel) || 0);
  if (!oldGross) return { ok: false, error: "This employee's current salary is 0 — set one first." };

  const newGross =
    input.kind === "percent"
      ? Number((oldGross * (1 + Number(input.percent) / 100)).toFixed(2))
      : Number((oldGross + Number(input.amount)).toFixed(2));
  if (newGross <= oldGross) return { ok: false, error: "The new salary must be higher than the current one." };

  const split = splitComponents(newGross);
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // 1) Close the currently-open salary row.
  const { error: closeErr } = await supabase
    .from("salary_structures")
    .update({ effective_to: today })
    .eq("id", current.id);
  if (closeErr) {
    if (/row-level security|permission|privilege/i.test(closeErr.message)) {
      return { ok: false, error: "Only HR / Super Admin can apply increments." };
    }
    return { ok: false, error: closeErr.message };
  }

  // 2) Insert the new open salary row at the new gross. Medical carries the 10%
  //    slice; Basic absorbs the remainder (so basic + medical + travel == gross),
  //    matching the spec's basic = newGross − newGross×10/110 shape at travel = 0.
  const { error: insErr } = await supabase.from("salary_structures").insert({
    employee_id: input.employeeId,
    salary: newGross,
    basic: Number((newGross - (newGross * 10) / 110).toFixed(2)),
    medical: Number(((newGross * 10) / 110).toFixed(2)),
    travel: 0,
    effective_from: today,
  });
  if (insErr) {
    // Best-effort rollback of the close so we don't leave the employee with no open row.
    await supabase.from("salary_structures").update({ effective_to: null }).eq("id", current.id);
    return { ok: false, error: `Increment failed to apply: ${insErr.message}` };
  }

  // 3) Record the audit row.
  const { error: incErr } = await supabase.from("increments").insert({
    id: `inc-${randomUUID()}`,
    employee_id: input.employeeId,
    date: today,
    kind: input.kind,
    percent: input.kind === "percent" ? Number(input.percent) : null,
    old_salary: oldGross,
    new_salary: newGross,
    old_basic: Number(current.basic) || 0,
    new_basic: split.basic,
    reason: input.reason.trim(),
    by_user: user.email ?? user.id,
    component_split: split,
  });
  if (incErr) return { ok: false, error: `Salary updated but the audit record failed: ${incErr.message}` };

  revalidatePath("/increments");
  return { ok: true };
}

/**
 * Undo a wrongly-applied increment — the exact reverse of applyIncrementAction.
 * Guarded: only the employee's LATEST increment can be reverted, and only while
 * the open salary_structures row still carries the increment's new_salary (i.e.
 * nothing else has touched the salary since). Steps: delete the open structure
 * the increment created, re-open the structure it closed (effective_to back to
 * null, with best-effort rollback like apply has), then delete the increments
 * row. RLS restricts writes to super_admin / hr.
 */
export async function revertIncrementAction(incrementId: string): Promise<ActionResult> {
  if (!incrementId) return { ok: false, error: "Missing increment." };

  const supabase = await createSupabaseServerClient();

  // Load the increment being reverted.
  const { data: inc, error: incErr } = await supabase
    .from("increments")
    .select("id, employee_id, date, old_salary, new_salary")
    .eq("id", incrementId)
    .maybeSingle();
  if (incErr) return { ok: false, error: incErr.message };
  if (!inc) return { ok: false, error: "Increment not found." };

  // Guard 1: only the employee's latest increment can be reverted.
  const { data: latest, error: latestErr } = await supabase
    .from("increments")
    .select("id")
    .eq("employee_id", inc.employee_id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) return { ok: false, error: latestErr.message };
  if (latest?.id !== inc.id) {
    return { ok: false, error: "Only the latest increment for an employee can be reverted." };
  }

  // Guard 2: the open salary row must still be the one this increment created.
  const { data: open, error: openErr } = await supabase
    .from("salary_structures")
    .select("id, salary, basic, medical, travel, effective_from")
    .eq("employee_id", inc.employee_id)
    .is("effective_to", null)
    .maybeSingle();
  if (openErr) return { ok: false, error: openErr.message };
  if (!open) return { ok: false, error: "This employee has no active salary structure." };
  const openGross =
    Number(open.salary) ||
    (Number(open.basic) || 0) + (Number(open.medical) || 0) + (Number(open.travel) || 0);
  if (Math.abs(openGross - (Number(inc.new_salary) || 0)) > 0.01) {
    return { ok: false, error: "The salary has changed since this increment — it can no longer be reverted." };
  }

  // Find the structure the increment closed: its effective_to matches the day the
  // new (open) structure took effect.
  const { data: prevRows, error: prevErr } = await supabase
    .from("salary_structures")
    .select("id")
    .eq("employee_id", inc.employee_id)
    .eq("effective_to", open.effective_from)
    .order("effective_from", { ascending: false })
    .limit(1);
  if (prevErr) return { ok: false, error: prevErr.message };
  const prev = prevRows?.[0];
  if (!prev) return { ok: false, error: "Couldn't find the salary structure this increment replaced." };

  // 1) Delete the structure the increment created (frees the one-open-row slot).
  const { data: deleted, error: delErr } = await supabase
    .from("salary_structures")
    .delete()
    .eq("id", open.id)
    .select("id");
  if (delErr) {
    if (/row-level security|permission|privilege/i.test(delErr.message)) {
      return { ok: false, error: "Only HR / Super Admin can revert increments." };
    }
    return { ok: false, error: delErr.message };
  }
  // RLS filters silently — zero rows touched means the caller may not write here.
  if (!deleted || deleted.length === 0) return { ok: false, error: "Only HR / Super Admin can revert increments." };

  // 2) Re-open the previous structure.
  const { error: reopenErr } = await supabase
    .from("salary_structures")
    .update({ effective_to: null })
    .eq("id", prev.id);
  if (reopenErr) {
    // Best-effort rollback of the delete so the employee isn't left without an open row.
    await supabase.from("salary_structures").insert({
      employee_id: inc.employee_id,
      salary: open.salary,
      basic: open.basic,
      medical: open.medical,
      travel: open.travel,
      effective_from: open.effective_from,
    });
    return { ok: false, error: `Revert failed to re-open the previous salary: ${reopenErr.message}` };
  }

  // 3) Remove the increment audit row.
  const { error: rmErr } = await supabase.from("increments").delete().eq("id", inc.id);
  if (rmErr) {
    return { ok: false, error: `Salary reverted but the increment record could not be removed: ${rmErr.message}` };
  }

  revalidatePath("/increments");
  return { ok: true };
}
