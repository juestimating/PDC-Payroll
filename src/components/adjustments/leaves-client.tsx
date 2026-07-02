"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import type { EmployeeOption, UnpaidLeaveRow } from "@/lib/db/adjustments";
import { createLeaveAction, deleteLeaveAction, updateLeaveAction } from "@/app/(app)/leaves/actions";
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

type Drill = "records" | "days" | "deduction" | null;

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
  const [detail, setDetail] = useState<UnpaidLeaveRow | null>(null);
  const [drill, setDrill] = useState<Drill>(null);
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

  const drillTitle = drill === "days" ? "Total days" : drill === "deduction" ? "Total deduction" : "All records";

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
        <StatCard
          label="Records"
          value={String(leaves.length)}
          icon={<CalendarOff className="h-4.5 w-4.5" />}
          onClick={() => setDrill("records")}
        />
        <StatCard label="Total days" value={days(totalDays)} onClick={() => setDrill("days")} />
        <StatCard label="Total deduction" value={<Money value={totalDeduction} compact />} onClick={() => setDrill("deduction")} />
      </div>

      <Card className="mt-4 overflow-hidden">
        <DataTable
          columns={columns}
          rows={leaves}
          getRowKey={(l) => l.id}
          onRowClick={(l) => setDetail(l)}
          dense
          emptyState={
            <EmptyState
              icon={<CalendarOff className="h-5 w-5" />}
              title="No unpaid leave logged"
              description={canManage ? "Log unpaid days to deduct them from a month's salary." : "Nothing here yet."}
            />
          }
          mobileCard={(l) => (
            <Card interactive className="p-3">
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

      {/* Row drill-down: detail + edit + delete */}
      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Unpaid leave detail"
        subtitle={detail?.employeeName ?? ""}
        width={480}
      >
        {detail ? (
          <LeaveDetail key={detail.id} leave={detail} canManage={canManage} onClose={() => setDetail(null)} />
        ) : null}
      </Sheet>

      {/* Card drill-downs */}
      <Sheet
        open={!!drill}
        onClose={() => setDrill(null)}
        title={drillTitle}
        subtitle={`${leaves.length} record${leaves.length === 1 ? "" : "s"}`}
        width={480}
      >
        <div>
          {leaves.map((l) => (
            <BreakdownRow
              key={l.id}
              label={l.employeeName}
              sub={`${l.employeeCode ?? "—"} · ${formatMonthKey(l.month)}${drill === "deduction" ? ` · ${days(l.leaveDays)}` : ""}`}
              value={
                drill === "days" ? (
                  <span className="tabular-nums">{days(l.leaveDays)}</span>
                ) : (
                  <span className="text-negative">
                    <Money value={l.deduction} />
                  </span>
                )
              }
            />
          ))}
          <BreakdownRow
            label="Total"
            value={
              drill === "days" ? (
                <span className="tabular-nums">{days(totalDays)}</span>
              ) : (
                <span className="text-negative">
                  <Money value={totalDeduction} />
                </span>
              )
            }
            emphasis
          />
        </div>
      </Sheet>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Log unpaid leave" subtitle="Deducted this month" width={480}>
        <LeaveForm employees={employees} onClose={() => setAddOpen(false)} />
      </Sheet>
    </>
  );
}

function LeaveDetail({
  leave,
  canManage,
  onClose,
}: {
  leave: UnpaidLeaveRow;
  canManage: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [leaveDays, setLeaveDays] = useState(String(leave.leaveDays));
  const [note, setNote] = useState(leave.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const d = Number(leaveDays) || 0;
  const newDeduction = (leave.gross * d) / 30;

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await updateLeaveAction(leave.id, { leaveDays: d, note: note || null });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
    onClose();
  }

  async function doDelete() {
    setError(null);
    setBusy(true);
    const res = await deleteLeaveAction(leave.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div role="alert" className="rounded-lg border border-negative/30 bg-negative-soft px-3 py-2 text-sm text-negative">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-surface-muted/50 p-3">
        <BreakdownRow label="Employee" value={<span className="font-medium">{leave.employeeName}</span>} sub={leave.employeeCode ?? undefined} />
        <BreakdownRow label="Company" value={leave.entityId ? <Badge tone="brand">{leave.entityId}</Badge> : "—"} />
        <BreakdownRow label="Month" value={formatMonthKey(leave.month)} />
        <BreakdownRow label="Unpaid days" value={days(leave.leaveDays)} />
        <BreakdownRow label="Gross salary" value={<Money value={leave.gross} />} />
        {leave.note ? <BreakdownRow label="Note" value={<span className="max-w-56 text-right text-sm">{leave.note}</span>} /> : null}
        <BreakdownRow
          label={`Deduction (${leave.leaveDays} / 30)`}
          value={<span className="text-negative"><Money value={leave.deduction} /></span>}
          emphasis
        />
      </div>

      {canManage && editing ? (
        <form onSubmit={saveEdit} className="space-y-4">
          <Field label="Unpaid days" hint="Half-days allowed (e.g. 2.5)" required>
            <Input type="number" min={0.5} step={0.5} value={leaveDays} onChange={(e) => setLeaveDays(e.target.value)} required />
          </Field>
          <Field label="Note">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional reason" />
          </Field>
          {d > 0 ? (
            <div className="rounded-xl border border-border bg-surface-muted/50 p-3">
              <BreakdownRow
                label={`New deduction (${d} / 30)`}
                value={<span className="text-negative"><Money value={newDeduction} /></span>}
                emphasis
              />
            </div>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      ) : null}

      {canManage && confirmDelete ? (
        <div className="rounded-xl border border-negative/30 bg-negative-soft p-3">
          <p className="text-sm font-medium text-negative">Delete this leave record?</p>
          <p className="mt-0.5 text-xs text-negative/80">
            Its deduction disappears from {formatMonthKey(leave.month)}&rsquo;s payroll immediately.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <Button size="sm" variant="danger" disabled={busy} onClick={doDelete}>
              {busy ? "Deleting…" : "Yes, delete"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : null}

      {canManage && !editing && !confirmDelete ? (
        <div className="flex items-center gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            Edit days / note
          </Button>
          <Button variant="ghost" className="text-negative hover:text-negative" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      ) : null}

      <p className="text-xs text-subtle">
        Employee and month can&rsquo;t be changed — to move a record to another month, delete it and log it again.
      </p>
    </div>
  );
}

function LeaveForm({ employees, onClose }: { employees: EmployeeOption[]; onClose: () => void }) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
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
