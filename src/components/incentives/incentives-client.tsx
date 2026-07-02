"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import type { IncentiveRow, EmployeeOption, IncentiveStatus } from "@/lib/db/incentives";
import {
  createIncentiveAction,
  updateIncentiveAction,
  deleteIncentiveAction,
} from "@/app/(app)/incentives/actions";
import { formatMonthKey, formatPercent } from "@/lib/format";
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

type StatDrill = "records" | "accrued" | "payable" | "withheld";

const STAT_DRILL_META: Record<StatDrill, { title: string; subtitle: string; measure: (r: IncentiveRow) => number }> = {
  records: { title: "Incentive records", subtitle: "Every logged employee-month", measure: (r) => r.accruedTotal },
  accrued: { title: "Accrued", subtitle: "Full incentive expense booked", measure: (r) => r.accruedTotal },
  payable: { title: "Payable", subtitle: "Cash out this run", measure: (r) => r.payableAmount },
  withheld: { title: "Withheld", subtitle: "Held bonuses + already-paid accruals", measure: (r) => r.withheldAmount },
};

const USD = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

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
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statDrill, setStatDrill] = useState<StatDrill | null>(null);

  // Resolve from props so the open sheet reflects fresh data after router.refresh()
  // (and closes itself if the row was deleted).
  const detail = detailId ? (incentives.find((r) => r.id === detailId) ?? null) : null;

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
    { key: "newSales", header: "New Sales", align: "right", hideOnMobile: true, cell: (r) => <Money value={r.newSales} /> },
    { key: "recurring", header: "Recurring", align: "right", hideOnMobile: true, cell: (r) => <Money value={r.recurring} /> },
    { key: "bonus", header: "Bonus", align: "right", hideOnMobile: true, cell: (r) => <Money value={r.bonusAmount} /> },
    { key: "salesBonus", header: "Sales Bonus", align: "right", hideOnMobile: true, cell: (r) => <Money value={r.salesBonus} /> },
    { key: "accrued", header: "Accrued", align: "right", hideOnMobile: true, cell: (r) => <Money value={r.accruedTotal} /> },
    { key: "payable", header: "Payable", align: "right", cell: (r) => <Money value={r.payableAmount} /> },
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
        description="FX commission on sales plus manual New Sales / Recurring / Sales Bonus cells — payout gated on KPI, withholding the bonuses when it's not met."
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
        <StatCard
          label="Records"
          value={String(incentives.length)}
          icon={<Trophy className="h-4.5 w-4.5" />}
          onClick={() => setStatDrill("records")}
        />
        <StatCard
          label="Accrued"
          value={<Money value={totals.accrued} compact />}
          hint="full expense"
          onClick={() => setStatDrill("accrued")}
        />
        <StatCard
          label="Payable"
          value={<Money value={totals.payable} compact />}
          hint="cash out"
          onClick={() => setStatDrill("payable")}
        />
        <StatCard
          label="Withheld"
          value={<Money value={totals.withheld} compact />}
          hint="held / already paid"
          onClick={() => setStatDrill("withheld")}
        />
      </div>

      <Card className="mt-4 overflow-hidden">
        <DataTable
          columns={columns}
          rows={incentives}
          getRowKey={(r) => r.id}
          onRowClick={(r) => setDetailId(r.id)}
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
              <Card interactive className="p-3">
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

      <Sheet
        open={!!detail}
        onClose={() => setDetailId(null)}
        title="Incentive detail"
        subtitle={detail ? `${detail.employeeName} · ${formatMonthKey(detail.month)}` : ""}
        width={520}
      >
        {detail ? (
          <IncentiveDetail
            key={detail.id}
            row={detail}
            employees={employees}
            canManage={canManage}
            onClose={() => setDetailId(null)}
          />
        ) : null}
      </Sheet>

      <Sheet
        open={!!statDrill}
        onClose={() => setStatDrill(null)}
        title={statDrill ? STAT_DRILL_META[statDrill].title : ""}
        subtitle={statDrill ? STAT_DRILL_META[statDrill].subtitle : ""}
        width={520}
      >
        {statDrill ? <StatDrillBody kind={statDrill} incentives={incentives} /> : null}
      </Sheet>
    </>
  );
}

/** Drill-down for a headline StatCard: the rows contributing to that figure. */
function StatDrillBody({ kind, incentives }: { kind: StatDrill; incentives: IncentiveRow[] }) {
  const { measure } = STAT_DRILL_META[kind];
  const rows = kind === "records" ? incentives : incentives.filter((r) => measure(r) > 0);
  const total = rows.reduce((s, r) => s + measure(r), 0);

  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-subtle">Nothing contributes to this figure yet.</p>;
  }

  return (
    <div>
      {rows.map((r) => {
        const meta = STATUS_META[r.status];
        return (
          <BreakdownRow
            key={r.id}
            label={r.employeeName}
            sub={`${r.employeeCode ?? "—"} · ${formatMonthKey(r.month)}`}
            value={
              kind === "withheld" ? (
                <span className="flex items-center justify-end gap-2">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <Money value={measure(r)} />
                </span>
              ) : (
                <Money value={measure(r)} />
              )
            }
          />
        );
      })}
      {kind === "records" ? (
        <BreakdownRow label="Records" value={<span className="font-semibold">{rows.length}</span>} emphasis />
      ) : (
        <BreakdownRow label="Total" value={<Money value={total} />} emphasis />
      )}
      {kind === "withheld" ? (
        <p className="mt-3 text-xs text-subtle">
          &ldquo;Held&rdquo; rows release their bonuses once the KPI is met; &ldquo;Already paid&rdquo; rows keep the
          full accrual out of this cash run.
        </p>
      ) : null}
    </div>
  );
}

/** Full breakdown of one record, with Edit / Delete for managers. */
function IncentiveDetail({
  row,
  employees,
  canManage,
  onClose,
}: {
  row: IncentiveRow;
  employees: EmployeeOption[];
  canManage: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return <IncentiveForm employees={employees} initial={row} onClose={onClose} />;
  }

  async function remove() {
    setError(null);
    setDeleting(true);
    const res = await deleteIncentiveAction(row.id);
    setDeleting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
    onClose();
  }

  const meta = STATUS_META[row.status];
  const prevTotal = row.prevIncremental + row.prevIncentive;
  const commissionsTotal = row.incentiveAmount + row.newSales + row.recurring;
  const bonusesTotal = row.bonusAmount + row.salesBonus;

  return (
    <div className="space-y-4">
      {error ? (
        <div role="alert" className="rounded-lg border border-negative/30 bg-negative-soft px-3 py-2 text-sm text-negative">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {row.entityId ? <Badge tone="brand">{row.entityId}</Badge> : null}
        <Badge tone={meta.tone}>{meta.label}</Badge>
        <Badge tone={row.kpiMet ? "positive" : "warning"}>{row.kpiMet ? "KPI met" : "KPI not met"}</Badge>
      </div>

      {row.incentiveBasis ? (
        <div className="rounded-xl border border-border bg-surface-muted/40 px-4 py-1">
          <BreakdownRow
            label="Sale value"
            value={<span className="font-medium">${USD.format(row.incentiveBasis.saleValueUsd)}</span>}
          />
          <BreakdownRow label="Commission rate" value={formatPercent(row.incentiveBasis.commissionPct)} />
          <BreakdownRow label="FX rate" value={`${row.incentiveBasis.fxRate} PKR/USD`} />
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-surface-muted/40 px-4 py-1">
        <BreakdownRow
          label="Incentive"
          sub={row.incentiveBasis ? "USD × % × FX" : "no USD basis"}
          value={<Money value={row.incentiveAmount} />}
        />
        <BreakdownRow label="New Sales" sub="manual" value={<Money value={row.newSales} />} />
        <BreakdownRow label="Recurring" sub="manual" value={<Money value={row.recurring} />} />
        <BreakdownRow label="Commissions" sub="always payable" value={<Money value={commissionsTotal} />} />
        <BreakdownRow label="Bonus" value={<Money value={row.bonusAmount} />} />
        <BreakdownRow label="Sales Bonus" sub="manual" value={<Money value={row.salesBonus} />} />
        <BreakdownRow label="Bonuses" sub="KPI-gated" value={<Money value={bonusesTotal} />} />
        {prevTotal > 0 ? (
          <BreakdownRow label="Carried forward" sub="prev incremental + incentive" value={<Money value={prevTotal} />} />
        ) : null}
        <BreakdownRow label="Accrued total" value={<Money value={row.accruedTotal} />} emphasis />
        <BreakdownRow
          label="Withheld"
          sub={row.status === "already_paid" ? "already paid" : row.kpiMet ? "none" : "bonuses held"}
          value={<Money value={row.withheldAmount} />}
        />
        <BreakdownRow label="Payable" value={<Money value={row.payableAmount} />} emphasis />
      </div>

      {canManage ? (
        confirmDelete ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-negative/30 bg-negative-soft px-3 py-2.5">
            <p className="text-sm font-medium text-negative">Delete this incentive? This can&rsquo;t be undone.</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="danger" disabled={deleting} onClick={remove}>
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}

function IncentiveForm({
  employees,
  initial,
  onClose,
}: {
  employees: EmployeeOption[];
  initial?: IncentiveRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState(initial?.employeeId ?? "");
  const [month, setMonth] = useState(initial?.month ?? new Date().toISOString().slice(0, 7));
  const [saleValueUsd, setSaleValueUsd] = useState(
    initial?.incentiveBasis ? String(initial.incentiveBasis.saleValueUsd) : "",
  );
  const [commissionPct, setCommissionPct] = useState(
    initial?.incentiveBasis ? String(initial.incentiveBasis.commissionPct) : "",
  );
  const [fxRate, setFxRate] = useState(initial?.incentiveBasis ? String(initial.incentiveBasis.fxRate) : "275");
  const [bonus, setBonus] = useState(initial && initial.bonusAmount ? String(initial.bonusAmount) : "");
  const [newSales, setNewSales] = useState(initial && initial.newSales ? String(initial.newSales) : "");
  const [recurring, setRecurring] = useState(initial && initial.recurring ? String(initial.recurring) : "");
  const [salesBonus, setSalesBonus] = useState(initial && initial.salesBonus ? String(initial.salesBonus) : "");
  const [kpiMet, setKpiMet] = useState(initial?.kpiMet ?? true);
  const [alreadyPaid, setAlreadyPaid] = useState(initial ? initial.status === "already_paid" : false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState(false);

  // Carried balances only exist on an already-saved row; they stay fixed on edit.
  const prevTotal = (initial?.prevIncremental ?? 0) + (initial?.prevIncentive ?? 0);

  // Live preview mirrors the server computation exactly:
  // commissions are always payable, bonuses are KPI-gated.
  const preview = useMemo(() => {
    const usd = Number(saleValueUsd) || 0;
    const pct = Number(commissionPct) || 0;
    const fx = Number(fxRate) || 0;
    const incentive = usd > 0 && pct > 0 && fx > 0 ? usd * (pct / 100) * fx : 0;
    const commissions = incentive + (Number(newSales) || 0) + (Number(recurring) || 0);
    const bonuses = (Number(bonus) || 0) + (Number(salesBonus) || 0);
    const accrued = prevTotal + commissions + bonuses;
    const payable = alreadyPaid ? 0 : kpiMet ? accrued : prevTotal + commissions;
    const withheld = accrued - payable;
    return { incentive, commissions, bonuses, accrued, payable, withheld };
  }, [saleValueUsd, commissionPct, fxRate, bonus, newSales, recurring, salesBonus, kpiMet, alreadyPaid, prevTotal]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const payload = {
      employeeId,
      month,
      saleValueUsd: Number(saleValueUsd) || 0,
      commissionPct: Number(commissionPct) || 0,
      fxRate: Number(fxRate) || 0,
      bonus: Number(bonus) || 0,
      newSales: Number(newSales) || 0,
      recurring: Number(recurring) || 0,
      salesBonus: Number(salesBonus) || 0,
      kpiMet,
      alreadyPaid,
      note: note || null,
    };
    const res = initial
      ? await updateIncentiveAction(initial.id, payload)
      : await createIncentiveAction(payload);
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
        <p className="mt-3 text-base font-semibold text-foreground">
          {initial ? "Incentive updated" : "Incentive logged"}
        </p>
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
        <Field label="Bonus (PKR)">
          <Input type="number" min={0} value={bonus} onChange={(e) => setBonus(e.target.value)} placeholder="0" />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">USD commission (optional)</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Sale value (USD)">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={saleValueUsd}
              onChange={(e) => setSaleValueUsd(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Commission %">
            <Input
              type="number"
              min={0}
              step="0.1"
              value={commissionPct}
              onChange={(e) => setCommissionPct(e.target.value)}
              placeholder="1"
            />
          </Field>
          <Field label="FX rate (PKR/USD)">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={fxRate}
              onChange={(e) => setFxRate(e.target.value)}
              placeholder="275"
            />
          </Field>
        </div>
        <p className="mt-1.5 text-xs text-subtle">
          Fill all three to derive the commission — or leave blank and enter manual amounts below.
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Manual amounts (PKR)</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="New Sales">
            <Input type="number" min={0} value={newSales} onChange={(e) => setNewSales(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Recurring">
            <Input type="number" min={0} value={recurring} onChange={(e) => setRecurring(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Sales Bonus">
            <Input type="number" min={0} value={salesBonus} onChange={(e) => setSalesBonus(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <p className="mt-1.5 text-xs text-subtle">
          New Sales and Recurring pay like commission; Sales Bonus is held with the bonus until the KPI is met.
        </p>
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
        <BreakdownRow label="Incentive" sub="USD × % × FX" value={<Money value={preview.incentive} />} />
        <BreakdownRow
          label="Commissions"
          sub="incentive + new sales + recurring"
          value={<Money value={preview.commissions} />}
        />
        <BreakdownRow label="Bonuses" sub="bonus + sales bonus" value={<Money value={preview.bonuses} />} />
        {prevTotal > 0 ? (
          <BreakdownRow label="Carried forward" sub="prev incremental + incentive" value={<Money value={prevTotal} />} />
        ) : null}
        <BreakdownRow label="Accrued total" value={<Money value={preview.accrued} />} />
        <BreakdownRow
          label="Withheld"
          sub={alreadyPaid ? "already paid" : kpiMet ? "none" : "bonuses held"}
          value={<Money value={preview.withheld} />}
        />
        <BreakdownRow label="Payable" value={<Money value={preview.payable} />} emphasis />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? (initial ? "Saving…" : "Logging…") : initial ? "Save changes" : "Log incentive"}
        </Button>
      </div>
    </form>
  );
}
