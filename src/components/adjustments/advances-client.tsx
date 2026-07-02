"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import type { AdvanceRow, EmployeeOption } from "@/lib/db/adjustments";
import { createAdvanceAction, deleteAdvanceAction, updateAdvanceAction } from "@/app/(app)/advances/actions";
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
import { Sheet, BreakdownRow } from "@/components/ui/sheet";

type Drill = "count" | "total" | null;

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
  const [detail, setDetail] = useState<AdvanceRow | null>(null);
  const [drill, setDrill] = useState<Drill>(null);
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
        <StatCard
          label="Advances"
          value={String(advances.length)}
          icon={<Wallet className="h-4.5 w-4.5" />}
          onClick={() => setDrill("count")}
        />
        <StatCard label="Total value" value={<Money value={total} compact />} hint="this book" onClick={() => setDrill("total")} />
      </div>

      <Card className="mt-4 overflow-hidden">
        <DataTable
          columns={columns}
          rows={advances}
          getRowKey={(a) => a.id}
          onRowClick={(a) => setDetail(a)}
          dense
          emptyState={
            <EmptyState
              icon={<Wallet className="h-5 w-5" />}
              title="No advances logged"
              description={canManage ? "Log an advance to deduct it from this month's salary." : "Nothing here yet."}
            />
          }
          mobileCard={(a) => (
            <Card interactive className="p-3">
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

      {/* Row drill-down: detail + edit + delete */}
      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Advance detail"
        subtitle={detail?.employeeName ?? ""}
        width={480}
      >
        {detail ? (
          <AdvanceDetail key={detail.id} advance={detail} canManage={canManage} onClose={() => setDetail(null)} />
        ) : null}
      </Sheet>

      {/* Card drill-downs */}
      <Sheet
        open={!!drill}
        onClose={() => setDrill(null)}
        title={drill === "total" ? "Total value" : "All advances"}
        subtitle={`${advances.length} advance${advances.length === 1 ? "" : "s"}`}
        width={480}
      >
        <div>
          {advances.map((a) => (
            <BreakdownRow
              key={a.id}
              label={a.employeeName}
              sub={`${a.employeeCode ?? "—"} · ${formatMonthKey(a.month)}`}
              value={<Money value={a.amount} />}
            />
          ))}
          <BreakdownRow label="Total" value={<Money value={total} />} emphasis />
        </div>
      </Sheet>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Log advance" subtitle="Deducted this month" width={480}>
        <AdvanceForm employees={employees} onClose={() => setAddOpen(false)} />
      </Sheet>
    </>
  );
}

function AdvanceDetail({
  advance,
  canManage,
  onClose,
}: {
  advance: AdvanceRow;
  canManage: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [amount, setAmount] = useState(String(advance.amount));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await updateAdvanceAction(advance.id, { amount: Number(amount) || 0 });
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
    const res = await deleteAdvanceAction(advance.id);
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
        <BreakdownRow label="Employee" value={<span className="font-medium">{advance.employeeName}</span>} sub={advance.employeeCode ?? undefined} />
        <BreakdownRow label="Company" value={advance.entityId ? <Badge tone="brand">{advance.entityId}</Badge> : "—"} />
        <BreakdownRow label="Month" value={formatMonthKey(advance.month)} />
        <BreakdownRow label="Amount" value={<Money value={advance.amount} />} emphasis />
      </div>

      {canManage && editing ? (
        <form onSubmit={saveEdit} className="space-y-4">
          <Field label="Amount (PKR)" required>
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </Field>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save amount"}
            </Button>
          </div>
        </form>
      ) : null}

      {canManage && confirmDelete ? (
        <div className="rounded-xl border border-negative/30 bg-negative-soft p-3">
          <p className="text-sm font-medium text-negative">Delete this advance?</p>
          <p className="mt-0.5 text-xs text-negative/80">
            It stops being deducted from {formatMonthKey(advance.month)}&rsquo;s payroll immediately.
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
            Edit amount
          </Button>
          <Button variant="ghost" className="text-negative hover:text-negative" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      ) : null}

      <p className="text-xs text-subtle">
        Employee, company and month can&rsquo;t be changed — to move an advance to another month, delete it and log it
        again.
      </p>
    </div>
  );
}

function AdvanceForm({ employees, onClose }: { employees: EmployeeOption[]; onClose: () => void }) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
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
