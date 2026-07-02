"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface NewLoanInput {
  employeeId: string;
  principal: number;
  firstInstallmentDate: string; // YYYY-MM-DD (calendar)
  repaymentKind: "fixed_amount" | "fixed_percent";
  installmentAmount: number | null;
  installmentPercent: number | null;
  note: string | null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function createLoanAction(input: NewLoanInput): Promise<ActionResult> {
  if (!input.employeeId) return { ok: false, error: "Select an employee." };
  if (!input.principal || input.principal <= 0) return { ok: false, error: "Loan amount must be greater than 0." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.firstInstallmentDate)) {
    return { ok: false, error: "Pick a first-installment date." };
  }
  const perMonth =
    input.repaymentKind === "fixed_amount"
      ? Number(input.installmentAmount)
      : (input.principal * Number(input.installmentPercent)) / 100;
  if (!perMonth || perMonth <= 0) return { ok: false, error: "Installment amount / percent must be greater than 0." };

  const supabase = await createSupabaseServerClient();
  const { data: emp } = await supabase.from("employees").select("entity_id").eq("id", input.employeeId).single();

  const { data: loan, error } = await supabase
    .from("loans")
    .insert({
      employee_id: input.employeeId,
      entity_id: emp?.entity_id ?? null,
      principal: input.principal,
      start_date: input.firstInstallmentDate,
      repayment_kind: input.repaymentKind,
      installment_amount: input.repaymentKind === "fixed_amount" ? input.installmentAmount : null,
      installment_percent: input.repaymentKind === "fixed_percent" ? input.installmentPercent : null,
      status: "active",
      outstanding: input.principal,
      note: input.note?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    if (/row-level security|permission|privilege/i.test(error.message)) {
      return { ok: false, error: "Only HR / Super Admin can log loans." };
    }
    return { ok: false, error: error.message };
  }

  // Build the schedule: each installment = perMonth until the balance clears; the
  // last one is the remainder, so Σ installments == principal exactly.
  let [y, m] = input.firstInstallmentDate.split("-").map(Number);
  let remaining = input.principal;
  let seq = 1;
  const rows: Array<Record<string, unknown>> = [];
  while (remaining > 0.005 && seq <= 600) {
    const amt = Math.min(perMonth, remaining);
    rows.push({
      loan_id: loan!.id,
      employee_id: input.employeeId,
      month: `${y}-${String(m).padStart(2, "0")}`,
      seq,
      amount: Number(amt.toFixed(4)),
      status: "scheduled",
    });
    remaining -= amt;
    seq += 1;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  const { error: iErr } = await supabase.from("loan_installments").insert(rows);
  if (iErr) return { ok: false, error: `Loan created but the schedule failed: ${iErr.message}` };

  revalidatePath("/loans");
  return { ok: true };
}

export interface UpdateLoanInput {
  /** undefined = leave the note unchanged; null / "" = clear it. */
  note?: string | null;
  /** New per-month amount — only for fixed_amount loans. */
  installmentAmount?: number | null;
  /** New per-month % of the loan — only for fixed_percent loans. */
  installmentPercent?: number | null;
}

/**
 * Edit a loan. The note is always editable. The installment SIZE (amount or %,
 * matching the loan's existing repayment kind — the kind itself can't change)
 * may be edited for the remaining schedule only: the still-'scheduled'
 * installments are deleted and regenerated from loans.outstanding with the same
 * math as createLoanAction. Paid installments and approvals are never touched.
 */
export async function updateLoanAction(loanId: string, input: UpdateLoanInput): Promise<ActionResult> {
  if (!loanId) return { ok: false, error: "Missing loan." };

  const supabase = await createSupabaseServerClient();

  const { data: loan, error: loanErr } = await supabase
    .from("loans")
    .select("id, employee_id, principal, outstanding, repayment_kind, status")
    .eq("id", loanId)
    .maybeSingle();
  if (loanErr) return { ok: false, error: loanErr.message };
  if (!loan) return { ok: false, error: "Loan not found." };

  const wantsAmount = input.installmentAmount != null;
  const wantsPercent = input.installmentPercent != null;

  const loanPatch: Record<string, unknown> = {};
  if (input.note !== undefined) loanPatch.note = input.note?.trim() || null;

  if (wantsAmount || wantsPercent) {
    // The repayment kind is fixed at creation — only its size can change.
    if (wantsAmount && loan.repayment_kind !== "fixed_amount") {
      return { ok: false, error: "This loan repays a fixed % of the loan — the repayment kind can't be changed." };
    }
    if (wantsPercent && loan.repayment_kind !== "fixed_percent") {
      return { ok: false, error: "This loan repays a fixed amount — the repayment kind can't be changed." };
    }
    if (loan.status !== "active") {
      return { ok: false, error: "Only an active loan's repayment can be edited." };
    }

    const principal = Number(loan.principal) || 0;
    const outstanding = Number(loan.outstanding) || 0;
    const perMonth = wantsAmount
      ? Number(input.installmentAmount)
      : (principal * Number(input.installmentPercent)) / 100;
    if (!perMonth || perMonth <= 0) {
      return { ok: false, error: "Installment amount / percent must be greater than 0." };
    }
    if (outstanding <= 0.005) return { ok: false, error: "Nothing is outstanding on this loan." };

    const { data: insts, error: instErr } = await supabase
      .from("loan_installments")
      .select("id, month, seq, amount, status")
      .eq("loan_id", loanId)
      .order("seq");
    if (instErr) return { ok: false, error: instErr.message };
    if ((insts ?? []).some((i) => i.status === "pending_approval")) {
      return { ok: false, error: "A payment is awaiting Admin approval — decide it first, then edit the repayment." };
    }
    const scheduled = (insts ?? []).filter((i) => i.status === "scheduled" && i.month);
    if (scheduled.length === 0) {
      return { ok: false, error: "This loan has no scheduled installments left to reschedule." };
    }

    // Regenerate from the first still-scheduled month with createLoanAction's math:
    // perMonth until the outstanding balance clears; the last one is the remainder.
    const firstMonth = scheduled.map((i) => i.month as string).sort()[0];
    let [y, m] = firstMonth.split("-").map(Number);
    let seq = Math.min(...scheduled.map((i) => Number(i.seq) || 1));
    let remaining = outstanding;
    const rows: Array<Record<string, unknown>> = [];
    while (remaining > 0.005 && rows.length < 600) {
      const amt = Math.min(perMonth, remaining);
      rows.push({
        loan_id: loanId,
        employee_id: loan.employee_id,
        month: `${y}-${String(m).padStart(2, "0")}`,
        seq,
        amount: Number(amt.toFixed(4)),
        status: "scheduled",
      });
      remaining -= amt;
      seq += 1;
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }

    // Swap the remaining schedule: drop the old scheduled rows, insert the new ones.
    const { data: deleted, error: delErr } = await supabase
      .from("loan_installments")
      .delete()
      .eq("loan_id", loanId)
      .eq("status", "scheduled")
      .select("id");
    if (delErr) {
      if (/row-level security|permission|privilege/i.test(delErr.message)) {
        return { ok: false, error: "Only HR / Super Admin can edit loans." };
      }
      if (/foreign key|violates/i.test(delErr.message)) {
        return { ok: false, error: "Some installments are tied to approval records and can't be rescheduled." };
      }
      return { ok: false, error: delErr.message };
    }
    // RLS filters silently — zero rows touched means the caller may not write here.
    if (!deleted || deleted.length === 0) return { ok: false, error: "Only HR / Super Admin can edit loans." };

    const { error: insErr } = await supabase.from("loan_installments").insert(rows);
    if (insErr) {
      // Best-effort rollback: restore the schedule we just removed (same ids, so
      // any approval rows that referenced them keep pointing at real rows).
      await supabase.from("loan_installments").insert(
        scheduled.map((i) => ({
          id: i.id,
          loan_id: loanId,
          employee_id: loan.employee_id,
          month: i.month,
          seq: i.seq,
          amount: i.amount,
          status: "scheduled",
        })),
      );
      return { ok: false, error: `Reschedule failed: ${insErr.message}` };
    }

    if (wantsAmount) loanPatch.installment_amount = Number(Number(input.installmentAmount).toFixed(2));
    else loanPatch.installment_percent = Number(input.installmentPercent);
  }

  if (Object.keys(loanPatch).length > 0) {
    const { data: upd, error: updErr } = await supabase.from("loans").update(loanPatch).eq("id", loanId).select("id");
    if (updErr) {
      if (/row-level security|permission|privilege/i.test(updErr.message)) {
        return { ok: false, error: "Only HR / Super Admin can edit loans." };
      }
      return { ok: false, error: updErr.message };
    }
    if (!upd || upd.length === 0) return { ok: false, error: "Only HR / Super Admin can edit loans." };
  }

  revalidatePath("/loans");
  return { ok: true };
}

/**
 * Cancel an active loan: the loan goes to 'cancelled' and its remaining
 * 'scheduled' installments are cancelled with it. Paid installments and the
 * approval trail are left untouched (the 0012 triggers guard paid flips).
 */
export async function cancelLoanAction(loanId: string): Promise<ActionResult> {
  if (!loanId) return { ok: false, error: "Missing loan." };

  const supabase = await createSupabaseServerClient();

  const { data: upd, error } = await supabase
    .from("loans")
    .update({ status: "cancelled" })
    .eq("id", loanId)
    .eq("status", "active")
    .select("id");
  if (error) {
    if (/row-level security|permission|privilege/i.test(error.message)) {
      return { ok: false, error: "Only HR / Super Admin can cancel loans." };
    }
    return { ok: false, error: error.message };
  }
  // RLS filters silently — zero rows also covers "loan is not active any more".
  if (!upd || upd.length === 0) {
    return { ok: false, error: "Only HR / Super Admin can cancel an active loan." };
  }

  const { error: instErr } = await supabase
    .from("loan_installments")
    .update({ status: "cancelled" })
    .eq("loan_id", loanId)
    .eq("status", "scheduled");
  if (instErr) {
    return { ok: false, error: `Loan cancelled but its schedule could not be updated: ${instErr.message}` };
  }

  revalidatePath("/loans");
  return { ok: true };
}

/** HR marks an installment paid — this only REQUESTS approval (admin must sign off). */
export async function requestInstallmentPaidAction(input: {
  installmentId: string;
  loanId: string;
}): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("loan_payment_approvals").insert({
    loan_id: input.loanId,
    installment_id: input.installmentId,
    requested_by: user.id,
    status: "pending",
  });
  if (error) {
    if (/row-level security|permission|privilege/i.test(error.message)) {
      return { ok: false, error: "You can't request this payment." };
    }
    if (/duplicate|unique/i.test(error.message)) {
      return { ok: false, error: "A request is already pending for this installment." };
    }
    return { ok: false, error: error.message };
  }

  await supabase.from("loan_installments").update({ status: "pending_approval" }).eq("id", input.installmentId);
  revalidatePath("/loans");
  revalidatePath("/approvals");
  return { ok: true };
}

/** Admin/Super Admin decides. Approving clears the installment via a DB trigger. */
export async function decideApprovalAction(input: {
  approvalId: string;
  approve: boolean;
  note?: string;
}): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("loan_payment_approvals")
    .update({
      status: input.approve ? "approved" : "rejected",
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      decision_note: input.note ?? null,
    })
    .eq("id", input.approvalId);

  if (error) {
    if (/row-level security|permission|privilege|check|violates/i.test(error.message)) {
      return { ok: false, error: "Only Admin / Super Admin can decide — and never your own request." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/loans");
  revalidatePath("/approvals");
  return { ok: true };
}
