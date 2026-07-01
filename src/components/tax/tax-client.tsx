"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Landmark } from "lucide-react";
import type { PayrollRow } from "@/lib/db/payroll";
import type { EntityRow } from "@/lib/db/employees";
import { formatMonthKey } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";

const MONTHS = ["2026-04", "2026-05", "2026-06"];

export function TaxClient({
  rows,
  entities,
  month,
}: {
  rows: PayrollRow[];
  entities: EntityRow[];
  month: string;
}) {
  const router = useRouter();
  const [entity, setEntity] = useState("all");

  const active = rows.filter((r) => r.earnedGross > 0);
  const scoped = entity === "all" ? active : active.filter((r) => r.entityId === entity);

  const whtTotal = scoped.reduce((s, r) => s + r.wht, 0);
  const filers = scoped.filter((r) => r.wht > 0).length;
  const missingCnic = scoped.filter((r) => r.wht > 0 && !r.cnic).length;

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
            {MONTHS.map((m) => (
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
        <StatCard label="Total WHT" value={<Money value={whtTotal} compact />} icon={<Landmark className="h-4.5 w-4.5" />} />
        <StatCard label="Taxpayers" value={String(filers)} hint={`of ${scoped.length}`} />
        <StatCard
          label="Missing CNIC"
          value={String(missingCnic)}
          hint={missingCnic > 0 ? "blocks filing" : "all present"}
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
          dense
          emptyState={<EmptyState icon={<Landmark className="h-5 w-5" />} title="No taxpayers" description="No withholding for this month." />}
          mobileCard={(r) => (
            <Card className="p-3">
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
    </>
  );
}
