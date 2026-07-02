"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import type { PayrollRow } from "@/lib/db/payroll";
import type { EntityRow } from "@/lib/db/employees";
import { formatMonthKey, formatMonthKeyLong } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { Bar } from "@/components/ui/progress";
import { Select } from "@/components/ui/field";
import { BreakdownRow, Sheet } from "@/components/ui/sheet";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { PayslipView } from "@/components/payroll/payslip-view";

type Drill =
  | { kind: "entity"; id: "JU" | "PDC" | "B4U" | "COMBINED"; label: string }
  | { kind: "measure"; id: "gross" | "wht" | "net" }
  | { kind: "team"; name: string }
  | { kind: "payslip"; row: PayrollRow }
  | null;

export function PayrollRunClient({
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
  const scoped = entity === "all" ? rows : rows.filter((r) => r.entityId === entity);

  // Entity scopes for the four cards. The combined card also picks up staff
  // tagged to the shared JU_PDC entity.
  const forEntity = (id: string) =>
    id === "COMBINED"
      ? rows.filter((r) => r.entityId === "JU" || r.entityId === "PDC" || r.entityId === "JU_PDC")
      : rows.filter((r) => r.entityId === id);
  const net = (id: string) => forEntity(id).reduce((s, r) => s + r.net, 0);
  const count = (id: string) => forEntity(id).length;
  const grossTotal = rows.reduce((s, r) => s + r.earnedGross, 0);
  const netTotal = rows.reduce((s, r) => s + r.net, 0);
  const whtTotal = rows.reduce((s, r) => s + r.wht, 0);

  const leftInMonth = (r: PayrollRow) => !!r.lastWorkingDay && r.lastWorkingDay.slice(0, 7) === month;

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
          {leftInMonth(r) ? <p className="truncate text-xs text-warning">left {r.lastWorkingDay}</p> : null}
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

      {/* By organization — four sections, each drills into its roster */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="JU Estimation"
          value={<Money value={net("JU")} compact />}
          hint={`${count("JU")} staff`}
          onClick={() => setDrill({ kind: "entity", id: "JU", label: "JU Estimation" })}
        />
        <StatCard
          label="Pavilion (PDC)"
          value={<Money value={net("PDC")} compact />}
          hint={`${count("PDC")} staff`}
          onClick={() => setDrill({ kind: "entity", id: "PDC", label: "Pavilion (PDC)" })}
        />
        <StatCard
          label="Bed Sheet 4u"
          value={<Money value={net("B4U")} compact />}
          hint={`${count("B4U")} staff`}
          onClick={() => setDrill({ kind: "entity", id: "B4U", label: "Bed Sheet 4u" })}
        />
        <StatCard
          label="JU + PDC combined"
          value={<Money value={net("COMBINED")} compact />}
          hint={`${count("COMBINED")} staff · net disbursed`}
          onClick={() => setDrill({ kind: "entity", id: "COMBINED", label: "JU + PDC combined" })}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="This run" subtitle={formatMonthKey(month)} />
          <CardBody className="space-y-3">
            <Row label="Gross (earned)" value={<Money value={grossTotal} />} onClick={() => setDrill({ kind: "measure", id: "gross" })} />
            <Row label="Withholding tax" value={<Money value={whtTotal} />} onClick={() => setDrill({ kind: "measure", id: "wht" })} />
            <Row label="Net disbursed" value={<Money value={netTotal} />} emphasis onClick={() => setDrill({ kind: "measure", id: "net" })} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="By department" subtitle="Gross by team" />
          <CardBody className="space-y-3">
            {teams.arr.length === 0 ? (
              <p className="text-sm text-muted">No data.</p>
            ) : (
              teams.arr.map((t) => (
                <button
                  key={t.team}
                  type="button"
                  onClick={() => setDrill({ kind: "team", name: t.team })}
                  className="-mx-2 block w-full rounded-lg px-2 py-1 text-left transition-colors hover:bg-surface-muted"
                >
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted">
                      {t.team} · {t.n}
                    </span>
                    <span className="font-semibold tabular-nums text-foreground">
                      <Money value={t.gross} compact />
                    </span>
                  </div>
                  <Bar value={t.gross} max={teams.max} />
                </button>
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
          onRowClick={(r) => setDrill({ kind: "payslip", row: r })}
          dense
          emptyState={<EmptyState icon={<Wallet className="h-5 w-5" />} title="No payroll" description="No employees on payroll for this month." />}
          mobileCard={(r) => (
            <Card interactive className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.name}</p>
                  <p className="truncate text-xs text-subtle">
                    {r.code} · {r.workedDays}d
                    {leftInMonth(r) ? <span className="text-warning"> · left {r.lastWorkingDay}</span> : null}
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

      {/* Drill-down */}
      <DrillSheet drill={drill} month={month} rows={rows} scoped={scoped} onClose={() => setDrill(null)} />
    </>
  );
}

const MEASURES = {
  gross: { title: "Gross (earned)", get: (r: PayrollRow) => r.earnedGross },
  wht: { title: "Withholding tax", get: (r: PayrollRow) => r.wht },
  net: { title: "Net disbursed", get: (r: PayrollRow) => r.net },
} as const;

function DrillSheet({
  drill,
  month,
  rows,
  scoped,
  onClose,
}: {
  drill: Drill;
  month: string;
  rows: PayrollRow[];
  scoped: PayrollRow[];
  onClose: () => void;
}) {
  let title: ReactNode = "";
  let subtitle: ReactNode = formatMonthKeyLong(month);
  let width = 480;
  let body: ReactNode = null;

  if (drill?.kind === "entity") {
    const people =
      drill.id === "COMBINED"
        ? rows.filter((r) => r.entityId === "JU" || r.entityId === "PDC" || r.entityId === "JU_PDC")
        : rows.filter((r) => r.entityId === drill.id);
    title = drill.label;
    subtitle = `${people.length} staff · ${formatMonthKeyLong(month)}`;
    body = (
      <PeopleList
        people={people}
        amount={(r) => r.net}
        sub={(r) => `${r.teamName ?? "—"} · ${r.workedDays}d`}
        totalLabel="Net total"
      />
    );
  } else if (drill?.kind === "measure") {
    const measure = MEASURES[drill.id];
    const people = [...rows].sort((a, b) => measure.get(b) - measure.get(a));
    title = measure.title;
    subtitle = `By employee · ${formatMonthKeyLong(month)}`;
    body = (
      <PeopleList
        people={people}
        amount={measure.get}
        sub={(r) => r.code ?? r.designation}
        totalLabel="Total"
      />
    );
  } else if (drill?.kind === "team") {
    const people = scoped.filter((r) => (r.teamName ?? "—") === drill.name);
    title = drill.name;
    subtitle = `${people.length} employees · ${formatMonthKeyLong(month)}`;
    body = (
      <PeopleList
        people={people}
        amount={(r) => r.earnedGross}
        sub={(r) => `${r.designation} · ${r.workedDays}d`}
        totalLabel="Gross total"
      />
    );
  } else if (drill?.kind === "payslip") {
    const r = drill.row;
    title = r.name;
    subtitle = `${r.code ?? "—"} · ${formatMonthKeyLong(month)}`;
    width = 620;
    body = <PayslipView row={r} month={month} />;
  }

  return (
    <Sheet open={!!drill} onClose={onClose} title={title} subtitle={subtitle} width={width}>
      {body}
    </Sheet>
  );
}

/** Per-employee figure list with an emphasised total, used by the drill sheets. */
function PeopleList({
  people,
  amount,
  sub,
  totalLabel,
}: {
  people: PayrollRow[];
  amount: (r: PayrollRow) => number;
  sub?: (r: PayrollRow) => ReactNode;
  totalLabel: string;
}) {
  const total = people.reduce((s, r) => s + amount(r), 0);
  return (
    <div>
      {people.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No employees in this scope.</p>
      ) : (
        people.map((r) => (
          <BreakdownRow key={r.employeeId} label={r.name} sub={sub?.(r)} value={<Money value={amount(r)} />} />
        ))
      )}
      <BreakdownRow label={totalLabel} value={<Money value={total} />} emphasis />
    </div>
  );
}

function Row({
  label,
  value,
  emphasis,
  onClick,
}: {
  label: string;
  value: ReactNode;
  emphasis?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className={emphasis ? "text-sm font-medium text-foreground" : "text-sm text-muted"}>{label}</span>
      <span className={emphasis ? "text-base font-semibold text-foreground" : "text-sm font-medium tabular-nums"}>{value}</span>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`-mx-2 flex w-[calc(100%+1rem)] items-center justify-between rounded-lg px-2 py-1 text-left transition-colors hover:bg-surface-muted ${emphasis ? "border-t border-border pt-3" : ""}`}
      >
        {content}
      </button>
    );
  }
  return (
    <div className={`flex items-center justify-between ${emphasis ? "border-t border-border pt-3" : ""}`}>
      {content}
    </div>
  );
}
