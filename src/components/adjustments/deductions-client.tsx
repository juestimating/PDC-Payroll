"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Info, TrendingDown } from "lucide-react";
import type { DeductionRow } from "@/lib/db/deductions";
import { formatMonthKey, formatMonthKeyLong } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { Sheet, BreakdownRow } from "@/components/ui/sheet";

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

type Drill = "total" | "people" | "avg" | null;

export function DeductionsClient({
  rows,
  month,
  months,
}: {
  rows: DeductionRow[];
  month: string;
  months: string[];
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<DeductionRow | null>(null);
  const [drill, setDrill] = useState<Drill>(null);

  // Months with data, plus the current selection so the Select never shows blank.
  const monthOptions = useMemo(() => {
    const set = new Set(months);
    set.add(month);
    return [...set].sort().reverse();
  }, [months, month]);

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.total, 0);
    return { total, people: rows.length, avg: rows.length ? total / rows.length : 0 };
  }, [rows]);

  const columns: Column<DeductionRow>[] = [
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
      key: "advance",
      header: "Advance",
      align: "right",
      cell: (r) => (r.advance > 0 ? <Money value={r.advance} /> : <span className="text-subtle">—</span>),
    },
    {
      key: "leave",
      header: "Unpaid leave",
      align: "right",
      cell: (r) =>
        r.leaveDays > 0 ? (
          <div>
            <Money value={r.leaveDeduction} />
            <p className="text-xs text-subtle">{days(r.leaveDays)}</p>
          </div>
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
    {
      key: "loan",
      header: "Loan installment",
      align: "right",
      hideOnMobile: true,
      cell: (r) => (r.loanInstallment > 0 ? <Money value={r.loanInstallment} /> : <span className="text-subtle">—</span>),
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

  const drillTitle =
    drill === "people" ? "Employees affected" : drill === "avg" ? "Avg deduction" : "Total deductions";

  return (
    <>
      <PageHeader
        title="Deductions"
        description={`${formatMonthKeyLong(month)} · derived live, exactly as payroll counts them`}
        actions={
          <Select value={month} onChange={(e) => router.push(`/deductions?month=${e.target.value}`)} className="w-40">
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {formatMonthKey(m)}
              </option>
            ))}
          </Select>
        }
      >
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted/50 px-4 py-2.5 text-sm text-muted">
          <Info className="h-4 w-4 shrink-0" />
          <span>
            Deductions are managed in{" "}
            <Link href="/advances" className="font-medium text-foreground underline underline-offset-2">
              Advances
            </Link>
            ,{" "}
            <Link href="/leaves" className="font-medium text-foreground underline underline-offset-2">
              Unpaid Leaves
            </Link>{" "}
            and{" "}
            <Link href="/loans" className="font-medium text-foreground underline underline-offset-2">
              Loans
            </Link>{" "}
            — edit them there.
          </span>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          label="Total deductions"
          value={<Money value={stats.total} compact />}
          hint="this month"
          icon={<TrendingDown className="h-4.5 w-4.5" />}
          onClick={() => setDrill("total")}
        />
        <StatCard label="Employees affected" value={String(stats.people)} onClick={() => setDrill("people")} />
        <StatCard label="Avg deduction" value={<Money value={stats.avg} compact />} onClick={() => setDrill("avg")} />
      </div>

      <Card className="mt-4 overflow-hidden">
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.employeeId}
          onRowClick={(r) => setDetail(r)}
          dense
          emptyState={
            <EmptyState
              icon={<TrendingDown className="h-5 w-5" />}
              title="No deductions this month"
              description="Nothing is logged in Advances, Unpaid Leaves or Loans for this month."
            />
          }
          mobileCard={(r) => (
            <Card interactive className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.employeeName}</p>
                  <p className="truncate text-xs text-subtle">
                    {[
                      r.advance > 0 ? "Advance" : null,
                      r.leaveDays > 0 ? `Leave (${days(r.leaveDays)})` : null,
                      r.loanInstallment > 0 ? "Loan" : null,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-negative">
                  <Money value={r.total} compact />
                </span>
              </div>
            </Card>
          )}
        />
      </Card>

      {/* Row drill-down */}
      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Deduction breakdown"
        subtitle={detail ? `${detail.employeeName} · ${formatMonthKeyLong(month)}` : ""}
        width={480}
      >
        {detail ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface-muted/50 p-3">
              <BreakdownRow label="Gross salary" sub="open structure" value={<Money value={detail.gross} />} />
              {detail.advance > 0 ? (
                <BreakdownRow
                  label="Advance"
                  sub="deducted in full this month"
                  value={<span className="text-negative"><Money value={detail.advance} /></span>}
                />
              ) : null}
              {detail.leaveDays > 0 ? (
                <BreakdownRow
                  label="Unpaid leave"
                  sub={`${days(detail.leaveDays)} × gross / 30`}
                  value={<span className="text-negative"><Money value={detail.leaveDeduction} /></span>}
                />
              ) : null}
              {detail.loanInstallment > 0 ? (
                <BreakdownRow
                  label="Loan installment"
                  sub="due this month"
                  value={<span className="text-negative"><Money value={detail.loanInstallment} /></span>}
                />
              ) : null}
              <BreakdownRow
                label="Total deductions"
                value={<span className="text-negative"><Money value={detail.total} /></span>}
                emphasis
              />
            </div>
            <p className="text-xs text-subtle">
              This view is read-only — correct any figure in Advances, Unpaid Leaves or Loans and it updates here and
              in payroll instantly.
            </p>
          </div>
        ) : null}
      </Sheet>

      {/* Card drill-downs */}
      <Sheet
        open={!!drill}
        onClose={() => setDrill(null)}
        title={drillTitle}
        subtitle={formatMonthKeyLong(month)}
        width={480}
      >
        <div>
          {rows.map((r) => (
            <BreakdownRow
              key={r.employeeId}
              label={r.employeeName}
              sub={r.employeeCode ?? "—"}
              value={
                <span className="text-negative">
                  <Money value={r.total} />
                </span>
              }
            />
          ))}
          <BreakdownRow
            label={drill === "avg" ? `Average across ${stats.people}` : "Total"}
            value={
              <span className="text-negative">
                <Money value={drill === "avg" ? stats.avg : stats.total} />
              </span>
            }
            emphasis
          />
        </div>
      </Sheet>
    </>
  );
}
