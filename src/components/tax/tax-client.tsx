"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Landmark } from "lucide-react";
import type { PayrollRow } from "@/lib/db/payroll";
import type { EntityRow } from "@/lib/db/employees";
import { formatMonthKey, formatMonthKeyLong } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { BreakdownRow, Sheet } from "@/components/ui/sheet";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";

type Drill =
  | { kind: "wht" }
  | { kind: "payers" }
  | { kind: "missing" }
  | { kind: "employee"; row: PayrollRow }
  | null;

export function TaxClient({
  rows,
  entities,
  month,
  months,
}: {
  rows: PayrollRow[];
  entities: EntityRow[];
  month: string;
  months: string[];
}) {
  const router = useRouter();
  const [entity, setEntity] = useState("all");
  const [drill, setDrill] = useState<Drill>(null);

  const monthOptions = months.includes(month) ? months : [month, ...months];

  const active = rows.filter((r) => r.earnedGross > 0);
  const scoped = entity === "all" ? active : active.filter((r) => r.entityId === entity);

  const payers = scoped.filter((r) => r.wht > 0);
  const noCnic = payers.filter((r) => !r.cnic);
  const whtTotal = scoped.reduce((s, r) => s + r.wht, 0);
  const filers = payers.length;
  const missingCnic = noCnic.length;

  const columns: Column<PayrollRow>[] = [
    { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs text-muted">{r.code ?? "—"}</span> },
    {
      key: "emp",
      header: "Employee",
      cell: (r) => <span className="font-medium text-foreground">{r.name}</span>,
    },
    {
      key: "cnic",
      header: "CNIC",
      hideOnMobile: true,
      cell: (r) =>
        r.cnic ? (
          <span className="font-mono text-xs text-muted">{r.cnic}</span>
        ) : (
          <Badge tone="warning">missing</Badge>
        ),
    },
    { key: "entity", header: "Co.", hideOnMobile: true, cell: (r) => (r.entityId ? <Badge tone="brand">{r.entityId}</Badge> : <span className="text-subtle">—</span>) },
    { key: "taxable", header: "Taxable", align: "right", hideOnMobile: true, cell: (r) => <Money value={r.taxable} /> },
    { key: "wht", header: "WHT", align: "right", cell: (r) => (r.wht > 0 ? <span className="font-semibold"><Money value={r.wht} /></span> : <span className="text-subtle">—</span>) },
  ];

  return (
    <>
      <PageHeader
        title="Tax & Compliance"
        description={`FBR withholding register · earned-salary basis · ${formatMonthKey(month)}`}
        actions={
          <Select value={month} onChange={(e) => router.push(`/tax?month=${e.target.value}`)} className="w-40">
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {formatMonthKey(m)}
              </option>
            ))}
          </Select>
        }
      >
        <Select value={entity} onChange={(e) => setEntity(e.target.value)} className="sm:w-44">
          <option value="all">All companies</option>
          {entities.map((en) => (
            <option key={en.id} value={en.id}>
              {en.name}
            </option>
          ))}
        </Select>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total WHT"
          value={<Money value={whtTotal} compact />}
          icon={<Landmark className="h-4.5 w-4.5" />}
          onClick={() => setDrill({ kind: "wht" })}
        />
        <StatCard
          label="Taxpayers"
          value={String(filers)}
          hint={`of ${scoped.length}`}
          onClick={() => setDrill({ kind: "payers" })}
        />
        <StatCard
          label="Missing CNIC"
          value={String(missingCnic)}
          hint={missingCnic > 0 ? "blocks filing" : "all present"}
          onClick={() => setDrill({ kind: "missing" })}
        />
      </div>

      {missingCnic > 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {missingCnic} taxpayer{missingCnic === 1 ? "" : "s"} with withholding are missing a CNIC — add it before filing.
        </div>
      ) : null}

      <Card className="mt-4 overflow-hidden">
        <DataTable
          columns={columns}
          rows={scoped}
          getRowKey={(r) => r.employeeId}
          onRowClick={(r) => setDrill({ kind: "employee", row: r })}
          dense
          emptyState={<EmptyState icon={<Landmark className="h-5 w-5" />} title="No taxpayers" description="No withholding for this month." />}
          mobileCard={(r) => (
            <Card interactive className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.name}</p>
                  <p className="truncate text-xs text-subtle">{r.cnic ?? "CNIC missing"}</p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">
                  <Money value={r.wht} compact />
                </span>
              </div>
            </Card>
          )}
        />
      </Card>

      {/* Drill-down */}
      <TaxDrillSheet
        drill={drill}
        month={month}
        scoped={scoped}
        payers={payers}
        noCnic={noCnic}
        whtTotal={whtTotal}
        onClose={() => setDrill(null)}
      />
    </>
  );
}

function TaxDrillSheet({
  drill,
  month,
  scoped,
  payers,
  noCnic,
  whtTotal,
  onClose,
}: {
  drill: Drill;
  month: string;
  scoped: PayrollRow[];
  payers: PayrollRow[];
  noCnic: PayrollRow[];
  whtTotal: number;
  onClose: () => void;
}) {
  let title: ReactNode = "";
  let subtitle: ReactNode = formatMonthKeyLong(month);
  let body: ReactNode = null;

  if (drill?.kind === "wht") {
    const sorted = [...payers].sort((a, b) => b.wht - a.wht);
    title = "Total WHT";
    subtitle = `By employee · ${formatMonthKeyLong(month)}`;
    body = (
      <div>
        {sorted.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No withholding this month.</p>
        ) : (
          sorted.map((r) => (
            <BreakdownRow key={r.employeeId} label={r.name} sub={r.code ?? "—"} value={<Money value={r.wht} />} />
          ))
        )}
        <BreakdownRow label="Total WHT" value={<Money value={whtTotal} />} emphasis />
      </div>
    );
  } else if (drill?.kind === "payers") {
    title = "Taxpayers";
    subtitle = `${payers.length} of ${scoped.length} employees · ${formatMonthKeyLong(month)}`;
    body = (
      <div>
        {payers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No taxpayers this month.</p>
        ) : (
          payers.map((r) => (
            <BreakdownRow
              key={r.employeeId}
              label={r.name}
              sub={`${r.code ?? "—"} · ${r.cnic ?? "CNIC missing"}`}
              value={<Money value={r.wht} />}
            />
          ))
        )}
        <BreakdownRow label="Total WHT" value={<Money value={payers.reduce((s, r) => s + r.wht, 0)} />} emphasis />
      </div>
    );
  } else if (drill?.kind === "missing") {
    title = "Missing CNIC";
    subtitle = `${noCnic.length} taxpayer${noCnic.length === 1 ? "" : "s"} · ${formatMonthKeyLong(month)}`;
    body = (
      <div>
        {noCnic.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">All taxpayers have a CNIC on file.</p>
        ) : (
          <>
            {noCnic.map((r) => (
              <BreakdownRow
                key={r.employeeId}
                label={r.name}
                sub={r.code ?? "no code"}
                value={<Badge tone="warning">no CNIC</Badge>}
              />
            ))}
            <p className="mt-4 text-xs text-subtle">
              Withholding cannot be filed without a CNIC — add it on each employee&apos;s profile.
            </p>
          </>
        )}
      </div>
    );
  } else if (drill?.kind === "employee") {
    const r = drill.row;
    title = r.name;
    subtitle = `${r.code ?? "—"} · ${formatMonthKeyLong(month)}`;
    body = (
      <div>
        <BreakdownRow label="Full-month salary" value={<Money value={r.salary} />} sub="Contract gross (D)" />
        <BreakdownRow
          label="Earned gross"
          value={<Money value={r.earnedGross} />}
          sub={`${r.workedDays} / 30 days worked${r.lastWorkingDay && r.lastWorkingDay.slice(0, 7) === month ? ` · left ${r.lastWorkingDay}` : ""}`}
        />
        <BreakdownRow
          label="Medical exempt"
          value={<Money value={-(r.earnedGross - r.taxable)} />}
          sub="10/110 of earned salary, tax-free"
        />
        <BreakdownRow label="Monthly taxable" value={<Money value={r.taxable} />} sub="Earned − medical" />
        <BreakdownRow label="Annualized taxable" value={<Money value={r.taxable * 12} />} sub="× 12" />
        <BreakdownRow label="Annual tax" value={<Money value={r.wht * 12} />} sub="FBR 2025-26 salaried slabs" />
        <BreakdownRow label="Monthly WHT" value={<Money value={r.wht} />} sub="Annual tax ÷ 12" emphasis />
      </div>
    );
  }

  return (
    <Sheet open={!!drill} onClose={onClose} title={title} subtitle={subtitle}>
      {body}
    </Sheet>
  );
}
