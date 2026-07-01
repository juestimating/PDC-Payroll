"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, HandCoins, Plus } from "lucide-react";
import type { LoanRow, LoanInstallment } from "@/lib/db/loans";
import type { EmployeeOption } from "@/lib/db/adjustments";
import { createLoanAction, requestInstallmentPaidAction } from "@/app/(app)/loans/actions";
import { formatMonthKey } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { Bar } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { BreakdownRow, Sheet } from "@/components/ui/sheet";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";

const INSTALLMENT_TONE: Record<string, "positive" | "warning" | "neutral" | "info"> = {
  paid: "positive",
  pending_approval: "warning",
  scheduled: "neutral",
  skipped: "neutral",
  cancelled: "neutral",
};

export function LoansClient({
  loans,
  employees,
  canManage,
}: {
  loans: LoanRow[];
  employees: EmployeeOption[];
  canManage: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<LoanRow | null>(null);

  const active = loans.filter((l) => l.status === "active");
  const outstanding = active.reduce((s, l) => s + l.outstanding, 0);
  const lent = loans.reduce((s, l) => s + l.principal, 0);

  const columns: Column<LoanRow>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (l) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{l.employeeName}</p>
          <p className="truncate text-xs text-subtle">{l.employeeCode ?? "—"}</p>
        </div>
      ),
    },
    { key: "principal", header: "Loan", align: "right", cell: (l) => <Money value={l.principal} /> },
    {
      key: "outstanding",
      header: "Remaining",
      cell: (l) => (
        <div className="min-w-28">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="tabular-nums text-muted">
              <Money value={l.outstanding} compact />
            </span>
          </div>
          <Bar value={l.principal - l.outstanding} max={l.principal || 1} />
        </div>
      ),
    },
    {
      key: "per",
      header: "Per month",
      hideOnMobile: true,
      cell: (l) => (
        <span className="text-sm text-muted">
          {l.repaymentKind === "fixed_percent" ? `${l.installmentPercent}% of loan` : ""}
          <Money value={l.installmentAmount ?? (l.principal * (l.installmentPercent ?? 0)) / 100} compact />
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      cell: (l) => <Badge tone={l.status === "cleared" ? "positive" : "info"}>{l.status}</Badge>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Loans"
        description="Approved staff loans, auto-scheduled. Marking a payment needs Admin approval before it clears."
        actions={
          canManage ? (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Log loan
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Active loans" value={String(active.length)} icon={<HandCoins className="h-4.5 w-4.5" />} />
        <StatCard label="Outstanding" value={<Money value={outstanding} compact />} />
        <StatCard label="Total lent" value={<Money value={lent} compact />} />
      </div>

      <Card className="mt-4 overflow-hidden">
        <DataTable
          columns={columns}
          rows={loans}
          getRowKey={(l) => l.id}
          onRowClick={(l) => setDetail(l)}
          dense
          emptyState={
            <EmptyState
              icon={<HandCoins className="h-5 w-5" />}
              title="No loans"
              description={canManage ? "Log an approved loan to build its repayment schedule." : "Nothing here yet."}
            />
          }
          mobileCard={(l) => (
            <Card interactive className="p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate font-medium text-foreground">{l.employeeName}</p>
                <Badge tone={l.status === "cleared" ? "positive" : "info"}>{l.status}</Badge>
              </div>
              <div className="mt-2">
                <Bar value={l.principal - l.outstanding} max={l.principal || 1} />
                <p className="mt-1 text-xs text-subtle">
                  <Money value={l.outstanding} compact /> of <Money value={l.principal} compact /> left
                </p>
              </div>
            </Card>
          )}
        />
      </Card>

      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Repayment schedule"
        subtitle={detail?.employeeName ?? ""}
        width={520}
      >
        {detail ? <LoanSchedule loan={detail} canManage={canManage} onDone={() => setDetail(null)} /> : null}
      </Sheet>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Log approved loan" subtitle="Auto-scheduled" width={520}>
        <LoanForm employees={employees} onClose={() => setAddOpen(false)} />
      </Sheet>
    </>
  );
}

function LoanSchedule({ loan, canManage, onDone }: { loan: LoanRow; canManage: boolean; onDone: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function markPaid(inst: LoanInstallment) {
    setError(null);
    setBusy(inst.id);
    const res = await requestInstallmentPaidAction({ installmentId: inst.id, loanId: loan.id });
    setBusy(null);
    if (!res.ok) {
      setError(res.error ?? "Failed.");
      return;
    }
    router.refresh();
    onDone();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface-muted/50 p-3">
        <BreakdownRow label="Loan amount" value={<Money value={loan.principal} />} />
        <BreakdownRow label="Outstanding" value={<Money value={loan.outstanding} />} emphasis />
      </div>
      {error ? (
        <div role="alert" className="rounded-lg border border-negative/30 bg-negative-soft px-3 py-2 text-sm text-negative">
          {error}
        </div>
      ) : null}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">Installments</p>
        <div className="divide-y divide-border">
          {loan.installments.map((inst) => (
            <div key={inst.id} className="flex items-center justify-between gap-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">{formatMonthKey(inst.month)}</p>
                <p className="text-xs text-subtle">#{inst.seq}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">
                  <Money value={inst.amount} />
                </span>
                <Badge tone={INSTALLMENT_TONE[inst.status] ?? "neutral"}>{inst.status.replace("_", " ")}</Badge>
                {canManage && inst.status === "scheduled" ? (
                  <Button size="sm" variant="outline" disabled={busy === inst.id} onClick={() => markPaid(inst)}>
                    {busy === inst.id ? "…" : "Mark paid"}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-subtle">
          &ldquo;Mark paid&rdquo; sends the payment to Admin for approval — it only clears once approved.
        </p>
      </div>
    </div>
  );
}

function LoanForm({ employees, onClose }: { employees: EmployeeOption[]; onClose: () => void }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [employeeId, setEmployeeId] = useState("");
  const [principal, setPrincipal] = useState("");
  const [firstDate, setFirstDate] = useState(today);
  const [kind, setKind] = useState<"fixed_amount" | "fixed_percent">("fixed_amount");
  const [amount, setAmount] = useState("");
  const [percent, setPercent] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState(false);

  const p = Number(principal) || 0;
  const perMonth = kind === "fixed_amount" ? Number(amount) || 0 : (p * (Number(percent) || 0)) / 100;
  const n = perMonth > 0 && p > 0 ? Math.ceil(p / perMonth) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await createLoanAction({
      employeeId,
      principal: p,
      firstInstallmentDate: firstDate,
      repaymentKind: kind,
      installmentAmount: kind === "fixed_amount" ? Number(amount) || 0 : null,
      installmentPercent: kind === "fixed_percent" ? Number(percent) || 0 : null,
      note: note || null,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setOk(true);
    router.refresh();
    setTimeout(onClose, 900);
  }

  if (ok) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle2 className="h-12 w-12 text-positive" />
        <p className="mt-3 text-base font-semibold text-foreground">Loan logged &amp; scheduled</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? (
        <div role="alert" className="rounded-lg border border-negative/30 bg-negative-soft px-3 py-2 text-sm text-negative">
          {error}
        </div>
      ) : null}
      <Field label="Employee" required>
        <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
          <option value="">Select employee…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.code} · {e.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Loan amount (PKR)" required>
          <Input type="number" min={1} value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="0" required />
        </Field>
        <Field label="First installment date" required>
          <Input type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} required />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Repayment" required>
          <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="fixed_amount">Fixed amount / month</option>
            <option value="fixed_percent">Fixed % of loan / month</option>
          </Select>
        </Field>
        {kind === "fixed_amount" ? (
          <Field label="Installment (PKR)" required>
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required />
          </Field>
        ) : (
          <Field label="Percent of loan / month" required>
            <Input type="number" min={0.1} step={0.1} value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="e.g. 20" required />
          </Field>
        )}
      </div>
      {n > 0 ? (
        <div className="rounded-xl border border-border bg-surface-muted/50 p-3">
          <BreakdownRow label="Per month" value={<Money value={perMonth} />} />
          <BreakdownRow label="Installments" value={<span className="font-semibold">{n}</span>} />
          <BreakdownRow label="Clears by" value={<span className="font-medium">{clearsBy(firstDate, n)}</span>} emphasis />
        </div>
      ) : null}
      <Field label="Note">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </Field>
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Log loan"}
        </Button>
      </div>
    </form>
  );
}

function clearsBy(startDate: string, n: number): string {
  const [y, m] = startDate.split("-").map(Number);
  const total = (m - 1) + (n - 1);
  const yy = y + Math.floor(total / 12);
  const mm = (total % 12) + 1;
  return formatMonthKey(`${yy}-${String(mm).padStart(2, "0")}`);
}
