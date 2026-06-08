"use client";

import { useMemo, useState } from "react";
import { Plus, TrendingUp } from "lucide-react";
import { DEPARTMENTS, EMPLOYEES, departmentById, getEmployee, getIncrements } from "@/lib/data";
import type { Employee, IncrementEvent } from "@/lib/data";
import { formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Money } from "@/components/ui/money";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { Sheet } from "@/components/ui/sheet";

type IncRow = IncrementEvent & { employee: Employee };
const ACTIVE = EMPLOYEES.filter((e) => e.status === "active");

export default function IncrementsPage() {
  const [dept, setDept] = useState("all");
  const [open, setOpen] = useState(false);

  const all = getIncrements();
  const rows = dept === "all" ? all : all.filter((i) => i.employee.departmentId === dept);

  const stats = useMemo(() => {
    const impact = rows.reduce((s, r) => s + (r.newBasic - r.oldBasic), 0);
    const avgPct =
      rows.length > 0
        ? rows.reduce((s, r) => s + ((r.newBasic - r.oldBasic) / r.oldBasic) * 100, 0) / rows.length
        : 0;
    return { count: rows.length, impact, avgPct };
  }, [rows]);

  const columns: Column<IncRow>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={r.employee.name} size={32} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.employee.name}</p>
            <p className="truncate text-xs text-subtle">{r.employee.designation}</p>
          </div>
        </div>
      ),
    },
    { key: "date", header: "Effective", align: "left", hideOnMobile: true, cell: (r) => <span className="text-sm text-muted">{r.date}</span> },
    {
      key: "change",
      header: "Basic salary",
      align: "right",
      cell: (r) => (
        <span className="text-sm tabular-nums text-muted">
          <Money value={r.oldBasic} compact symbol={false} /> →{" "}
          <span className="font-medium text-foreground">
            <Money value={r.newBasic} compact symbol={false} />
          </span>
        </span>
      ),
    },
    {
      key: "delta",
      header: "Increase",
      align: "right",
      cell: (r) => {
        const d = r.newBasic - r.oldBasic;
        const pct = r.oldBasic ? (d / r.oldBasic) * 100 : 0;
        return (
          <span className="inline-flex items-center gap-1.5">
            <Money value={d} compact signed className="font-semibold text-positive" />
            <span className="rounded bg-positive-soft px-1 text-[10px] font-semibold text-positive">
              +{pct.toFixed(0)}%
            </span>
          </span>
        );
      },
    },
    { key: "reason", header: "Reason", hideOnMobile: true, cell: (r) => <span className="text-sm text-muted">{r.reason}</span> },
    { key: "by", header: "By", hideOnMobile: true, cell: (r) => <span className="text-sm text-subtle">{r.byUser}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Increments"
        description="Every change to basic salary, with full history — when, why, and by whom."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Add increment
          </Button>
        }
      >
        <Select value={dept} onChange={(e) => setDept(e.target.value)} className="sm:w-56">
          <option value="all">All departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </PageHeader>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-3">
        <StatCard
          label="Increments"
          value={String(stats.count)}
          hint="in the last 12 months"
          icon={<TrendingUp className="h-4.5 w-4.5" />}
        />
        <StatCard label="Avg increase" value={formatPercent(stats.avgPct)} hint="of basic salary" />
        <StatCard
          label="Monthly impact"
          value={<Money value={stats.impact} compact />}
          hint="added to basic payroll"
        />
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-positive-soft bg-positive-soft px-4 py-2.5 text-sm text-positive">
        <TrendingUp className="h-4 w-4" />
        Increments reflect live: the next payroll run recalculates from the new basic automatically.
      </div>

      <Card className="mt-4 overflow-hidden">
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.id}
          dense
          emptyState={
            <EmptyState
              icon={<TrendingUp className="h-5 w-5" />}
              title="No increments yet"
              description="Add an increment and it instantly reflects in the payroll sheet."
            />
          }
          mobileCard={(r) => {
            const d = r.newBasic - r.oldBasic;
            const pct = r.oldBasic ? (d / r.oldBasic) * 100 : 0;
            return (
              <Card className="p-3">
                <div className="flex items-center gap-3">
                  <Avatar name={r.employee.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{r.employee.name}</p>
                    <p className="truncate text-xs text-subtle">{r.reason}</p>
                  </div>
                  <div className="text-right">
                    <Money value={d} compact signed className="font-semibold text-positive" />
                    <p className="text-xs text-positive">+{pct.toFixed(0)}%</p>
                  </div>
                </div>
              </Card>
            );
          }}
        />
      </Card>

      <Sheet open={open} onClose={() => setOpen(false)} title="Add increment" subtitle="Change basic salary">
        <IncrementForm onClose={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function IncrementForm({ onClose }: { onClose: () => void }) {
  const [empId, setEmpId] = useState(ACTIVE[0]?.id ?? "");
  const [newBasic, setNewBasic] = useState<number | "">("");
  const emp = getEmployee(empId);
  const cur = emp?.salary.basic ?? 0;
  const delta = typeof newBasic === "number" ? newBasic - cur : 0;
  const pct = cur ? (delta / cur) * 100 : 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="space-y-4"
    >
      <Field label="Employee" required>
        <Select value={empId} onChange={(e) => setEmpId(e.target.value)}>
          {ACTIVE.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} · {e.designation}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Current basic">
          <Input value={cur} disabled />
        </Field>
        <Field label="New basic" required>
          <Input
            type="number"
            value={newBasic}
            onChange={(e) => setNewBasic(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="0"
          />
        </Field>
      </div>

      <Field label="Reason" required>
        <Input placeholder="e.g. Annual review increment" required />
      </Field>

      {delta !== 0 ? (
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted p-4">
          <span className="text-sm text-muted">Change</span>
          <span className="text-lg font-bold tabular-nums text-positive">
            <Money value={delta} signed /> ({pct > 0 ? "+" : ""}
            {pct.toFixed(1)}%)
          </span>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Apply increment</Button>
      </div>
      <p className="text-center text-xs text-subtle">UI preview — history & recalculation wire to Supabase later.</p>
    </form>
  );
}
