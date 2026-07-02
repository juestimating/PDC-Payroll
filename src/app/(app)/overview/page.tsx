"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CalendarClock, CreditCard, Fingerprint, Landmark, Layers, Trophy, Users, Wallet } from "lucide-react";
import {
  attentionItems,
  cockpitTotals,
  computedRoster,
  costComposition,
  entityPnL,
  type EntityCode,
} from "@/lib/finance/cockpit";
import { allocateLine, computeFinalSettlement, ENTITY_CODES } from "@/lib/engine";
import {
  ALLOCATION_LINES,
  DATA_QUALITY,
  ENTITY_META,
  EXIT_CASES,
  INCENTIVE_SUMMARY,
  PERIOD,
  type FinanceDept,
} from "@/lib/finance/seed";
import { formatMonthKeyLong, formatPKRCompact, formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Money } from "@/components/ui/money";
import { Bar } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { BreakdownRow, Sheet } from "@/components/ui/sheet";
import { CHART, ComparisonBar, Donut } from "@/components/charts";

type Scope = "all" | EntityCode;

type Drill =
  | { kind: "kpi"; metric: "cost" | "net" | "wht" | "headcount" }
  | { kind: "composition"; label: string }
  | { kind: "attention"; id: string }
  | null;

const TONE: Record<string, string> = {
  danger: CHART.negative,
  warning: CHART.accent,
  accent: CHART.info,
};

const ATT_ICON = { hold: Ban, calendar: CalendarClock, trophy: Trophy, id: Fingerprint } as const;

/** Which roster departments sit behind each payroll-ish composition line. */
const COMPOSITION_DEPTS: Record<string, FinanceDept[]> = {
  "Sales & marketing": ["sales"],
  "Technical (estimation + design)": ["estimation", "design"],
  "Admin & HR": ["admin"],
};

export default function OverviewPage() {
  const [scope, setScope] = useState<Scope>("all");
  const [drill, setDrill] = useState<Drill>(null);

  const totals = cockpitTotals(scope === "all" ? undefined : scope);
  const entities = entityPnL();
  const composition = costComposition();
  const attention = attentionItems();
  const maxComp = Math.max(...composition.map((c) => c.value), 1);

  const scopeLabel = scope === "all" ? "all entities" : ENTITY_META[scope].label;
  const compBars = composition.map((c, i) => ({
    label: c.label.replace(/\s*\(.*\)/, ""),
    value: c.value,
    color: i === 0 ? CHART.brand : CHART.brandSoft,
  }));

  return (
    <>
      <PageHeader
        title="Overview"
        description={`${formatMonthKeyLong(PERIOD)} · group financials · ${totals.headcount} employees`}
        actions={
          <Segmented<Scope>
            value={scope}
            onChange={setScope}
            options={[
              { value: "all", label: "All" },
              { value: "JU", label: "JU" },
              { value: "PDC", label: "PDC" },
              { value: "B4U", label: "B4U" },
            ]}
          />
        }
      />

      {/* Headline KPIs (entity-aware) — click any card for the breakdown */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label={`Total cost${scope === "all" ? "" : " · " + scope}`}
          value={<Money value={totals.totalCost} compact />}
          hint="payroll + overhead"
          icon={<Layers className="h-4.5 w-4.5" />}
          accent={CHART.brand}
          onClick={() => setDrill({ kind: "kpi", metric: "cost" })}
        />
        <StatCard
          label="Net disbursed"
          value={<Money value={totals.net} compact />}
          hint={`${totals.paid} paid this month`}
          icon={<Wallet className="h-4.5 w-4.5" />}
          accent={CHART.violet}
          onClick={() => setDrill({ kind: "kpi", metric: "net" })}
        />
        <StatCard
          label="Withholding tax"
          value={<Money value={totals.wht} compact />}
          hint="filed to FBR"
          icon={<Landmark className="h-4.5 w-4.5" />}
          accent={CHART.info}
          onClick={() => setDrill({ kind: "kpi", metric: "wht" })}
        />
        <StatCard
          label="Headcount"
          value={<span className="tabular-nums">{totals.headcount}</span>}
          hint={`${totals.paid} paid · ${totals.headcount - totals.paid} joining`}
          icon={<Users className="h-4.5 w-4.5" />}
          accent={CHART.positive}
          onClick={() => setDrill({ kind: "kpi", metric: "headcount" })}
        />
      </div>

      {/* Entity P&L + composition */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Cost by entity" subtitle="JU · Pavilion Design · B4U" />
          <CardBody>
            <Donut
              data={entities.map((e) => ({ label: e.label, value: e.cost, color: e.color }))}
              centerValue={formatPKRCompact(
                scope === "all"
                  ? totals.totalCost
                  : entities.find((e) => e.entity === scope)?.cost ?? 0,
              )}
              centerLabel={scopeLabel}
            />
            <div className="mt-3 space-y-1">
              {entities.map((e) => (
                <button
                  key={e.entity}
                  onClick={() => setScope(scope === e.entity ? "all" : e.entity)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-muted ${
                    scope === e.entity ? "bg-surface-muted" : ""
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: e.color }} />
                  <span className="text-sm text-muted">{e.label}</span>
                  <span className="ml-auto text-sm font-medium tabular-nums">
                    <Money value={e.cost} compact />
                  </span>
                  <span className="w-12 shrink-0 text-right text-xs text-subtle">
                    {formatPercent(e.share * 100, 1)}
                  </span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Where the money goes" subtitle="Consolidated cost by category — click a line to drill in" />
          <CardBody>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ComparisonBar data={compBars} />
              <div className="space-y-2.5">
                {composition.map((c, i) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => setDrill({ kind: "composition", label: c.label })}
                    className="-mx-2 block w-full rounded-lg px-2 py-1 text-left transition-colors hover:bg-surface-muted"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-muted">{c.label}</span>
                      <span className="font-medium tabular-nums">
                        <Money value={c.value} compact />
                      </span>
                    </div>
                    <Bar
                      value={c.value}
                      max={maxComp}
                      color={i === 0 ? CHART.brand : CHART.brandSoft}
                      height={5}
                      className="mt-1"
                    />
                  </button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Needs attention */}
      <Card className="mt-4">
        <CardHeader title="Needs attention" subtitle="What this month's close still needs from you — click for detail" />
        <CardBody>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {attention.map((a) => {
              const Icon = ATT_ICON[a.icon];
              const color = TONE[a.tone];
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setDrill({ kind: "attention", id: a.id })}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 text-left transition-colors hover:bg-surface-muted"
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                    style={{ backgroundColor: `${color}1a`, color }}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                    <p className="truncate text-xs text-subtle">{a.detail}</p>
                  </div>
                  {a.amount !== null ? (
                    <span className="shrink-0 text-sm font-semibold tabular-nums" style={{ color }}>
                      <Money value={a.amount} compact />
                    </span>
                  ) : (
                    <CreditCard className="h-4 w-4 shrink-0 text-subtle" />
                  )}
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Drill-down */}
      <DrillSheet drill={drill} scope={scope} onClose={() => setDrill(null)} />
    </>
  );
}

// =============================================================================
// The breakdown sheet behind every clickable figure. All data comes from the
// cockpit/seed layer through the verified engines — no magic numbers.
// =============================================================================
function DrillSheet({ drill, scope, onClose }: { drill: Drill; scope: Scope; onClose: () => void }) {
  const router = useRouter();

  const roster = computedRoster();
  const scoped = scope === "all" ? roster : roster.filter((r) => r.emp.entity === scope);
  const totals = cockpitTotals(scope === "all" ? undefined : scope);
  const entities = entityPnL();
  const grand = entities.reduce((s, e) => s + e.cost, 0);
  const scopeLabel = scope === "all" ? "All entities" : ENTITY_META[scope].label;

  const pageLink = (href: string, label: string) => (
    <button
      type="button"
      onClick={() => router.push(href)}
      className="text-sm font-medium text-brand-600 hover:underline"
    >
      Open {label} →
    </button>
  );

  let title: React.ReactNode = "";
  let subtitle: React.ReactNode = formatMonthKeyLong(PERIOD);
  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;

  if (drill?.kind === "kpi" && drill.metric === "cost") {
    title = "Total cost";
    subtitle = `${formatMonthKeyLong(PERIOD)} · payroll + overhead`;
    body = (
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">Where the money goes</p>
        {costComposition().map((c) => (
          <BreakdownRow
            key={c.label}
            label={c.label}
            sub={`${formatPercent((c.value / grand) * 100, 1)} of total`}
            value={<Money value={c.value} />}
          />
        ))}
        <p className="mb-1 mt-5 text-xs font-semibold uppercase tracking-wide text-subtle">By entity</p>
        {entities.map((e) => (
          <BreakdownRow
            key={e.entity}
            accent={e.color}
            label={e.label}
            sub={`${e.headcount} employees`}
            value={<Money value={e.cost} />}
          />
        ))}
        <BreakdownRow label="Total cost" value={<Money value={grand} />} emphasis />
      </div>
    );
    footer = pageLink("/expenses", "expenses");
  } else if (drill?.kind === "kpi" && drill.metric === "net") {
    const rows = scoped.filter((r) => r.comp.net > 0).sort((a, b) => b.comp.net - a.comp.net);
    title = "Net disbursed";
    subtitle = `${scopeLabel} · ${totals.paid} paid`;
    body = (
      <div>
        {rows.map((r, i) => (
          <BreakdownRow
            key={`${r.emp.name}-${i}`}
            label={r.emp.name}
            sub={`${r.emp.designation} · ${r.emp.entity}`}
            value={<Money value={r.comp.net} />}
          />
        ))}
        <BreakdownRow label="Net disbursed" value={<Money value={totals.net} />} emphasis />
      </div>
    );
    footer = pageLink("/payroll", "payroll");
  } else if (drill?.kind === "kpi" && drill.metric === "wht") {
    const rows = scoped
      .filter((r) => r.comp.withholdingTax > 0)
      .sort((a, b) => b.comp.withholdingTax - a.comp.withholdingTax);
    title = "Withholding tax";
    subtitle = `${scopeLabel} · filed to FBR`;
    body = (
      <div>
        {rows.map((r, i) => (
          <BreakdownRow
            key={`${r.emp.name}-${i}`}
            label={r.emp.name}
            sub={`${r.emp.designation} · ${r.emp.entity}`}
            value={<Money value={r.comp.withholdingTax} />}
          />
        ))}
        <BreakdownRow label="Total WHT" value={<Money value={totals.wht} />} emphasis />
        <p className="mt-4 text-xs text-subtle">
          Only employees above the FBR taxable threshold are withheld — the rest carry no WHT.
        </p>
      </div>
    );
    footer = pageLink("/tax", "tax");
  } else if (drill?.kind === "kpi" && drill.metric === "headcount") {
    const paid = scoped.filter((r) => r.comp.days > 0);
    const joining = scoped.filter((r) => r.comp.days === 0);
    title = "Headcount";
    subtitle = `${scopeLabel} · ${totals.headcount} employees`;
    body = (
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">
          Paid this month · {paid.length}
        </p>
        <div className="divide-y divide-border/70">
          {paid.map((r, i) => (
            <NameRow key={`${r.emp.name}-${i}`} name={r.emp.name} sub={r.emp.designation} tag={r.emp.entity} />
          ))}
        </div>
        {joining.length > 0 ? (
          <>
            <p className="mb-1 mt-5 text-xs font-semibold uppercase tracking-wide text-subtle">
              Joining · not yet paid · {joining.length}
            </p>
            <div className="divide-y divide-border/70">
              {joining.map((r, i) => (
                <NameRow key={`${r.emp.name}-${i}`} name={r.emp.name} sub={r.emp.designation} tag={r.emp.entity} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    );
    footer = pageLink("/employees", "employees");
  } else if (drill?.kind === "composition") {
    const line = ALLOCATION_LINES.find((l) => l.label === drill.label);
    title = drill.label;
    subtitle = `${formatMonthKeyLong(PERIOD)} · consolidated`;
    if (line) {
      const alloc = allocateLine(line);
      const depts = COMPOSITION_DEPTS[line.label];
      const empRows = depts
        ? roster
            .filter((r) => depts.includes(r.emp.department))
            .sort((a, b) => b.comp.gross - a.comp.gross)
        : [];
      body = (
        <div>
          <BreakdownRow
            label="Line total"
            sub={`${formatPercent((line.amount / grand) * 100, 1)} of total cost`}
            value={<Money value={line.amount} />}
          />
          <p className="mb-1 mt-5 text-xs font-semibold uppercase tracking-wide text-subtle">Entity split</p>
          {ENTITY_CODES.filter((e) => alloc.split[e] !== 0).map((e) => (
            <BreakdownRow
              key={e}
              accent={ENTITY_META[e].color}
              label={ENTITY_META[e].label}
              value={<Money value={alloc.split[e]} />}
            />
          ))}
          {empRows.length > 0 ? (
            <>
              <p className="mb-1 mt-5 text-xs font-semibold uppercase tracking-wide text-subtle">
                Per employee (gross)
              </p>
              {empRows.map((r, i) => (
                <BreakdownRow
                  key={`${r.emp.name}-${i}`}
                  label={r.emp.name}
                  sub={`${r.emp.designation} · ${r.emp.entity}`}
                  value={<Money value={r.comp.gross} />}
                />
              ))}
            </>
          ) : null}
        </div>
      );
    }
  } else if (drill?.kind === "attention") {
    const item = attentionItems().find((a) => a.id === drill.id);
    title = item?.title ?? "";
    subtitle = item?.detail ?? "";
    if (drill.id === "held" || drill.id === "scheduled") {
      const wanted = drill.id;
      const cases = EXIT_CASES.map((c) => ({ c, s: computeFinalSettlement(c) })).filter(
        (x) => x.s.status === wanted,
      );
      body = (
        <div>
          {cases.map(({ c, s }) => (
            <BreakdownRow
              key={c.name}
              label={c.name}
              sub={
                wanted === "held"
                  ? `${c.exitReason === "ghosted" ? "Ghosted" : "Notice not served"} · left ${c.leftOn}`
                  : `Notice served · releases ${s.releaseDate}`
              }
              value={<Money value={s.net} />}
            />
          ))}
          <BreakdownRow
            label={wanted === "held" ? "Total held" : "Total due"}
            value={<Money value={cases.reduce((t, x) => t + x.s.net, 0)} />}
            emphasis
          />
          <p className="mt-4 text-xs text-subtle">
            {wanted === "held"
              ? "Held pay is retained as a reference of what would have been owed — it is not released."
              : "Scheduled settlements release on the 20th of the month after the exit."}
          </p>
        </div>
      );
    } else if (drill.id === "kpi-held") {
      body = (
        <div>
          <BreakdownRow label="Accrued" value={<Money value={INCENTIVE_SUMMARY.accrued} />} />
          <BreakdownRow label="Payable" value={<Money value={INCENTIVE_SUMMARY.payable} />} />
          <BreakdownRow label="Already paid" value={<Money value={INCENTIVE_SUMMARY.alreadyPaid} />} />
          <BreakdownRow
            label={`Withheld · ${INCENTIVE_SUMMARY.heldCount} bonuses`}
            value={<Money value={INCENTIVE_SUMMARY.withheld} />}
            emphasis
          />
          <p className="mt-4 text-xs text-subtle">
            Withheld bonuses stay pending until the manager's KPI review clears them.
          </p>
        </div>
      );
    } else if (drill.id === "cnic") {
      body = (
        <div>
          <BreakdownRow
            label="Employees missing CNIC"
            value={<span className="font-semibold tabular-nums">{DATA_QUALITY.missingCnic}</span>}
            emphasis
          />
          <p className="mt-4 text-xs text-subtle">
            CNIC is required on the FBR withholding statement — filing stays blocked until these are
            captured on the People page.
          </p>
        </div>
      );
    }
  }

  return (
    <Sheet open={!!drill} onClose={onClose} title={title} subtitle={subtitle} footer={footer}>
      {body}
    </Sheet>
  );
}

/** A light name row for the headcount lists. */
function NameRow({ name, sub, tag }: { name: string; sub: string; tag: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="truncate text-xs text-subtle">{sub}</p>
      </div>
      <span className="shrink-0 text-xs text-subtle">{tag}</span>
    </div>
  );
}
