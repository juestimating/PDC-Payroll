"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CalendarClock, CreditCard, Fingerprint, Landmark, Layers, Trophy, Users, Wallet } from "lucide-react";
import {
  attentionItems,
  cockpitTotals,
  costComposition,
  entityPnL,
  type EntityCode,
} from "@/lib/finance/cockpit";
import { ENTITY_META } from "@/lib/finance/seed";
import { formatMonthKeyLong, formatPKRCompact, formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Money } from "@/components/ui/money";
import { Bar } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { CHART, ComparisonBar, Donut } from "@/components/charts";

type Scope = "all" | EntityCode;

const TONE: Record<string, string> = {
  danger: CHART.negative,
  warning: CHART.accent,
  accent: CHART.info,
};

const ATT_ICON = { hold: Ban, calendar: CalendarClock, trophy: Trophy, id: Fingerprint } as const;

export default function OverviewPage() {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("all");

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
        description={`${formatMonthKeyLong("2026-05")} · group financials · ${totals.headcount} employees`}
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

      {/* Headline KPIs (entity-aware) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label={`Total cost${scope === "all" ? "" : " · " + scope}`}
          value={<Money value={totals.totalCost} compact />}
          hint="payroll + overhead"
          icon={<Layers className="h-4.5 w-4.5" />}
          accent={CHART.brand}
          onClick={() => router.push("/expenses")}
        />
        <StatCard
          label="Net disbursed"
          value={<Money value={totals.net} compact />}
          hint={`${totals.paid} paid this month`}
          icon={<Wallet className="h-4.5 w-4.5" />}
          accent={CHART.violet}
          onClick={() => router.push("/payroll")}
        />
        <StatCard
          label="Withholding tax"
          value={<Money value={totals.wht} compact />}
          hint="filed to FBR"
          icon={<Landmark className="h-4.5 w-4.5" />}
          accent={CHART.info}
          onClick={() => router.push("/tax")}
        />
        <StatCard
          label="Headcount"
          value={<span className="tabular-nums">{totals.headcount}</span>}
          hint={`${totals.paid} paid · ${totals.headcount - totals.paid} joining`}
          icon={<Users className="h-4.5 w-4.5" />}
          accent={CHART.positive}
          onClick={() => router.push("/employees")}
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
          <CardHeader title="Where the money goes" subtitle="Consolidated cost by category" />
          <CardBody>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ComparisonBar data={compBars} />
              <div className="space-y-2.5">
                {composition.map((c, i) => (
                  <div key={c.label}>
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
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Needs attention */}
      <Card className="mt-4">
        <CardHeader title="Needs attention" subtitle="What this month's close still needs from you" />
        <CardBody>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {attention.map((a) => {
              const Icon = ATT_ICON[a.icon];
              const color = TONE[a.tone];
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 transition-colors hover:bg-surface-muted"
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
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </>
  );
}
