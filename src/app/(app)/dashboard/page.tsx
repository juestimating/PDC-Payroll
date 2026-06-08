"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  CreditCard,
  Landmark,
  Layers,
  Users,
  Wallet,
} from "lucide-react";
import { useAppState } from "@/components/providers/app-state";
import {
  CURRENT_MONTH,
  dashboardKpis,
  departmentTotals,
  expenseTotals,
  getIncrements,
  getPayroll,
  getTasks,
  monthlyTrend,
  orgTotals,
} from "@/lib/data";
import { formatMonthKeyLong, formatMonthShort, formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Money } from "@/components/ui/money";
import { Bar } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { Sheet, BreakdownRow } from "@/components/ui/sheet";
import { CHART, ComparisonBar, Donut, MultiTrend, TrendArea } from "@/components/charts";

const SHORT_DEPT: Record<string, string> = {
  sales: "Sales",
  estimation: "Estimation",
  design: "Design",
  admin: "Admin & HR",
};

type Drill =
  | { kind: "payroll" | "expenses" | "tax" | "totalCost" }
  | { kind: "department"; deptId: string }
  | null;

type TrendMetric = "payrollCost" | "expenses" | "tax" | "all";

export default function DashboardPage() {
  const { month } = useAppState();
  const k = dashboardKpis(month);
  const totals = orgTotals(month);
  const depts = departmentTotals(month);
  const trend = monthlyTrend();
  const [drill, setDrill] = useState<Drill>(null);
  const [metric, setMetric] = useState<TrendMetric>("payrollCost");

  const trendData = trend.map((t) => ({
    label: formatMonthShort(t.month),
    payrollCost: t.payrollCost,
    expenses: t.expenses,
    tax: t.tax,
  }));

  const maxDeptCost = Math.max(...depts.map((d) => d.payrollCost), 1);

  const composition = [
    { label: "Basic", value: totals.basic, color: CHART.brand },
    { label: "Medical", value: totals.medical, color: CHART.info },
    { label: "Travel", value: totals.travel, color: CHART.violet },
    { label: "Commission", value: totals.commission, color: CHART.accent },
    { label: "Overtime", value: totals.overtime, color: CHART.positive },
  ].filter((c) => c.value > 0);

  const deptBars = depts.map((d) => ({
    label: SHORT_DEPT[d.key] ?? d.name,
    value: d.payrollCost,
    color: d.color,
  }));

  const tasks = getTasks({ month }).slice(0, 5);
  const increments = getIncrements().slice(0, 4);

  return (
    <>
      <PageHeader
        title="Financial Overview"
        description={`${formatMonthKeyLong(month)} · ${totals.headcount} active employees${
          month === CURRENT_MONTH ? " · live month" : ""
        }`}
      />

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Payroll cost"
          value={<Money value={totals.payrollCost} compact />}
          delta={k.payrollCost.deltaPct}
          hint="vs last month"
          icon={<Wallet className="h-4.5 w-4.5" />}
          accent={CHART.brand}
          onClick={() => setDrill({ kind: "payroll" })}
        />
        <StatCard
          label="Expenses"
          value={<Money value={totals.expenses} compact />}
          delta={k.expenses.deltaPct}
          deltaGoodWhen="down"
          hint="vs last month"
          icon={<CreditCard className="h-4.5 w-4.5" />}
          accent={CHART.accent}
          onClick={() => setDrill({ kind: "expenses" })}
        />
        <StatCard
          label="Withholding tax"
          value={<Money value={totals.tax} compact />}
          delta={k.tax.deltaPct}
          hint="vs last month"
          icon={<Landmark className="h-4.5 w-4.5" />}
          accent={CHART.info}
          onClick={() => setDrill({ kind: "tax" })}
        />
        <StatCard
          label="Total org cost"
          value={<Money value={totals.totalCost} compact />}
          delta={k.totalCost.deltaPct}
          hint="payroll + expenses"
          icon={<Layers className="h-4.5 w-4.5" />}
          accent={CHART.violet}
          onClick={() => setDrill({ kind: "totalCost" })}
        />
      </div>

      {/* Trend + composition */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="12-month trend"
            subtitle="How the numbers move across the year"
            action={
              <Segmented<TrendMetric>
                size="sm"
                value={metric}
                onChange={setMetric}
                options={[
                  { value: "payrollCost", label: "Payroll" },
                  { value: "expenses", label: "Expenses" },
                  { value: "tax", label: "Tax" },
                  { value: "all", label: "All" },
                ]}
              />
            }
          />
          <CardBody>
            {metric === "all" ? (
              <>
                <MultiTrend
                  data={trendData}
                  series={[
                    { key: "payrollCost", name: "Payroll", color: CHART.brand },
                    { key: "expenses", name: "Expenses", color: CHART.accent },
                    { key: "tax", name: "Tax", color: CHART.info },
                  ]}
                />
                <Legend
                  items={[
                    { label: "Payroll", color: CHART.brand },
                    { label: "Expenses", color: CHART.accent },
                    { label: "Tax", color: CHART.info },
                  ]}
                />
              </>
            ) : (
              <TrendArea
                data={trendData}
                dataKey={metric}
                name={metric === "payrollCost" ? "Payroll" : metric === "expenses" ? "Expenses" : "Tax"}
                color={metric === "expenses" ? CHART.accent : metric === "tax" ? CHART.info : CHART.brand}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Salary composition" subtitle="What makes up gross this month" />
          <CardBody>
            <Donut
              data={composition}
              centerValue={`${(totals.gross / 1_00_00_000).toFixed(2)}Cr`}
              centerLabel="Gross"
            />
            <div className="mt-3 space-y-1.5">
              {composition.map((c) => (
                <div key={c.label} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-muted">{c.label}</span>
                  <span className="ml-auto font-medium tabular-nums">
                    <Money value={c.value} compact />
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Department comparison */}
      <Card className="mt-4">
        <CardHeader
          title="By department"
          subtitle="Click a department to drill into its detail"
        />
        <CardBody>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ComparisonBar data={deptBars} />
            <div className="space-y-1">
              {depts.map((d) => (
                <button
                  key={d.departmentId}
                  onClick={() => setDrill({ kind: "department", deptId: d.departmentId })}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-muted"
                >
                  <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{d.name}</span>
                      <span className="text-sm font-semibold tabular-nums">
                        <Money value={d.payrollCost} compact />
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Bar value={d.payrollCost} max={maxDeptCost} color={d.color} height={5} />
                      <span className="shrink-0 text-xs text-subtle">{d.headcount} ppl</span>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-subtle" />
                </button>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Tasks + recent changes */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="This month's tasks" subtitle={formatMonthKeyLong(month)} />
          <CardBody className="space-y-1">
            {tasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No tasks scheduled.</p>
            ) : (
              tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                    <p className="text-xs text-subtle">
                      Due {t.dueDate}
                      {t.assignee ? ` · ${t.assignee.name}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent salary changes" subtitle="Increments across the org" />
          <CardBody className="space-y-1">
            {increments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No recent increments.</p>
            ) : (
              increments.map((inc) => (
                <div
                  key={inc.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-muted"
                >
                  <Avatar name={inc.employee.name} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{inc.employee.name}</p>
                    <p className="text-xs text-subtle">{inc.reason}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-positive">
                      <Money value={inc.newBasic - inc.oldBasic} compact signed />
                    </p>
                    <p className="text-xs text-subtle">{inc.date}</p>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      {/* Drill-down */}
      <DrillSheet drill={drill} month={month} onClose={() => setDrill(null)} />
    </>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5 text-xs text-muted">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: i.color }} />
          {i.label}
        </div>
      ))}
    </div>
  );
}

function DrillSheet({
  drill,
  month,
  onClose,
}: {
  drill: Drill;
  month: string;
  onClose: () => void;
}) {
  const totals = orgTotals(month);
  const depts = departmentTotals(month);
  const exp = expenseTotals(month);

  let title = "";
  let subtitle = formatMonthKeyLong(month);
  let body: React.ReactNode = null;

  if (drill?.kind === "payroll") {
    title = "Payroll cost breakdown";
    body = (
      <div>
        <BreakdownRow label="Basic salary" value={<Money value={totals.basic} />} />
        <BreakdownRow label="Medical allowance" value={<Money value={totals.medical} />} />
        <BreakdownRow label="Travel allowance" value={<Money value={totals.travel} />} />
        {totals.commission > 0 ? (
          <BreakdownRow label="Sales commission" value={<Money value={totals.commission} />} />
        ) : null}
        {totals.overtime > 0 ? (
          <BreakdownRow label="Overtime" value={<Money value={totals.overtime} />} />
        ) : null}
        <BreakdownRow label="Gross payroll cost" value={<Money value={totals.gross} />} emphasis />
        <p className="mt-4 text-xs text-subtle">
          Components always sum to the gross headline — a recomputation equals the stored total.
        </p>
        <DeptList rows={depts.map((d) => ({ name: d.name, color: d.color, value: d.payrollCost }))} />
      </div>
    );
  } else if (drill?.kind === "expenses") {
    title = "Expense breakdown";
    body = (
      <div>
        <BreakdownRow label="Recurring (auto-posted)" value={<Money value={exp.recurring} />} />
        <BreakdownRow label="Variable" value={<Money value={exp.variable} />} />
        <BreakdownRow label="Total expenses" value={<Money value={exp.total} />} emphasis />
        <p className="mb-1 mt-5 text-xs font-semibold uppercase tracking-wide text-subtle">
          By category
        </p>
        {exp.byCategory.slice(0, 6).map((c) => (
          <BreakdownRow key={c.category} label={c.category} value={<Money value={c.total} />} />
        ))}
        <DeptList rows={exp.byDepartment.map((d) => ({ name: d.name, color: d.color, value: d.total }))} />
      </div>
    );
  } else if (drill?.kind === "tax") {
    title = "Tax breakdown";
    body = (
      <div>
        <BreakdownRow label="Gross salary (with tax)" value={<Money value={totals.gross} />} />
        <BreakdownRow label="Withholding tax" value={<Money value={totals.tax} />} />
        <BreakdownRow
          label="Salary without tax"
          value={<Money value={totals.gross - totals.tax} />}
          emphasis
        />
        <BreakdownRow
          label="Effective tax rate"
          value={formatPercent(totals.gross ? (totals.tax / totals.gross) * 100 : 0)}
        />
        <DeptList rows={depts.map((d) => ({ name: d.name, color: d.color, value: d.tax }))} />
      </div>
    );
  } else if (drill?.kind === "totalCost") {
    title = "Total org cost";
    body = (
      <div>
        <BreakdownRow label="Payroll cost" value={<Money value={totals.payrollCost} />} />
        <BreakdownRow label="Operating expenses" value={<Money value={totals.expenses} />} />
        <BreakdownRow label="Total cost" value={<Money value={totals.totalCost} />} emphasis />
        <DeptList rows={depts.map((d) => ({ name: d.name, color: d.color, value: d.totalCost }))} />
      </div>
    );
  } else if (drill?.kind === "department") {
    const d = depts.find((x) => x.departmentId === drill.deptId);
    const top = getPayroll(month, { departmentId: drill.deptId }).slice(0, 4);
    if (d) {
      title = d.name;
      subtitle = `${d.headcount} employees · ${formatMonthKeyLong(month)}`;
      body = (
        <div>
          <BreakdownRow label="Payroll cost" value={<Money value={d.payrollCost} />} accent={d.color} />
          <BreakdownRow label="Withholding tax" value={<Money value={d.tax} />} />
          <BreakdownRow label="Net disbursed" value={<Money value={d.net} />} />
          {d.commission > 0 ? (
            <BreakdownRow label="Commission" value={<Money value={d.commission} />} />
          ) : null}
          {d.overtime > 0 ? (
            <BreakdownRow label="Overtime" value={<Money value={d.overtime} />} />
          ) : null}
          <BreakdownRow label="Department expenses" value={<Money value={d.expenses} />} />
          <p className="mb-1 mt-5 text-xs font-semibold uppercase tracking-wide text-subtle">
            Top earners
          </p>
          {top.map((r) => (
            <div key={r.id} className="flex items-center gap-3 py-2">
              <Avatar name={r.employee.name} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.employee.name}</p>
                <p className="text-xs text-subtle">{r.employee.designation}</p>
              </div>
              <span className="text-sm font-semibold tabular-nums">
                <Money value={r.gross} compact />
              </span>
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <Sheet open={!!drill} onClose={onClose} title={title} subtitle={subtitle}>
      {body}
    </Sheet>
  );
}

function DeptList({ rows }: { rows: { name: string; color: string; value: number }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="mt-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">By department</p>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.name}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted">{r.name}</span>
              <span className="font-medium tabular-nums">
                <Money value={r.value} compact />
              </span>
            </div>
            <Bar value={r.value} max={max} color={r.color} height={5} className="mt-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
