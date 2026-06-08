"use client";

import { useState } from "react";
import { Landmark } from "lucide-react";
import { useAppState } from "@/components/providers/app-state";
import { DEPARTMENTS, departmentById, taxRows, taxTotals } from "@/lib/data";
import type { TaxRow } from "@/lib/data";
import { formatMonthKeyLong, formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Money } from "@/components/ui/money";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bar } from "@/components/ui/progress";
import { Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Sheet, BreakdownRow } from "@/components/ui/sheet";
import { CHART, Donut } from "@/components/charts";

const SHORT: Record<string, string> = {
  sales: "Sales",
  estimation: "Estimation",
  design: "Design",
  admin: "Admin & HR",
};

export default function TaxPage() {
  const { month } = useAppState();
  const [dept, setDept] = useState("all");
  const [detail, setDetail] = useState<TaxRow | null>(null);

  const rows = taxRows(month, { departmentId: dept === "all" ? undefined : dept });
  const tot = taxTotals(month);
  const maxDeptTax = Math.max(...tot.byDepartment.map((d) => d.tax), 1);

  const donut = [
    { label: "Take-home", value: tot.withoutTax, color: CHART.brand },
    { label: "Withholding tax", value: tot.tax, color: CHART.negative },
  ];

  const columns: Column<TaxRow>[] = [
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
    { key: "gross", header: "With tax", align: "right", cell: (r) => <Money value={r.gross} /> },
    {
      key: "taxable",
      header: "Taxable",
      align: "right",
      hideOnMobile: true,
      cell: (r) => <Money value={r.taxable} />,
    },
    {
      key: "tax",
      header: "Tax",
      align: "right",
      cell: (r) => (
        <span className="text-negative">
          <Money value={r.tax} />
        </span>
      ),
    },
    {
      key: "withoutTax",
      header: "Without tax",
      align: "right",
      cell: (r) => <Money value={r.withoutTax} className="font-semibold text-brand-700" />,
    },
    {
      key: "rate",
      header: "Eff. rate",
      align: "center",
      hideOnMobile: true,
      cell: (r) => <span className="tabular-nums text-muted">{formatPercent(r.effectiveRate)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Tax Management"
        description={`${formatMonthKeyLong(month)} · salary with and without tax`}
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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Salary with tax"
          value={<Money value={tot.gross} compact />}
          hint="gross, before tax"
          icon={<Landmark className="h-4.5 w-4.5" />}
        />
        <StatCard label="Withholding tax" value={<Money value={tot.tax} compact />} hint="payable to FBR" />
        <StatCard
          label="Salary without tax"
          value={<Money value={tot.withoutTax} compact />}
          hint="take-home"
        />
        <StatCard label="Effective rate" value={formatPercent(tot.effectiveRate)} hint="org-wide" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Salary vs tax" subtitle="How gross splits this month" />
          <CardBody>
            <Donut data={donut} centerValue={pkrCr(tot.gross)} centerLabel="Gross" />
            <div className="mt-3 space-y-1.5">
              {donut.map((d) => (
                <div key={d.label} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-muted">{d.label}</span>
                  <span className="ml-auto font-medium tabular-nums">
                    <Money value={d.value} compact />
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Tax by department" subtitle="Team-wide totals" />
          <CardBody className="space-y-3">
            {tot.byDepartment.map((d) => (
              <div key={d.departmentId}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 text-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </span>
                  <span className="font-medium tabular-nums">
                    <Money value={d.tax} compact /> tax ·{" "}
                    <span className="text-subtle">
                      <Money value={d.gross} compact /> gross
                    </span>
                  </span>
                </div>
                <Bar value={d.tax} max={maxDeptTax} color={d.color} height={6} className="mt-1.5" />
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader title="Per-employee tax detail" subtitle="Tap a row for the full split" />
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.employee.id}
          onRowClick={(r) => setDetail(r)}
          dense
          mobileCard={(r) => (
            <Card interactive className="p-3">
              <div className="flex items-center gap-3">
                <Avatar name={r.employee.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{r.employee.name}</p>
                  <p className="text-xs text-subtle">{formatPercent(r.effectiveRate)} effective</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-subtle">Tax</p>
                  <p className="font-semibold text-negative">
                    <Money value={r.tax} compact />
                  </p>
                </div>
              </div>
            </Card>
          )}
        />
      </Card>

      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Tax detail"
        subtitle={detail?.employee.name ?? ""}
      >
        {detail ? (
          <div>
            <BreakdownRow label="Gross salary (with tax)" value={<Money value={detail.gross} />} />
            <BreakdownRow label="Taxable salary" value={<Money value={detail.taxable} />} />
            <BreakdownRow
              label="Withholding tax"
              value={
                <span className="text-negative">
                  <Money value={detail.tax} />
                </span>
              }
            />
            <BreakdownRow
              label="Salary without tax"
              value={<Money value={detail.withoutTax} />}
              emphasis
            />
            <BreakdownRow label="Effective rate" value={formatPercent(detail.effectiveRate)} />
            <p className="mt-4 text-xs text-subtle">
              Tax shown uses a placeholder slab model. Real FBR withholding slabs are wired in the
              logic phase.
            </p>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}

function pkrCr(n: number): string {
  return `${(n / 1_00_00_000).toFixed(2)}Cr`;
}
