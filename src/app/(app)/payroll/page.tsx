"use client";

import { useMemo, useState } from "react";
import { Lock, Plus, Search } from "lucide-react";
import { useAppState } from "@/components/providers/app-state";
import {
  DEPARTMENTS,
  commissionTotal,
  departmentById,
  getOpenMonth,
  getPayroll,
} from "@/lib/data";
import type { DeductionItem, PayrollRow, PayrollStatus } from "@/lib/data";
import { formatMonthKeyLong, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Money } from "@/components/ui/money";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { PayslipSheet } from "@/components/payroll/payroll-breakdown";

function earned(r: PayrollRow): number {
  return r.commission ? commissionTotal(r.commission) : (r.overtime?.amount ?? 0);
}

// Deduction columns are conditional: a column appears only when at least one
// employee in the month has that kind of deduction. `advance` and `loan` get
// their own columns; every other kind rolls up into a generic "Deductions".
const ADVANCE_KINDS: DeductionItem["kind"][] = ["advance"];
const LOAN_KINDS: DeductionItem["kind"][] = ["loan"];
const OTHER_KINDS: DeductionItem["kind"][] = ["absence", "tax_adjustment", "other"];

function dsum(r: PayrollRow, kinds: DeductionItem["kind"][]): number {
  return r.deductions.reduce((s, d) => (kinds.includes(d.kind) ? s + d.amount : s), 0);
}

function deductionColumn(
  key: string,
  header: string,
  kinds: DeductionItem["kind"][],
): Column<PayrollRow> {
  return {
    key,
    header,
    align: "right",
    cell: (r) => {
      const v = dsum(r, kinds);
      return v > 0 ? (
        <span className="text-negative">
          <Money value={v} />
        </span>
      ) : (
        <span className="text-subtle">—</span>
      );
    },
  };
}

export default function PayrollPage() {
  const { month } = useAppState();
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PayrollRow | null>(null);

  const rows = getPayroll(month, {
    departmentId: dept === "all" ? undefined : dept,
    status: status === "all" ? undefined : (status as PayrollStatus),
    search: search || undefined,
  });

  const t = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({
          basic: a.basic + r.basic,
          allow: a.allow + r.medical + r.travel,
          earned: a.earned + earned(r),
          gross: a.gross + r.gross,
          tax: a.tax + r.withholdingTax,
          advance: a.advance + dsum(r, ADVANCE_KINDS),
          loan: a.loan + dsum(r, LOAN_KINDS),
          other: a.other + dsum(r, OTHER_KINDS),
          net: a.net + r.net,
        }),
        { basic: 0, allow: 0, earned: 0, gross: 0, tax: 0, advance: 0, loan: 0, other: 0, net: 0 },
      ),
    [rows],
  );

  // Only show a deduction column when the month actually has that kind.
  const hasAdvance = t.advance > 0;
  const hasLoan = t.loan > 0;
  const hasOther = t.other > 0;

  const closed = month !== getOpenMonth();

  const columns: Column<PayrollRow>[] = [
    {
      key: "employee",
      header: "Employee",
      align: "left",
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
    { key: "basic", header: "Basic", align: "right", cell: (r) => <Money value={r.basic} /> },
    {
      key: "allow",
      header: "Allowances",
      align: "right",
      hideOnMobile: true,
      cell: (r) => <Money value={r.medical + r.travel} />,
    },
    {
      key: "earned",
      header: "Comm / OT",
      align: "right",
      cell: (r) =>
        r.commission ? (
          <span className="inline-flex items-center gap-1.5">
            <Money value={commissionTotal(r.commission)} />
            <span className="rounded bg-accent-50 px-1 text-[10px] font-semibold text-accent-600">
              COMM
            </span>
          </span>
        ) : r.overtime && r.overtime.amount > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <Money value={r.overtime.amount} />
            <span className="rounded bg-info-soft px-1 text-[10px] font-semibold text-info">OT</span>
          </span>
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
    {
      key: "gross",
      header: "Gross",
      align: "right",
      cell: (r) => <Money value={r.gross} className="font-semibold" />,
    },
    {
      key: "tax",
      header: "Tax",
      align: "right",
      cell: (r) => (
        <span className="text-negative">
          <Money value={r.withholdingTax} />
        </span>
      ),
    },
    ...(hasAdvance ? [deductionColumn("advance", "Advance", ADVANCE_KINDS)] : []),
    ...(hasLoan ? [deductionColumn("loan", "Loan", LOAN_KINDS)] : []),
    ...(hasOther ? [deductionColumn("deductions", "Deductions", OTHER_KINDS)] : []),
    {
      key: "net",
      header: "Net",
      align: "right",
      cell: (r) => <Money value={r.net} className="font-semibold text-brand-700" />,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      hideOnMobile: true,
      cell: (r) => <StatusBadge status={r.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Payroll"
        description={`${formatMonthKeyLong(month)} · main salary sheet`}
        actions={
          <Button disabled={closed}>
            <Plus className="h-4 w-4" />
            {closed ? "Month locked" : "Process payroll"}
          </Button>
        }
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or designation…"
              className="pl-9"
            />
          </div>
          <Select value={dept} onChange={(e) => setDept(e.target.value)} className="sm:w-48">
            <option value="all">All departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-40">
            <option value="all">All status</option>
            <option value="processing">Processing</option>
            <option value="closed">Closed</option>
          </Select>
        </div>
      </PageHeader>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Gross payroll" value={<Money value={t.gross} compact />} hint={`${rows.length} employees`} />
        <StatCard
          label="Withholding tax"
          value={<Money value={t.tax} compact />}
          hint={`${formatPercent(t.gross ? (t.tax / t.gross) * 100 : 0)} effective`}
        />
        <StatCard label="Net disbursed" value={<Money value={t.net} compact />} hint="after tax & deductions" />
        <StatCard
          label="Avg cost / head"
          value={<Money value={rows.length ? t.gross / rows.length : 0} compact />}
          hint="gross per employee"
        />
      </div>

      {/* Status banner */}
      <div
        className={cn(
          "mt-4 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm",
          closed
            ? "border-border bg-surface-muted text-muted"
            : "border-info-soft bg-info-soft text-info",
        )}
      >
        {closed ? (
          <>
            <Lock className="h-4 w-4" />
            This month is closed and locked. Figures are immutable and preserved for the record.
          </>
        ) : (
          <>
            <span className="h-2 w-2 animate-pulse rounded-full bg-info" />
            Live month. Figures update automatically as components, increments, and deductions change.
          </>
        )}
      </div>

      {/* Sheet */}
      <Card className="mt-4 overflow-hidden">
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.id}
          onRowClick={(r) => setSelected(r)}
          dense
          emptyState={
            <EmptyState
              icon={<Search className="h-5 w-5" />}
              title="No matching employees"
              description="Try clearing the filters or searching a different name."
            />
          }
          footer={
            rows.length > 0 ? (
              <tr className="border-t-2 border-border bg-surface-muted/50 font-semibold">
                <td className="px-3 py-3 text-sm">Total · {rows.length}</td>
                <td className="px-3 py-3 text-right tabular-nums">
                  <Money value={t.basic} compact />
                </td>
                <td className="hidden px-3 py-3 text-right tabular-nums lg:table-cell">
                  <Money value={t.allow} compact />
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  <Money value={t.earned} compact />
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  <Money value={t.gross} compact />
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-negative">
                  <Money value={t.tax} compact />
                </td>
                {hasAdvance ? (
                  <td className="px-3 py-3 text-right tabular-nums text-negative">
                    <Money value={t.advance} compact />
                  </td>
                ) : null}
                {hasLoan ? (
                  <td className="px-3 py-3 text-right tabular-nums text-negative">
                    <Money value={t.loan} compact />
                  </td>
                ) : null}
                {hasOther ? (
                  <td className="px-3 py-3 text-right tabular-nums text-negative">
                    <Money value={t.other} compact />
                  </td>
                ) : null}
                <td className="px-3 py-3 text-right tabular-nums text-brand-700">
                  <Money value={t.net} compact />
                </td>
                <td className="hidden lg:table-cell" />
              </tr>
            ) : null
          }
          mobileCard={(r) => (
            <Card interactive className="p-3">
              <div className="flex items-center gap-3">
                <Avatar name={r.employee.name} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{r.employee.name}</p>
                  <p className="truncate text-xs text-subtle">{r.employee.designation}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Mini label="Gross" value={r.gross} />
                <Mini label="Tax" value={r.withholdingTax} tone="negative" />
                <Mini label="Net" value={r.net} tone="brand" />
              </div>
            </Card>
          )}
        />
      </Card>

      <p className="mt-3 text-center text-xs text-subtle">
        Tap any row to see the full salary breakdown — every figure rolls up from its components.
      </p>

      <PayslipSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        record={selected}
        employee={selected?.employee ?? null}
        departmentName={selected ? departmentById.get(selected.employee.departmentId)?.name : undefined}
      />
    </>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "negative" | "brand";
}) {
  return (
    <div className="rounded-lg bg-surface-muted py-2">
      <p className="text-[11px] text-subtle">{label}</p>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums",
          tone === "negative" && "text-negative",
          tone === "brand" && "text-brand-700",
        )}
      >
        <Money value={value} compact />
      </p>
    </div>
  );
}
