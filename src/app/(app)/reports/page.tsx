"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useAppState } from "@/components/providers/app-state";
import { DEPARTMENTS, MONTHS, departmentTotals, monthlyTrend, orgTotals } from "@/lib/data";
import { formatMonthKey, formatMonthKeyLong, formatMonthShort } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Sheet, BreakdownRow } from "@/components/ui/sheet";
import { CHART, ComparisonBar, Donut, MultiTrend } from "@/components/charts";

type Scope = "month" | "ytd" | "12m";

const SHORT: Record<string, string> = {
  sales: "Sales",
  estimation: "Estimation",
  design: "Design",
  admin: "Admin & HR",
};

interface DeptAgg {
  departmentId: string;
  key: string;
  name: string;
  color: string;
  headcount: number;
  gross: number;
  tax: number;
  net: number;
  expenses: number;
  totalCost: number;
}

export default function ReportsPage() {
  const { month } = useAppState();
  const [scope, setScope] = useState<Scope>("month");
  const [drillDept, setDrillDept] = useState<string | null>(null);

  const year = month.slice(0, 4);
  const monthsInScope = useMemo(() => {
    if (scope === "12m") return MONTHS;
    if (scope === "ytd") return MONTHS.filter((m) => m.slice(0, 4) === year && m <= month);
    return [month];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, month]);

  const org = useMemo(() => {
    return monthsInScope.reduce(
      (a, m) => {
        const t = orgTotals(m);
        return {
          payrollCost: a.payrollCost + t.payrollCost,
          expenses: a.expenses + t.expenses,
          tax: a.tax + t.tax,
          net: a.net + t.net,
          totalCost: a.totalCost + t.totalCost,
        };
      },
      { payrollCost: 0, expenses: 0, tax: 0, net: 0, totalCost: 0 },
    );
  }, [monthsInScope]);

  const deptAgg: DeptAgg[] = useMemo(() => {
    const map = new Map<string, DeptAgg>();
    for (const m of monthsInScope) {
      for (const d of departmentTotals(m)) {
        const cur =
          map.get(d.departmentId) ??
          {
            departmentId: d.departmentId,
            key: d.key,
            name: d.name,
            color: d.color,
            headcount: 0,
            gross: 0,
            tax: 0,
            net: 0,
            expenses: 0,
            totalCost: 0,
          };
        cur.gross += d.gross;
        cur.tax += d.tax;
        cur.net += d.net;
        cur.expenses += d.expenses;
        cur.totalCost += d.totalCost;
        cur.headcount = d.headcount; // latest in scope
        map.set(d.departmentId, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.gross - a.gross);
  }, [monthsInScope]);

  const trend = monthlyTrend().map((t) => ({
    label: formatMonthShort(t.month),
    payrollCost: t.payrollCost,
    expenses: t.expenses,
    tax: t.tax,
  }));

  const deptBars = deptAgg.map((d) => ({ label: SHORT[d.key] ?? d.name, value: d.gross, color: d.color }));
  const split = [
    { label: "Payroll", value: org.payrollCost, color: CHART.brand },
    { label: "Expenses", value: org.expenses, color: CHART.accent },
  ];

  const byMonthRows = [...monthsInScope].reverse().map((m) => {
    const t = orgTotals(m);
    return { month: m, payroll: t.payrollCost, expenses: t.expenses, tax: t.tax, total: t.totalCost };
  });

  const scopeLabel =
    scope === "12m" ? "Last 12 months" : scope === "ytd" ? `${year} to date` : formatMonthKeyLong(month);

  const deptColumns: Column<DeptAgg>[] = [
    {
      key: "dept",
      header: "Department",
      cell: (d) => (
        <span className="inline-flex items-center gap-2 font-medium text-foreground">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
          {d.name}
        </span>
      ),
    },
    { key: "head", header: "People", align: "center", hideOnMobile: true, cell: (d) => <span className="tabular-nums text-muted">{d.headcount}</span> },
    { key: "gross", header: "Payroll", align: "right", cell: (d) => <Money value={d.gross} compact /> },
    { key: "tax", header: "Tax", align: "right", hideOnMobile: true, cell: (d) => <span className="text-negative"><Money value={d.tax} compact /></span> },
    { key: "expenses", header: "Expenses", align: "right", hideOnMobile: true, cell: (d) => <Money value={d.expenses} compact /> },
    { key: "total", header: "Total cost", align: "right", cell: (d) => <Money value={d.totalCost} compact className="font-semibold" /> },
  ];

  return (
    <>
      <PageHeader
        title="Reports"
        description="Summaries and trends by month, year, department, and whole org."
        actions={
          <Button variant="outline">
            <Download className="h-4 w-4" />
            Export
          </Button>
        }
      >
        <Segmented<Scope>
          value={scope}
          onChange={setScope}
          options={[
            { value: "month", label: "This month" },
            { value: "ytd", label: "Year to date" },
            { value: "12m", label: "12 months" },
          ]}
        />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Payroll cost" value={<Money value={org.payrollCost} compact />} hint={scopeLabel} accent={CHART.brand} />
        <StatCard label="Expenses" value={<Money value={org.expenses} compact />} hint={scopeLabel} accent={CHART.accent} />
        <StatCard label="Tax" value={<Money value={org.tax} compact />} hint={scopeLabel} accent={CHART.info} />
        <StatCard label="Total cost" value={<Money value={org.totalCost} compact />} hint={scopeLabel} accent={CHART.violet} />
      </div>

      <Card className="mt-4">
        <CardHeader title="Payroll, expenses & tax" subtitle="12-month trend across the org" />
        <CardBody>
          <MultiTrend
            data={trend}
            height={300}
            series={[
              { key: "payrollCost", name: "Payroll", color: CHART.brand },
              { key: "expenses", name: "Expenses", color: CHART.accent },
              { key: "tax", name: "Tax", color: CHART.info },
            ]}
          />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {[
              { label: "Payroll", color: CHART.brand },
              { label: "Expenses", color: CHART.accent },
              { label: "Tax", color: CHART.info },
            ].map((i) => (
              <div key={i.label} className="flex items-center gap-1.5 text-xs text-muted">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: i.color }} />
                {i.label}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Department comparison" subtitle={`Payroll · ${scopeLabel}`} />
          <CardBody>
            <ComparisonBar data={deptBars} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Cost split" subtitle={scopeLabel} />
          <CardBody>
            <Donut data={split} centerValue={pkrCr(org.totalCost)} centerLabel="Total" />
            <div className="mt-3 space-y-1.5">
              {split.map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-muted">{s.label}</span>
                  <span className="ml-auto font-medium tabular-nums">
                    <Money value={s.value} compact />
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader title="By department" subtitle="Tap a department for its monthly detail" />
        <DataTable
          columns={deptColumns}
          rows={deptAgg}
          getRowKey={(d) => d.departmentId}
          onRowClick={(d) => setDrillDept(d.departmentId)}
          dense
          mobileCard={(d) => (
            <Card interactive className="p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-medium text-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name}
                </span>
                <Money value={d.totalCost} compact className="font-semibold" />
              </div>
              <p className="mt-1 text-xs text-subtle">
                {d.headcount} people · <Money value={d.gross} compact /> payroll
              </p>
            </Card>
          )}
        />
      </Card>

      <Card className="mt-4 overflow-hidden">
        <CardHeader title="By month" subtitle={scopeLabel} />
        <DataTable
          columns={[
            { key: "month", header: "Month", cell: (r: (typeof byMonthRows)[number]) => formatMonthKey(r.month) },
            { key: "payroll", header: "Payroll", align: "right", cell: (r: (typeof byMonthRows)[number]) => <Money value={r.payroll} compact /> },
            { key: "expenses", header: "Expenses", align: "right", hideOnMobile: true, cell: (r: (typeof byMonthRows)[number]) => <Money value={r.expenses} compact /> },
            { key: "tax", header: "Tax", align: "right", hideOnMobile: true, cell: (r: (typeof byMonthRows)[number]) => <Money value={r.tax} compact /> },
            { key: "total", header: "Total", align: "right", cell: (r: (typeof byMonthRows)[number]) => <Money value={r.total} compact className="font-semibold" /> },
          ]}
          rows={byMonthRows}
          getRowKey={(r) => r.month}
          dense
        />
      </Card>

      <Sheet
        open={!!drillDept}
        onClose={() => setDrillDept(null)}
        title={drillDept ? (DEPARTMENTS.find((d) => d.id === drillDept)?.name ?? "Department") : ""}
        subtitle={`Monthly detail · ${scopeLabel}`}
      >
        {drillDept ? (
          <div>
            {[...monthsInScope].reverse().map((m) => {
              const d = departmentTotals(m).find((x) => x.departmentId === drillDept);
              if (!d) return null;
              return (
                <BreakdownRow
                  key={m}
                  label={formatMonthKey(m)}
                  sub={`${d.headcount} people · ${(d.tax / 1000).toFixed(0)}K tax`}
                  value={<Money value={d.totalCost} />}
                />
              );
            })}
          </div>
        ) : null}
      </Sheet>
    </>
  );
}

function pkrCr(n: number): string {
  return `${(n / 1_00_00_000).toFixed(2)}Cr`;
}
