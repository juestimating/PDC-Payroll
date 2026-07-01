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
