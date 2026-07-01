"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, Trophy } from "lucide-react";
import type { IncentiveRow, EmployeeOption, IncentiveStatus } from "@/lib/db/incentives";
import { createIncentiveAction } from "@/app/(app)/incentives/actions";
import { formatMonthKey } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { Sheet, BreakdownRow } from "@/components/ui/sheet";

const STATUS_META: Record<IncentiveStatus, { label: string; tone: "positive" | "warning" | "neutral" }> = {
  payable: { label: "Payable", tone: "positive" },
  held: { label: "Held", tone: "warning" },
  already_paid: { label: "Already paid", tone: "neutral" },
};

export function IncentivesClient({
  incentives,
  employees,
  canManage,
}: {
  incentives: IncentiveRow[];
  employees: EmployeeOption[];
  canManage: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);

  const totals = useMemo(
    () =>
      incentives.reduce(
        (s, r) => {
          s.accrued += r.accruedTotal;
          s.payable += r.payableAmount;
          s.withheld += r.withheldAmount;
          return s;
        },
        { accrued: 0, payable: 0, withheld: 0 },
      ),
    [incentives],
  );

  const columns: Column<IncentiveRow>[] = [
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
      key: "month",
      header: "Month",
      hideOnMobile: true,
      cell: (r) => <span className="text-sm text-muted">{formatMonthKey(r.month)}</span>,
    },
    { key: "incentive", header: "Incentive", align: "right", cell: (r) => <Money value={r.incentiveAmount} /> },
    { key: "bonus", header: "Bonus", align: "right", hideOnMobile: true, cell: (r) => <Money value={r.bonusAmount} /> },
    { key: "accrued", header: "Accrued", align: "right", hideOnMobile: true, cell: (r) => <Money value={r.accruedTotal} /> },
    { key: "payable", header: "Payable", align: "right", cell: (r) => <Money value={r.payableAmount} /> },
    { key: "withheld", header: "Withheld", align: "right", hideOnMobile: true, cell: (r) => <Money value={r.withheldAmount} /> },
    {
      key: "status",
      header: "Status",
      align: "center",
      cell: (r) => {
        const meta = STATUS_META[r.status];
        return <Badge tone={meta.tone}>{meta.label}</Badge>;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Sales Incentives"
        description="FX commission on sales plus discretionary bonus — payout gated on KPI, withholding the bonus when it's not met."
        actions={
          canManage ? (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Log incentive
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Records" value={String(incentives.length)} icon={<Trophy className="h-4.5 w-4.5" />} />
        <StatCard label="Accrued" value={<Money value={totals.accrued} compact />} hint="full expense" />
        <StatCard label="Payable" value={<Money value={totals.payable} compact />} hint="cash out" />
        <StatCard label="Withheld" value={<Money value={totals.withheld} compact />} hint="held / already paid" />
      </div>

      <Card className="mt-4 overflow-hidden">
        <DataTable
          columns={columns}
          rows={incentives}
          getRowKey={(r) => r.id}
          dense
          emptyState={
            <EmptyState
              icon={<Trophy className="h-5 w-5" />}
              title="No incentives logged"
              description={
                canManage ? "Log an incentive to book the commission and compute its payout." : "Nothing here yet."
              }
            />
          }
          mobileCard={(r) => {
            const meta = STATUS_META[r.status];
            return (
              <Card className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{r.employeeName}</p>
                    <p className="truncate text-xs text-subtle">
                      {r.employeeCode} · {formatMonthKey(r.month)}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">
                    <Money value={r.payableAmount} compact />
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {r.entityId ? <Badge tone="brand">{r.entityId}</Badge> : null}
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <span className="ml-auto text-xs text-subtle">
                    Accrued <Money value={r.accruedTotal} compact />
                  </span>
                </div>
              </Card>
            );
          }}
        />
      </Card>

      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Log incentive"
        subtitle="Commission + bonus"
        width={520}
      >
        <IncentiveForm employees={employees} onClose={() => setAddOpen(false)} />
      </Sheet>
    </>
  );
}

function IncentiveForm({ employees, onClose }: { employees: EmployeeOption[]; onClose: () => void }) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState("2026-05");
  const [saleValueUsd, setSaleValueUsd] = useState("");
  const [commissionPct, setCommissionPct] = useState("");
  const [fxRate, setFxRate] = useState("275");
  const [bonus, setBonus] = useState("");
  const [kpiMet, setKpiMet] = useState(true);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState(false);

  // Live preview mirrors the server computation exactly.
  const preview = useMemo(() => {
    const usd = Number(saleValueUsd) || 0;
    const pct = Number(commissionPct) || 0;
    const fx = Number(fxRate) || 0;
    const b = Number(bonus) || 0;
    const incentive = usd * (pct / 100) * fx;
    const accrued = incentive + b;
    const payable = alreadyPaid ? 0 : kpiMet ? accrued : incentive;
    const withheld = accrued - payable;
    return { incentive, accrued, payable, withheld };
  }, [saleValueUsd, commissionPct, fxRate, bonus, kpiMet, alreadyPaid]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await createIncentiveAction({
      employeeId,
      month,
      saleValueUsd: Number(saleValueUsd) || 0,
      commissionPct: Number(commissionPct) || 0,
      fxRate: Number(fxRate) || 0,
      bonus: Number(bonus) || 0,
      kpiMet,
      alreadyPaid,
      note: note || null,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setOk(true);
    router.refresh();
    setTimeout(onClose, 900);
  }

  if (ok) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle2 className="h-12 w-12 text-positive" />
        <p className="mt-3 text-base font-semibold text-foreground">Incentive logged</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? (
        <div role="alert" className="rounded-lg border border-negative/30 bg-negative-soft px-3 py-2 text-sm text-negative">
          {error}
        </div>
      ) : null}

      <Field label="Employee" required>
        <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
          <option value="">Select employee…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.code} · {e.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Month" required>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} required />
        </Field>
        <Field label="Sale value (USD)" required>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={saleValueUsd}
            onChange={(e) => setSaleValueUsd(e.target.value)}
            placeholder="0"
            required
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Commission %" required>
          <Input
            type="number"
            min={0}
            step="0.1"
            value={commissionPct}
            onChange={(e) => setCommissionPct(e.target.value)}
            placeholder="1"
            required
          />
        </Field>
        <Field label="FX rate (PKR/USD)" required>
          <Input
            type="number"
            min={1}
            step="0.01"
            value={fxRate}
            onChange={(e) => setFxRate(e.target.value)}
            placeholder="275"
            required
          />
        </Field>
        <Field label="Bonus (PKR)">
          <Input type="number" min={0} value={bonus} onChange={(e) => setBonus(e.target.value)} placeholder="0" />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={kpiMet}
            onChange={(e) => setKpiMet(e.target.checked)}
            className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500/30"
          />
          KPI met
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={alreadyPaid}
            onChange={(e) => setAlreadyPaid(e.target.checked)}
            className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500/30"
          />
          Already paid
        </label>
      </div>

      <Field label="Note">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </Field>

      {/* Live computed preview — mirrors the payout policy. */}
      <div className="rounded-xl border border-border bg-surface-muted/40 px-4 py-1">
        <BreakdownRow
          label="Incentive"
          sub="USD × % × FX"
          value={<Money value={preview.incentive} />}
        />
        <BreakdownRow label="Accrued total" sub="incentive + bonus" value={<Money value={preview.accrued} />} />
        <BreakdownRow
          label="Withheld"
          sub={alreadyPaid ? "already paid" : kpiMet ? "none" : "bonus held"}
          value={<Money value={preview.withheld} />}
        />
        <BreakdownRow label="Payable" value={<Money value={preview.payable} />} emphasis />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Logging…" : "Log incentive"}
        </Button>
      </div>
    </form>
  );
}
