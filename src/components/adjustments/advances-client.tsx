"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, Wallet } from "lucide-react";
import type { AdvanceRow, EmployeeOption } from "@/lib/db/adjustments";
import { createAdvanceAction } from "@/app/(app)/advances/actions";
import { formatMonthKey } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { Sheet } from "@/components/ui/sheet";

export function AdvancesClient({
  advances,
  employees,
  canManage,
}: {
  advances: AdvanceRow[];
  employees: EmployeeOption[];
  canManage: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const total = advances.reduce((s, a) => s + a.amount, 0);

  const columns: Column<AdvanceRow>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (a) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{a.employeeName}</p>
          <p className="truncate text-xs text-subtle">{a.employeeCode ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "entity",
      header: "Co.",
      hideOnMobile: true,
      cell: (a) => (a.entityId ? <Badge tone="brand">{a.entityId}</Badge> : <span className="text-subtle">—</span>),
    },
    { key: "month", header: "Month", cell: (a) => <span className="text-sm text-muted">{formatMonthKey(a.month)}</span> },
    { key: "amount", header: "Amount", align: "right", cell: (a) => <Money value={a.amount} /> },
  ];

  return (
    <>
      <PageHeader
        title="Advances"
        description="A fixed amount deducted in full from that same month's salary — never scheduled."
        actions={
          canManage ? (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Log advance
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Advances" value={String(advances.length)} icon={<Wallet className="h-4.5 w-4.5" />} />
        <StatCard label="Total value" value={<Money value={total} compact />} hint="this book" />
      </div>

      <Card className="mt-4 overflow-hidden">
        <DataTable
          columns={columns}
          rows={advances}
          getRowKey={(a) => a.id}
          dense
          emptyState={
            <EmptyState
              icon={<Wallet className="h-5 w-5" />}
              title="No advances logged"
              description={canManage ? "Log an advance to deduct it from this month's salary." : "Nothing here yet."}
            />
          }
          mobileCard={(a) => (
            <Card className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{a.employeeName}</p>
                  <p className="truncate text-xs text-subtle">
                    {a.employeeCode} · {formatMonthKey(a.month)}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">
                  <Money value={a.amount} compact />
                </span>
              </div>
            </Card>
          )}
        />
      </Card>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Log advance" subtitle="Deducted this month" width={480}>
        <AdvanceForm employees={employees} onClose={() => setAddOpen(false)} />
      </Sheet>
    </>
  );
}

function AdvanceForm({ employees, onClose }: { employees: EmployeeOption[]; onClose: () => void }) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState("2026-05");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await createAdvanceAction({ employeeId, month, amount: Number(amount) || 0 });
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
        <p className="mt-3 text-base font-semibold text-foreground">Advance logged</p>
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
        <Field label="Month" required>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} required />
        </Field>
        <Field label="Amount (PKR)" required>
          <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Logging…" : "Log advance"}
        </Button>
      </div>
    </form>
  );
}
