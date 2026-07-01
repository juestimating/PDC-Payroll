"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, Timer } from "lucide-react";
import type { OvertimeRow, EstimationEmployee } from "@/lib/db/overtime";
import { createOvertimeAction } from "@/app/(app)/overtime/actions";
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
  const [addOpen, setAddOpen] = useState(false);
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
          canManage ? (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Log overtime
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Entries"
          value={String(overtime.length)}
          hint={formatMonthKey(month)}
          icon={<Timer className="h-4.5 w-4.5" />}
        />
        <StatCard label="Total OT pay" value={<Money value={total} compact />} hint="flows into payroll" />
      </div>

      <Card className="mt-4 overflow-hidden">
        <DataTable
          columns={columns}
          rows={overtime}
          getRowKey={(r) => r.id}
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
            <Card className="p-3">
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
