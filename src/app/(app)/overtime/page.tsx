"use client";

import { useMemo, useState } from "react";
import { Plus, Timer } from "lucide-react";
import { useAppState } from "@/components/providers/app-state";
import { DEPARTMENTS, EMPLOYEES, departmentById, getEmployee, getOvertime } from "@/lib/data";
import type { OvertimeRow } from "@/lib/data";
import { formatMonthKeyLong, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Money } from "@/components/ui/money";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { Sheet } from "@/components/ui/sheet";
import { ComparisonBar } from "@/components/charts";

const TECH_DEPTS = DEPARTMENTS.filter((d) => d.isTechnical);
const TECH_EMPLOYEES = EMPLOYEES.filter(
  (e) => e.status === "active" && (e.departmentKey === "estimation" || e.departmentKey === "design"),
);

export default function OvertimePage() {
  const { month } = useAppState();
  const [dept, setDept] = useState("all");
  const [open, setOpen] = useState(false);

  const rows = getOvertime(month, { departmentId: dept === "all" ? undefined : dept });

  const totals = useMemo(
    () => ({
      amount: rows.reduce((s, r) => s + r.amount, 0),
      hours: rows.reduce((s, r) => s + r.hours, 0),
      people: rows.length,
    }),
    [rows],
  );

  const topBars = rows.slice(0, 6).map((r) => ({
    label: r.employee.name.split(" ")[0],
    value: r.amount,
    color: departmentById.get(r.employee.departmentId)?.color,
  }));

  const columns: Column<OvertimeRow>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={r.employee.name} size={32} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.employee.name}</p>
            <p className="truncate text-xs text-subtle">
              {departmentById.get(r.employee.departmentId)?.name}
            </p>
          </div>
        </div>
      ),
    },
    { key: "hours", header: "Hours", align: "right", cell: (r) => <span className="tabular-nums">{r.hours}</span> },
    {
      key: "rate",
      header: "Rate / hr",
      align: "right",
      hideOnMobile: true,
      cell: (r) => <Money value={r.ratePerHour} />,
    },
    {
      key: "days",
      header: "Working days",
      align: "center",
      hideOnMobile: true,
      cell: (r) => <span className="tabular-nums">{r.workingDays}</span>,
    },
    {
      key: "amount",
      header: "Overtime pay",
      align: "right",
      cell: (r) => <Money value={r.amount} className="font-semibold" />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Overtime"
        description={`${formatMonthKeyLong(month)} · technical teams (Estimation & Design)`}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Log overtime
          </Button>
        }
      >
        <Select value={dept} onChange={(e) => setDept(e.target.value)} className="sm:w-56">
          <option value="all">All technical departments</option>
          {TECH_DEPTS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Overtime pay"
          value={<Money value={totals.amount} compact />}
          hint="flows into payroll"
          icon={<Timer className="h-4.5 w-4.5" />}
        />
        <StatCard label="Total hours" value={formatNumber(totals.hours)} hint="this month" />
        <StatCard label="Employees" value={String(totals.people)} hint="logged overtime" />
        <StatCard
          label="Avg per employee"
          value={<Money value={totals.people ? totals.amount / totals.people : 0} compact />}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Top overtime" subtitle="Highest earners this month" />
          <CardBody>
            {topBars.length > 0 ? (
              <ComparisonBar data={topBars} />
            ) : (
              <p className="py-8 text-center text-sm text-muted">No overtime logged.</p>
            )}
          </CardBody>
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader title="Overtime log" subtitle="Hours × rate, with working days" />
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(r) => r.employee.id}
            dense
            emptyState={
              <EmptyState
                icon={<Timer className="h-5 w-5" />}
                title="No overtime this month"
                description="Log overtime for technical staff and it flows straight into payroll."
              />
            }
            mobileCard={(r) => (
              <Card className="p-3">
                <div className="flex items-center gap-3">
                  <Avatar name={r.employee.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{r.employee.name}</p>
                    <p className="text-xs text-subtle">
                      {r.hours} hrs · {r.workingDays} days
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">
                    <Money value={r.amount} compact />
                  </span>
                </div>
              </Card>
            )}
          />
        </Card>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Log overtime" subtitle={formatMonthKeyLong(month)}>
        <OvertimeForm onClose={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function OvertimeForm({ onClose }: { onClose: () => void }) {
  const [empId, setEmpId] = useState(TECH_EMPLOYEES[0]?.id ?? "");
  const [hours, setHours] = useState<number | "">("");
  const emp = getEmployee(empId);
  const rate = emp ? Math.round((emp.salary.basic / 176) * 1.5) : 0;
  const amount = typeof hours === "number" ? hours * rate : 0;

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
          {TECH_EMPLOYEES.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} · {e.designation}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Overtime hours" required>
          <Input
            type="number"
            min={0}
            value={hours}
            onChange={(e) => setHours(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="0"
          />
        </Field>
        <Field label="Working days">
          <Input type="number" defaultValue={24} />
        </Field>
      </div>

      <div className="rounded-xl border border-border bg-surface-muted p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Rate / hour (1.5× basic)</span>
          <span className="font-medium tabular-nums">
            <Money value={rate} />
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          <span className="text-sm font-semibold">Overtime pay</span>
          <span className="text-lg font-bold tabular-nums text-brand-700">
            <Money value={amount} />
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Log overtime</Button>
      </div>
      <p className="text-center text-xs text-subtle">UI preview — calculation wires to Supabase later.</p>
    </form>
  );
}
