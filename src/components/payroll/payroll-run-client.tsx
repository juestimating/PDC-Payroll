"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import type { PayrollRow } from "@/lib/db/payroll";
import type { EntityRow } from "@/lib/db/employees";
import { formatMonthKey } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { Bar } from "@/components/ui/progress";
import { Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";

const MONTHS = ["2026-04", "2026-05", "2026-06"];

export function PayrollRunClient({
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

  const scoped = entity === "all" ? rows : rows.filter((r) => r.entityId === entity);

  const net = (id: string) => rows.filter((r) => r.entityId === id).reduce((s, r) => s + r.net, 0);
  const count = (id: string) => rows.filter((r) => r.entityId === id).length;
  const juNet = net("JU");
  const pdcNet = net("PDC");
  const b4uNet = net("B4U");
  const grossTotal = rows.reduce((s, r) => s + r.earnedGross, 0);
  const netTotal = rows.reduce((s, r) => s + r.net, 0);
  const whtTotal = rows.reduce((s, r) => s + r.wht, 0);

  const teams = useMemo(() => {
    const m = new Map<string, { gross: number; net: number; n: number }>();
    for (const r of scoped) {
      const k = r.teamName ?? "—";
      const e = m.get(k) ?? { gross: 0, net: 0, n: 0 };
      e.gross += r.earnedGross;
      e.net += r.net;
      e.n += 1;
      m.set(k, e);
    }
    const arr = [...m.entries()].map(([team, v]) => ({ team, ...v })).sort((a, b) => b.gross - a.gross);
    return { arr, max: Math.max(1, ...arr.map((a) => a.gross)) };
  }, [scoped]);

  const columns: Column<PayrollRow>[] = [
    { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs text-muted">{r.code ?? "—"}</span> },
    {
      key: "emp",
      header: "Employee",
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{r.name}</p>
          <p className="truncate text-xs text-subtle">{r.designation}</p>
        </div>
      ),
    },
    { key: "entity", header: "Co.", hideOnMobile: true, cell: (r) => (r.entityId ? <Badge tone="brand">{r.entityId}</Badge> : <span className="text-subtle">—</span>) },
    { key: "days", header: "Days", align: "center", hideOnMobile: true, cell: (r) => <span className="text-sm tabular-nums">{r.workedDays}</span> },
    { key: "gross", header: "Gross", align: "right", cell: (r) => <Money value={r.earnedGross} /> },
    { key: "wht", header: "Tax", align: "right", hideOnMobile: true, cell: (r) => <Money value={r.wht} /> },
    {
      key: "ded",
      header: "Deductions",
      align: "right",
      hideOnMobile: true,
      cell: (r) => {
        const d = r.advance + r.loanInstallment;
        return d > 0 ? <span className="text-negative"><Money value={d} /></span> : <span className="text-subtle">—</span>;
      },
    },
    { key: "net", header: "Net", align: "right", cell: (r) => <span className="font-semibold"><Money value={r.net} /></span> },
  ];

  return (
    <>
      <PageHeader
        title="Payroll Run"
        description={`Monthly close · earned-salary basis · ${scoped.length} employees`}
        actions={
          <Select value={month} onChange={(e) => router.push(`/payroll?month=${e.target.value}`)} className="w-40">
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

      {/* By organization — four sections */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="JU Estimation" value={<Money value={juNet} compact />} hint={`${count("JU")} staff`} />
        <StatCard label="Pavilion (PDC)" value={<Money value={pdcNet} compact />} hint={`${count("PDC")} staff`} />
        <StatCard label="Bed Sheet 4u" value={<Money value={b4uNet} compact />} hint={`${count("B4U")} staff`} />
        <StatCard label="JU + PDC combined" value={<Money value={juNet + pdcNet} compact />} hint="net disbursed" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="This run" subtitle={formatMonthKey(month)} />
          <CardBody className="space-y-3">
            <Row label="Gross (earned)" value={<Money value={grossTotal} />} />
            <Row label="Withholding tax" value={<Money value={whtTotal} />} />
            <Row label="Net disbursed" value={<Money value={netTotal} />} emphasis />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="By department" subtitle="Gross by team" />
          <CardBody className="space-y-3">
            {teams.arr.length === 0 ? (
              <p className="text-sm text-muted">No data.</p>
            ) : (
              teams.arr.map((t) => (
                <div key={t.team}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted">
                      {t.team} · {t.n}
                    </span>
                    <span className="font-semibold tabular-nums text-foreground">
                      <Money value={t.gross} compact />
                    </span>
                  </div>
                  <Bar value={t.gross} max={teams.max} />
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <DataTable
          columns={columns}
          rows={scoped}
          getRowKey={(r) => r.employeeId}
          dense
          emptyState={<EmptyState icon={<Wallet className="h-5 w-5" />} title="No payroll" description="No active employees for this month." />}
          mobileCard={(r) => (
            <Card className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.name}</p>
                  <p className="truncate text-xs text-subtle">
                    {r.code} · {r.workedDays}d
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">
                  <Money value={r.net} compact />
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Badge tone="brand">{r.entityId ?? "—"}</Badge>
                <span className="ml-auto text-xs text-subtle">
                  gross <Money value={r.earnedGross} compact />
                </span>
              </div>
            </Card>
          )}
        />
      </Card>
    </>
  );
}

function Row({ label, value, emphasis }: { label: string; value: ReactNode; emphasis?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${emphasis ? "border-t border-border pt-3" : ""}`}>
      <span className={emphasis ? "text-sm font-medium text-foreground" : "text-sm text-muted"}>{label}</span>
      <span className={emphasis ? "text-base font-semibold text-foreground" : "text-sm font-medium tabular-nums"}>{value}</span>
    </div>
  );
}
