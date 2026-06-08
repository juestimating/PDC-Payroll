"use client";

import { useMemo, useState } from "react";
import { Plus, TrendingDown } from "lucide-react";
import { useAppState } from "@/components/providers/app-state";
import { DEPARTMENTS, EMPLOYEES, departmentById, getDeductions } from "@/lib/data";
import type { DeductionRow } from "@/lib/data";
import { formatMonthKeyLong } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Money } from "@/components/ui/money";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { Sheet, BreakdownRow } from "@/components/ui/sheet";

const ACTIVE = EMPLOYEES.filter((e) => e.status === "active");

export default function DeductionsPage() {
  const { month } = useAppState();
  const [dept, setDept] = useState("all");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<DeductionRow | null>(null);

  const rows = getDeductions(month, { departmentId: dept === "all" ? undefined : dept });

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.total, 0);
    return { total, people: rows.length, avg: rows.length ? total / rows.length : 0 };
  }, [rows]);

  const columns: Column<DeductionRow>[] = [
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
    {
      key: "items",
      header: "Items",
      hideOnMobile: true,
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.items.map((it, i) => (
            <Badge key={i} tone="neutral">
              {it.label}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "count",
      header: "Count",
      align: "center",
      cell: (r) => <span className="tabular-nums text-muted">{r.items.length}</span>,
    },
    {
      key: "total",
      header: "Total deduction",
      align: "right",
      cell: (r) => (
        <span className="font-semibold text-negative">
          <Money value={r.total} />
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Deductions"
        description={`${formatMonthKeyLong(month)} · itemized deductions that reduce net pay`}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Add deduction
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
          label="Total deductions"
          value={<Money value={stats.total} compact />}
          hint="this month"
          icon={<TrendingDown className="h-4.5 w-4.5" />}
        />
        <StatCard label="Employees affected" value={String(stats.people)} />
        <StatCard label="Avg deduction" value={<Money value={stats.avg} compact />} />
      </div>

      <Card className="mt-4 overflow-hidden">
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.employee.id}
          onRowClick={(r) => setDetail(r)}
          dense
          emptyState={
            <EmptyState
              icon={<TrendingDown className="h-5 w-5" />}
              title="No deductions this month"
              description="Add a deduction and it instantly itemizes against the employee's net pay."
            />
          }
          mobileCard={(r) => (
            <Card interactive className="p-3">
              <div className="flex items-center gap-3">
                <Avatar name={r.employee.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{r.employee.name}</p>
                  <p className="truncate text-xs text-subtle">
                    {r.items.map((i) => i.label).join(", ")}
                  </p>
                </div>
                <span className="font-semibold text-negative">
                  <Money value={r.total} compact />
                </span>
              </div>
            </Card>
          )}
        />
      </Card>

      {/* Detail */}
      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Deduction detail"
        subtitle={detail?.employee.name ?? ""}
      >
        {detail ? (
          <div>
            {detail.items.map((it, i) => (
              <BreakdownRow
                key={i}
                label={it.label}
                sub={it.kind}
                value={
                  <span className="text-negative">
                    <Money value={it.amount} />
                  </span>
                }
              />
            ))}
            <BreakdownRow label="Total deductions" value={<Money value={detail.total} />} emphasis />
          </div>
        ) : null}
      </Sheet>

      {/* Add */}
      <Sheet open={open} onClose={() => setOpen(false)} title="Add deduction" subtitle={formatMonthKeyLong(month)}>
        <DeductionForm onClose={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function DeductionForm({ onClose }: { onClose: () => void }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="space-y-4"
    >
      <Field label="Employee" required>
        <Select>
          {ACTIVE.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} · {e.designation}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Description" required>
        <Input placeholder="e.g. Salary advance recovery" required />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Amount (PKR)" required>
          <Input type="number" min={0} placeholder="0" required />
        </Field>
        <Field label="Type">
          <Select defaultValue="advance">
            <option value="advance">Advance recovery</option>
            <option value="loan">Loan installment</option>
            <option value="absence">Unpaid leave</option>
            <option value="tax_adjustment">Tax adjustment</option>
            <option value="other">Other</option>
          </Select>
        </Field>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Add deduction</Button>
      </div>
      <p className="text-center text-xs text-subtle">UI preview — saving wires to Supabase later.</p>
    </form>
  );
}
