"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, CheckCircle2, Plus } from "lucide-react";
import type { EmployeeOption, UnpaidLeaveRow } from "@/lib/db/adjustments";
import { createLeaveAction } from "@/app/(app)/leaves/actions";
import { formatMonthKey } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { BreakdownRow } from "@/components/ui/sheet";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { Sheet } from "@/components/ui/sheet";

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

export function LeavesClient({
  leaves,
  employees,
  canManage,
}: {
  leaves: UnpaidLeaveRow[];
  employees: EmployeeOption[];
  canManage: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const totalDays = leaves.reduce((s, l) => s + l.leaveDays, 0);
  const totalDeduction = leaves.reduce((s, l) => s + l.deduction, 0);

  const columns: Column<UnpaidLeaveRow>[] = [
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
    {
      key: "entity",
      header: "Co.",
      hideOnMobile: true,
      cell: (l) => (l.entityId ? <Badge tone="brand">{l.entityId}</Badge> : <span className="text-subtle">—</span>),
    },
    { key: "days", header: "Days", cell: (l) => <span className="text-sm font-medium text-foreground">{days(l.leaveDays)}</span> },
    { key: "gross", header: "Gross", align: "right", hideOnMobile: true, cell: (l) => <Money value={l.gross} /> },
    { key: "deduction", header: "Deduction", align: "right", cell: (l) => <span className="font-medium text-negative"><Money value={l.deduction} /></span> },
    { key: "month", header: "Month", hideOnMobile: true, cell: (l) => <span className="text-sm text-muted">{formatMonthKey(l.month)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Unpaid leaves"
        description="Manually logged unpaid days. Deduction = gross × days / 30 (half-days allowed)."
        actions={
          canManage ? (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Log leave
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Records" value={String(leaves.length)} icon={<CalendarOff className="h-4.5 w-4.5" />} />
        <StatCard label="Total days" value={days(totalDays)} />
        <StatCard label="Total deduction" value={<Money value={totalDeduction} compact />} />
      </div>

      <Card className="mt-4 overflow-hidden">
        <DataTable
          columns={columns}
          rows={leaves}
          getRowKey={(l) => l.id}
          dense
          emptyState={
            <EmptyState
              icon={<CalendarOff className="h-5 w-5" />}
              title="No unpaid leave logged"
              description={canManage ? "Log unpaid days to deduct them from a month's salary." : "Nothing here yet."}
            />
          }
          mobileCard={(l) => (
            <Card className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{l.employeeName}</p>
                  <p className="truncate text-xs text-subtle">
                    {days(l.leaveDays)} · {formatMonthKey(l.month)}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-negative">
                  <Money value={l.deduction} compact />
                </span>
              </div>
            </Card>
          )}
        />
      </Card>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Log unpaid leave" subtitle="Deducted this month" width={480}>
        <LeaveForm employees={employees} onClose={() => setAddOpen(false)} />
      </Sheet>
    </>
  );
}

function LeaveForm({ employees, onClose }: { employees: EmployeeOption[]; onClose: () => void }) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState("2026-05");
  const [leaveDays, setLeaveDays] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState(false);

  const emp = employees.find((e) => e.id === employeeId);
  const d = Number(leaveDays) || 0;
  const deduction = emp ? (emp.salary * d) / 30 : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await createLeaveAction({ employeeId, month, leaveDays: d, note: note || null });
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
        <p className="mt-3 text-base font-semibold text-foreground">Unpaid leave logged</p>
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
        <Field label="Unpaid days" hint="Half-days allowed (e.g. 2.5)" required>
          <Input
            type="number"
            min={0}
            step={0.5}
            value={leaveDays}
            onChange={(e) => setLeaveDays(e.target.value)}
            placeholder="0"
            required
          />
        </Field>
      </div>
      {emp && d > 0 ? (
        <div className="rounded-xl border border-border bg-surface-muted/50 p-3">
          <BreakdownRow label="Gross salary" value={<Money value={emp.salary} />} />
          <BreakdownRow label={`Deduction (${d} / 30)`} value={<span className="text-negative"><Money value={deduction} /></span>} emphasis />
        </div>
      ) : null}
      <Field label="Note">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional reason" />
      </Field>
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Logging…" : "Log leave"}
        </Button>
      </div>
    </form>
  );
}
