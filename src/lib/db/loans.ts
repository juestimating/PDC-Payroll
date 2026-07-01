// =============================================================================
// Server-side loan reads from Supabase (RLS-gated). Loans + their installment
// schedule, and the pending payment-approval queue.
// =============================================================================
import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface LoanInstallment {
  id: string;
  month: string;
  seq: number;
  amount: number;
  status: string;
}

export interface LoanRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  entityId: string | null;
  principal: number;
  outstanding: number;
  startDate: string | null;
  repaymentKind: string;
  installmentAmount: number | null;
  installmentPercent: number | null;
  status: string;
  note: string | null;
  installments: LoanInstallment[];
}

export interface PendingApproval {
  id: string;
  loanId: string;
  installmentId: string | null;
  employeeName: string;
  employeeCode: string | null;
  month: string | null;
  amount: number | null;
}

export async function listLoans(): Promise<LoanRow[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: loans, error }, { data: insts }] = await Promise.all([
    supabase
      .from("loans")
      .select(
        "id, employee_id, entity_id, principal, outstanding, start_date, repayment_kind, installment_amount, installment_percent, status, note, employees(name, employee_code)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("loan_installments").select("id, loan_id, month, seq, amount, status").order("seq"),
  ]);
  if (error) throw error;

  const byLoan = new Map<string, LoanInstallment[]>();
  for (const i of insts ?? []) {
    const arr = byLoan.get(i.loan_id) ?? [];
    arr.push({ id: i.id, month: i.month, seq: i.seq, amount: Number(i.amount) || 0, status: i.status });
    byLoan.set(i.loan_id, arr);
  }

  return (loans ?? []).map((r: any) => {
    const emp = (Array.isArray(r.employees) ? r.employees[0] : r.employees) as
      | { name: string; employee_code: string | null }
      | null;
    return {
      id: r.id,
      employeeId: r.employee_id,
      employeeName: emp?.name ?? "—",
      employeeCode: emp?.employee_code ?? null,
      entityId: r.entity_id,
      principal: Number(r.principal) || 0,
      outstanding: Number(r.outstanding) || 0,
      startDate: r.start_date,
      repaymentKind: r.repayment_kind,
      installmentAmount: r.installment_amount != null ? Number(r.installment_amount) : null,
      installmentPercent: r.installment_percent != null ? Number(r.installment_percent) : null,
      status: r.status,
      note: r.note,
      installments: (byLoan.get(r.id) ?? []).sort((a, b) => a.seq - b.seq),
    };
  });
}

export async function listPendingApprovals(): Promise<PendingApproval[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("loan_payment_approvals")
    .select(
      "id, loan_id, installment_id, status, loans(employees(name, employee_code)), loan_installments(month, amount)",
    )
    .eq("status", "pending")
    .order("requested_at", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((r: any) => {
    const loan = Array.isArray(r.loans) ? r.loans[0] : r.loans;
    const emp = loan ? (Array.isArray(loan.employees) ? loan.employees[0] : loan.employees) : null;
    const inst = Array.isArray(r.loan_installments) ? r.loan_installments[0] : r.loan_installments;
    return {
      id: r.id,
      loanId: r.loan_id,
      installmentId: r.installment_id,
      employeeName: emp?.name ?? "—",
      employeeCode: emp?.employee_code ?? null,
      month: inst?.month ?? null,
      amount: inst ? Number(inst.amount) || 0 : null,
    };
  });
}
