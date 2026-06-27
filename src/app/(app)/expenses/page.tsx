"use client";

import { useMemo, useState } from "react";
import { CreditCard, Repeat } from "lucide-react";
import { useAppState } from "@/components/providers/app-state";
import { DEPARTMENTS, departmentById, expenseTotals, expenseTrend, getExpenses } from "@/lib/data";
import type { ExpenseItem } from "@/lib/data";
import { formatMonthKeyLong, formatMonthShort, formatPKRMillions } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { Bar } from "@/components/ui/progress";
import { Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Sheet, BreakdownRow } from "@/components/ui/sheet";
import { ArrowUpRight } from "lucide-react";
import { CHART, Donut, TrendArea } from "@/components/charts";

export default function ExpensesPage() {
  const { month } = useAppState();
  const [dept, setDept] = useState("all");
  const [category, setCategory] = useState("all");
  const [drillDept, setDrillDept] = useState<string | null>(null);

  const tot = expenseTotals(month);
  const items = getExpenses(month, {
    departmentId: dept === "all" ? undefined : dept,
    category: category === "all" ? undefined : category,
  });

  const trend = expenseTrend();
  const trendData = trend.map((t) => ({ label: formatMonthShort(t.month), value: t.total }));
  const idx = trend.findIndex((t) => t.month === month);
  const prev = idx > 0 ? trend[idx - 1].total : null;
  const deltaPct = prev ? ((tot.total - prev) / prev) * 100 : null;

  const categories = useMemo(() => tot.byCategory.map((c) => c.category), [tot]);
  const maxDept = Math.max(...tot.byDepartment.map((d) => d.total), 1);
  const donut = tot.byDepartment.map((d) => ({ label: d.name, value: d.total, color: d.color }));
  const largest = tot.byDepartment[0];

  const columns: Column<ExpenseItem>[] = [
    {
      key: "label",
      header: "Expense",
      cell: (e) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{e.label}</p>
          <p className="truncate text-xs text-subtle">{e.vendor ?? e.category}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      hideOnMobile: true,
      cell: (e) => <span className="text-sm text-muted">{e.category}</span>,
    },
    {
      key: "department",
      header: "Department",
      hideOnMobile: true,
      cell: (e) => {
        const d = departmentById.get(e.departmentId);
        return (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d?.color }} />
            {d?.name}
          </span>
        );
      },
    },
    {
      key: "type",
      header: "Type",
      align: "center",
      cell: (e) =>
        e.recurring ? (
          <Badge tone="info">
            <Repeat className="h-3 w-3" />
            Recurring
          </Badge>
        ) : (
          <Badge tone="neutral">Variable</Badge>
        ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (e) => <Money value={e.amount} className="font-semibold" />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Expenses"
        description={`${formatMonthKeyLong(month)} · org-wide spend, recurring and variable`}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={dept} onChange={(e) => setDept(e.target.value)} className="sm:w-52">
            <option value="all">All departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-44">
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total expenses"
          value={<Money value={tot.total} compact />}
          delta={deltaPct}
          deltaGoodWhen="down"
          hint="vs last month"
          icon={<CreditCard className="h-4.5 w-4.5" />}
        />
        <StatCard
          label="Recurring"
          value={<Money value={tot.recurring} compact />}
          hint="auto-posted monthly"
          icon={<Repeat className="h-4.5 w-4.5" />}
        />
        <StatCard label="Variable" value={<Money value={tot.variable} compact />} hint="one-off this month" />
        <StatCard
          label="Largest department"
          value={largest ? <Money value={largest.total} compact /> : "—"}
          hint={largest?.name}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Expense trend" subtitle="Spend by month" />
          <CardBody>
            <TrendArea data={trendData} dataKey="value" name="Expenses" color={CHART.accent} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="By department" subtitle="Click to drill in" />
          <CardBody>
            <Donut data={donut} centerValue={formatPKRMillions(tot.total)} centerLabel="Total" />
            <div className="mt-3 space-y-1">
              {tot.byDepartment.map((d) => (
                <button
                  key={d.departmentId}
                  onClick={() => setDrillDept(d.departmentId)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-muted"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="flex-1 truncate text-sm text-muted">{d.name}</span>
                  <span className="text-sm font-medium tabular-nums">
                    <Money value={d.total} compact />
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-subtle" />
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader title="Expense detail" subtitle={`${items.length} line items`} />
        <DataTable
          columns={columns}
          rows={items}
          getRowKey={(e) => e.id}
          dense
          mobileCard={(e) => (
            <Card className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{e.label}</p>
                  <p className="truncate text-xs text-subtle">
                    {departmentById.get(e.departmentId)?.name} · {e.category}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">
                  <Money value={e.amount} compact />
                </span>
              </div>
            </Card>
          )}
        />
      </Card>

      <Sheet
        open={!!drillDept}
        onClose={() => setDrillDept(null)}
        title={drillDept ? (departmentById.get(drillDept)?.name ?? "Department") : ""}
        subtitle={`${formatMonthKeyLong(month)} · expenses`}
      >
        {drillDept ? <DeptExpenseDetail month={month} departmentId={drillDept} /> : null}
      </Sheet>
    </>
  );
}

function DeptExpenseDetail({ month, departmentId }: { month: string; departmentId: string }) {
  const items = getExpenses(month, { departmentId });
  const total = items.reduce((s, e) => s + e.amount, 0);
  return (
    <div>
      {items.map((e) => (
        <BreakdownRow
          key={e.id}
          label={e.label}
          sub={`${e.category}${e.recurring ? " · recurring" : ""}`}
          value={<Money value={e.amount} />}
        />
      ))}
      <BreakdownRow label="Department total" value={<Money value={total} />} emphasis />
    </div>
  );
}

