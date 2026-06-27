"use client";

import { useMemo, useState } from "react";
import { BadgePercent, Plus } from "lucide-react";
import { useAppState } from "@/components/providers/app-state";
import {
  DEPARTMENTS,
  EMPLOYEES,
  TEAMS,
  getCommissions,
  getEmployee,
  teamById,
} from "@/lib/data";
import type { CommissionRow } from "@/lib/data";
import { formatMonthKeyLong } from "@/lib/format";
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

const SALES_DEPT = DEPARTMENTS.find((d) => d.isSales);
const SALES_TEAMS = TEAMS.filter((t) => t.departmentId === SALES_DEPT?.id);
const SALES_EMPLOYEES = EMPLOYEES.filter(
  (e) => e.status === "active" && e.departmentKey === "sales",
);

export default function CommissionsPage() {
  const { month } = useAppState();
  const [team, setTeam] = useState("all");
  const [open, setOpen] = useState(false);

  const rows = getCommissions(month, { teamId: team === "all" ? undefined : team });

  const totals = useMemo(
    () => ({
      total: rows.reduce((s, r) => s + r.total, 0),
      newSales: rows.reduce((s, r) => s + r.newSales, 0),
      oldBonus: rows.reduce((s, r) => s + r.oldBonus, 0),
      additionalBonus: rows.reduce((s, r) => s + r.additionalBonus, 0),
      reps: rows.length,
    }),
    [rows],
  );

  const topBars = rows.slice(0, 6).map((r) => ({
    label: r.employee.name.split(" ")[0],
    value: r.total,
    color: SALES_DEPT?.color,
  }));

  const columns: Column<CommissionRow>[] = [
    {
      key: "employee",
      header: "Sales rep",
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={r.employee.name} size={32} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.employee.name}</p>
            <p className="truncate text-xs text-subtle">
              {teamById.get(r.employee.teamId)?.name ?? r.employee.designation}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "newSales",
      header: "New sales commission",
      align: "right",
      cell: (r) => <Money value={r.newSales} />,
    },
    {
      key: "oldBonus",
      header: "Old bonus",
      align: "right",
      cell: (r) => <Money value={r.oldBonus} />,
    },
    {
      key: "additionalBonus",
      header: "Additional bonus",
      align: "right",
      hideOnMobile: true,
      cell: (r) =>
        r.additionalBonus > 0 ? (
          <Money value={r.additionalBonus} />
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
    {
      key: "total",
      header: "Total commission",
      align: "right",
      cell: (r) => <Money value={r.total} className="font-semibold" />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Commissions"
        description={`${formatMonthKeyLong(month)} · sales team`}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Add commission
          </Button>
        }
      >
        <Select value={team} onChange={(e) => setTeam(e.target.value)} className="sm:w-56">
          <option value="all">All sales teams</option>
          {SALES_TEAMS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total commission"
          value={<Money value={totals.total} compact />}
          hint="flows into payroll"
          icon={<BadgePercent className="h-4.5 w-4.5" />}
        />
        <StatCard
          label="New sales commission"
          value={<Money value={totals.newSales} compact />}
          hint="this month"
        />
        <StatCard
          label="Old bonus"
          value={<Money value={totals.oldBonus} compact />}
          hint="carry-over deals"
        />
        <StatCard
          label="Additional bonus"
          value={<Money value={totals.additionalBonus} compact />}
          hint={`${totals.reps} rep${totals.reps === 1 ? "" : "s"} earning`}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Top earners" subtitle="Highest commission this month" />
          <CardBody>
            {topBars.length > 0 ? (
              <ComparisonBar data={topBars} />
            ) : (
              <p className="py-8 text-center text-sm text-muted">No commission recorded.</p>
            )}
          </CardBody>
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader title="Commission log" subtitle="New sales + old bonus + additional bonus" />
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(r) => r.employee.id}
            dense
            emptyState={
              <EmptyState
                icon={<BadgePercent className="h-5 w-5" />}
                title="No commission this month"
                description="Record commission for the sales team and it flows straight into payroll."
              />
            }
            mobileCard={(r) => (
              <Card className="p-3">
                <div className="flex items-center gap-3">
                  <Avatar name={r.employee.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{r.employee.name}</p>
                    <p className="text-xs text-subtle">
                      New <Money value={r.newSales} compact symbol={false} /> · Old bonus{" "}
                      <Money value={r.oldBonus} compact symbol={false} />
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">
                    <Money value={r.total} compact />
                  </span>
                </div>
              </Card>
            )}
          />
        </Card>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Add commission" subtitle={formatMonthKeyLong(month)}>
        <CommissionForm onClose={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function CommissionForm({ onClose }: { onClose: () => void }) {
  const [empId, setEmpId] = useState(SALES_EMPLOYEES[0]?.id ?? "");
  const [newSales, setNewSales] = useState<number | "">("");
  const [oldBonus, setOldBonus] = useState<number | "">("");
  const [additionalBonus, setAdditionalBonus] = useState<number | "">("");
  const emp = getEmployee(empId);

  const num = (v: number | "") => (typeof v === "number" ? v : 0);
  const total = num(newSales) + num(oldBonus) + num(additionalBonus);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="space-y-4"
    >
      <Field label="Sales rep" required>
        <Select value={empId} onChange={(e) => setEmpId(e.target.value)}>
          {SALES_EMPLOYEES.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} · {teamById.get(e.teamId)?.name ?? e.designation}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="New sales commission" required>
        <Input
          type="number"
          min={0}
          value={newSales}
          onChange={(e) => setNewSales(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="0"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Old bonus">
          <Input
            type="number"
            min={0}
            value={oldBonus}
            onChange={(e) => setOldBonus(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="0"
          />
        </Field>
        <Field label="Additional bonus">
          <Input
            type="number"
            min={0}
            value={additionalBonus}
            onChange={(e) => setAdditionalBonus(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="0"
          />
        </Field>
      </div>

      <div className="rounded-xl border border-border bg-surface-muted p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">{emp ? emp.name : "Sales rep"}</span>
          <span className="text-muted">{teamById.get(emp?.teamId ?? "")?.name ?? ""}</span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          <span className="text-sm font-semibold">Total commission</span>
          <span className="text-lg font-bold tabular-nums text-brand-700">
            <Money value={total} />
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Add commission</Button>
      </div>
      <p className="text-center text-xs text-subtle">UI preview — calculation wires to Supabase later.</p>
    </form>
  );
}
