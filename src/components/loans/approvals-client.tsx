"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import type { PendingApproval } from "@/lib/db/loans";
import { decideApprovalAction } from "@/app/(app)/loans/actions";
import { formatMonthKey } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";

export function ApprovalsClient({ pending, canDecide }: { pending: PendingApproval[]; canDecide: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, approve: boolean) {
    setError(null);
    setBusy(id);
    const res = await decideApprovalAction({ approvalId: id, approve });
    setBusy(null);
    if (!res.ok) {
      setError(res.error ?? "Failed.");
      return;
    }
    router.refresh();
  }

  const totalPending = pending.reduce((s, p) => s + (p.amount ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Loan payments marked paid by HR — approve to clear them (you can't approve your own request)."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Pending" value={String(pending.length)} icon={<CheckCircle2 className="h-4.5 w-4.5" />} />
        <StatCard label="Value" value={<Money value={totalPending} compact />} />
      </div>

      {error ? (
        <div role="alert" className="mt-4 rounded-lg border border-negative/30 bg-negative-soft px-3 py-2 text-sm text-negative">
          {error}
        </div>
      ) : null}

      {pending.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="Nothing pending" description="You're all caught up." />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {pending.map((p) => (
            <Card key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {p.employeeName} <span className="text-xs text-subtle">{p.employeeCode ?? ""}</span>
                </p>
                <p className="text-sm text-muted">
                  Loan installment · {p.month ? formatMonthKey(p.month) : "—"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-base font-semibold tabular-nums">
                  <Money value={p.amount ?? 0} />
                </span>
                {canDecide ? (
                  <>
                    <Button variant="outline" size="sm" disabled={busy === p.id} onClick={() => decide(p.id, false)}>
                      Reject
                    </Button>
                    <Button size="sm" disabled={busy === p.id} onClick={() => decide(p.id, true)}>
                      {busy === p.id ? "…" : "Approve"}
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-subtle">Awaiting admin</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
