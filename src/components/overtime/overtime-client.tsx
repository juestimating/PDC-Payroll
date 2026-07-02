"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, Plus, Timer, Trash2 } from "lucide-react";
import type { OvertimeRow, EstimationEmployee } from "@/lib/db/overtime";
import { createOvertimeAction, deleteOvertimeAction, updateOvertimeAction } from "@/app/(app)/overtime/actions";
import { formatMonthKey, formatNumber } from "@/lib/format";
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

const OT_BASIC_FACTOR = 0.65;
const STANDARD_HOURS = 176;
const DAY_TYPES = [
  { value: "normal", label: "Normal day", multiplier: 1.5 },
  { value: "govt", label: "Govt holiday", multiplier: 2 },
  { value: "eid", label: "Eid", multiplier: 2.5 },
] as const;
const MULTIPLIER_BY_TYPE: Record<string, number> = { normal: 1.5, govt: 2, eid: 2.5 };
const DAY_TYPE_LABEL: Record<string, string> = { normal: "Normal day", govt: "Govt holiday", eid: "Eid" };

type Drill = "entries" | "total" | null;

export function OvertimeClient({
  overtime,
  employees,
  month,
  canManage,
}: {
  overtime: OvertimeRow[];
  employees: EstimationEmployee[];
  month: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<OvertimeRow | null>(null);
  const [drill, setDrill] = useState<Drill>(null);
  const total = overtime.reduce((s, r) => s + r.subTotal, 0);

  const columns: Column<OvertimeRow>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{r.employeeName}</p>
          <p className="truncate text-xs text-subtle">{r.employeeCode ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "entity",
      header: "Co.",
      hideOnMobile: true,
      cell: (r) => (r.entityId ? <Badge tone="brand">{r.entityId}</Badge> : <span className="text-subtle">—</span>),
    },
    {
      key: "hours",
      header: "Hours",
      align: "right",
      cell: (r) => <span className="tabular-nums">{formatNumber(r.totalHours)}</span>,
    },
    {
      key: "rate",
      header: "Rate / hr",
      align: "right",
      hideOnMobile: true,
      cell: (r) => <Money value={r.ratePerHour} />,
    },
    {
      key: "mult",
      header: "×",
      align: "center",
      hideOnMobile: true,
      cell: (r) => <span className="tabular-nums text-muted">{r.multiplier}×</span>,
    },
    {
      key: "amount",
      header: "Overtime pay",
      align: "right",
      cell: (r) => <Money value={r.subTotal} className="font-semibold" />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Overtime"
        description="Estimation team · rate = basic ÷ (22×8) · 1.5× normal / 2× govt / 2.5× Eid"
        actions={
          <>
            <Input
              type="month"
              value={month}
              onChange={(e) => {
                if (e.target.value) router.push(`/overtime?month=${e.target.value}`);
              }}
              className="w-40"
              aria-label="Month"
            />
            {canManage ? (
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" />
                Log overtime
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Entries"
          value={String(overtime.length)}
          hint={formatMonthKey(month)}
          icon={<Timer className="h-4.5 w-4.5" />}
          onClick={() => setDrill("entries")}
        />
        <StatCard
          label="Total OT pay"
          value={<Money value={total} compact />}
          hint="flows into payroll"
          onClick={() => setDrill("total")}
        />
      </div>

      <Card className="mt-4 overflow-hidden">
        <DataTable
          columns={columns}
          rows={overtime}
          getRowKey={(r) => r.id}
          onRowClick={(r) => setDetail(r)}
          dense
          emptyState={
            <EmptyState
              icon={<Timer className="h-5 w-5" />}
              title="No overtime logged"
              description={
                canManage
                  ? "Log overtime for an estimation-team member and it flows into payroll."
                  : "Nothing here yet."
              }
            />
          }
          mobileCard={(r) => (
            <Card interactive className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.employeeName}</p>
                  <p className="truncate text-xs text-subtle">
                    {r.employeeCode} · {formatNumber(r.totalHours)} hrs · {r.multiplier}×
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">
                  <Money value={r.subTotal} compact />
                </span>
              </div>
            </Card>
          )}
        />
      </Card>

      {/* Row drill-down: derivation + edit + delete */}
      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Overtime detail"
        subtitle={detail ? `${detail.employeeName} · ${formatMonthKey(detail.month)}` : ""}
        width={480}
      >
        {detail ? (
          <OvertimeDetail key={detail.id} row={detail} employees={employees} canManage={canManage} onClose={() => setDetail(null)} />
        ) : null}
      </Sheet>

      {/* Card drill-downs */}
      <Sheet
        open={!!drill}
        onClose={() => setDrill(null)}
        title={drill === "total" ? "Total OT pay" : "Overtime entries"}
        subtitle={formatMonthKey(month)}
        width={480}
      >
        <div>
          {overtime.map((r) => (
            <BreakdownRow
              key={r.id}
              label={r.employeeName}
              sub={`${formatNumber(r.totalHours)} hrs × ${r.multiplier}×`}
              value={<Money value={r.subTotal} />}
            />
          ))}
          <BreakdownRow label="Total" value={<Money value={total} />} emphasis />
        </div>
      </Sheet>

      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Log overtime"
        subtitle="Estimation team"
        width={480}
      >
        <OvertimeForm employees={employees} month={month} onClose={() => setAddOpen(false)} />
      </Sheet>
    </>
  );
}

function OvertimeDetail({
  row,
  employees,
  canManage,
  onClose,
}: {
  row: OvertimeRow;
  employees: EstimationEmployee[];
  canManage: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [weekdayHours, setWeekdayHours] = useState(String(row.weekdayHours));
  const [weekendHours, setWeekendHours] = useState(String(row.weekendHours));
  const [dayType, setDayType] = useState<"normal" | "govt" | "eid">(
    row.dayType === "govt" || row.dayType === "eid" ? row.dayType : "normal",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Live preview of the recompute the server will run (from the CURRENT open salary).
  const preview = useMemo(() => {
    const emp = employees.find((e) => e.id === row.employeeId);
    const gross = emp?.salary || row.grossBasis;
    const ratePerHour = gross ? (gross * OT_BASIC_FACTOR) / STANDARD_HOURS : 0;
    const totalHours = (Number(weekdayHours) || 0) + (Number(weekendHours) || 0);
    const multiplier = MULTIPLIER_BY_TYPE[dayType] ?? 1.5;
    const amount = totalHours * ratePerHour * multiplier;
    return { ratePerHour, totalHours, multiplier, amount: amount + row.bonus };
  }, [employees, row, weekdayHours, weekendHours, dayType]);

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await updateOvertimeAction(row.id, {
      weekdayHours: Number(weekdayHours) || 0,
      weekendHours: Number(weekendHours) || 0,
      dayType,
    });
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
    const res = await deleteOvertimeAction(row.id);
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
        <BreakdownRow label="Gross basis" sub="open salary when logged" value={<Money value={row.grossBasis} />} />
        <BreakdownRow label="Rate / hour" sub="gross × 0.65 ÷ 176" value={<Money value={row.ratePerHour} />} />
        <BreakdownRow label="Weekday hours" value={<span className="tabular-nums">{formatNumber(row.weekdayHours)}</span>} />
        <BreakdownRow label="Weekend hours" value={<span className="tabular-nums">{formatNumber(row.weekendHours)}</span>} />
        <BreakdownRow
          label="Total hours"
          sub={`${row.multiplier}× · ${DAY_TYPE_LABEL[row.dayType] ?? row.dayType}`}
          value={<span className="tabular-nums">{formatNumber(row.totalHours)}</span>}
        />
        <BreakdownRow label="Overtime amount" sub="hours × rate × multiplier" value={<Money value={row.amount} />} />
        {row.bonus > 0 ? <BreakdownRow label="Bonus" value={<Money value={row.bonus} />} /> : null}
        <BreakdownRow label="Overtime pay" value={<Money value={row.subTotal} />} emphasis />
      </div>

      {canManage && editing ? (
        <form onSubmit={saveEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Weekday hours" required>
              <Input type="number" min={0} step="0.5" value={weekdayHours} onChange={(e) => setWeekdayHours(e.target.value)} />
            </Field>
            <Field label="Weekend hours" required>
              <Input type="number" min={0} step="0.5" value={weekendHours} onChange={(e) => setWeekendHours(e.target.value)} />
            </Field>
          </div>
          <Field label="Day type" required>
            <Select value={dayType} onChange={(e) => setDayType(e.target.value as "normal" | "govt" | "eid")}>
              {DAY_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label} ({d.multiplier}×)
                </option>
              ))}
            </Select>
          </Field>
          <div className="rounded-xl border border-border bg-surface-muted p-4">
            <BreakdownRow label="Rate / hour" sub="from the current open salary" value={<Money value={preview.ratePerHour} />} />
            <BreakdownRow
              label="Total hours"
              sub={`${preview.multiplier}× multiplier`}
              value={<span className="tabular-nums">{formatNumber(preview.totalHours)}</span>}
            />
            <BreakdownRow label="New overtime pay" value={<Money value={preview.amount} />} emphasis />
          </div>
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
          <p className="text-sm font-medium text-negative">Delete this overtime entry?</p>
          <p className="mt-0.5 text-xs text-negative/80">
            Its pay disappears from {formatMonthKey(row.month)}&rsquo;s payroll immediately.
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
            Edit hours
          </Button>
          <Button variant="ghost" className="text-negative hover:text-negative" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      ) : null}

      <p className="text-xs text-subtle">
        Editing recomputes the rate from the employee&rsquo;s current open salary. Employee and month can&rsquo;t be
        changed — to move an entry, delete it and log it again.
      </p>
    </div>
  );
}

function OvertimeForm({
  employees,
  month,
  onClose,
}: {
  employees: EstimationEmployee[];
  month: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [formMonth, setFormMonth] = useState(month);
  const [weekdayHours, setWeekdayHours] = useState("");
  const [weekendHours, setWeekendHours] = useState("");
  const [dayType, setDayType] = useState<"normal" | "govt" | "eid">("normal");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState(false);

  const preview = useMemo(() => {
    const emp = employees.find((e) => e.id === employeeId);
    const gross = emp?.salary ?? 0;
    const ratePerHour = gross ? (gross * OT_BASIC_FACTOR) / STANDARD_HOURS : 0;
    const totalHours = (Number(weekdayHours) || 0) + (Number(weekendHours) || 0);
    const multiplier = MULTIPLIER_BY_TYPE[dayType] ?? 1.5;
    const amount = totalHours * ratePerHour * multiplier;
    return { gross, ratePerHour, totalHours, multiplier, amount };
  }, [employees, employeeId, weekdayHours, weekendHours, dayType]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await createOvertimeAction({
      employeeId,
      month: formMonth,
      weekdayHours: Number(weekdayHours) || 0,
      weekendHours: Number(weekendHours) || 0,
      dayType,
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
        <p className="mt-3 text-base font-semibold text-foreground">Overtime logged</p>
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
          <Input type="month" value={formMonth} onChange={(e) => setFormMonth(e.target.value)} required />
        </Field>
        <Field label="Day type" required>
          <Select value={dayType} onChange={(e) => setDayType(e.target.value as "normal" | "govt" | "eid")}>
            {DAY_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label} ({d.multiplier}×)
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Weekday hours" required>
          <Input
            type="number"
            min={0}
            step="0.5"
            value={weekdayHours}
            onChange={(e) => setWeekdayHours(e.target.value)}
            placeholder="0"
          />
        </Field>
        <Field label="Weekend hours" required>
          <Input
            type="number"
            min={0}
            step="0.5"
            value={weekendHours}
            onChange={(e) => setWeekendHours(e.target.value)}
            placeholder="0"
          />
        </Field>
      </div>

      <div className="rounded-xl border border-border bg-surface-muted p-4">
        <BreakdownRow label="Rate / hour" sub="gross × 0.65 ÷ 176" value={<Money value={preview.ratePerHour} />} />
        <BreakdownRow
          label="Total hours"
          sub={`${preview.multiplier}× multiplier`}
          value={<span className="tabular-nums">{formatNumber(preview.totalHours)}</span>}
        />
        <BreakdownRow label="Overtime pay" value={<Money value={preview.amount} />} emphasis />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Logging…" : "Log overtime"}
        </Button>
      </div>
    </form>
  );
}
