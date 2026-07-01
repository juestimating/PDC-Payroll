"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, TrendingUp } from "lucide-react";
import type { IncrementRow, EmployeeOption } from "@/lib/db/increments";
import { applyIncrementAction } from "@/app/(app)/increments/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { Sheet, BreakdownRow } from "@/components/ui/sheet";

const COMPONENTS = [
  { key: "basic", label: "Basic", pct: 0.65 },
  { key: "medical", label: "Medical", pct: 0.1 },
  { key: "travel", label: "Travel", pct: 0.1 },
  { key: "other", label: "Other", pct: 0.15 },
] as const;

export function IncrementsClient({
  increments,
  employees,
  canManage,
}: {
  increments: IncrementRow[];
  employees: EmployeeOption[];
  canManage: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);

  const columns: Column<IncrementRow>[] = [
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
      key: "date",
      header: "Date",
      hideOnMobile: true,
      cell: (r) => <span className="text-sm text-muted">{r.date}</span>,
    },
    {
      key: "change",
      header: "Gross salary",
      align: "right",
      cell: (r) => (
        <span className="text-sm tabular-nums text-muted">
          <Money value={r.oldSalary} compact symbol={false} /> →{" "}
          <span className="font-medium text-foreground">
            <Money value={r.newSalary} compact symbol={false} />
          </span>
        </span>
      ),
    },
    {
      key: "pct",
      header: "%",
      align: "right",
      cell: (r) => {
        const pct = r.percent ?? (r.oldSalary ? ((r.newSalary - r.oldSalary) / r.oldSalary) * 100 : 0);
        return (
          <span className="rounded bg-positive-soft px-1.5 py-0.5 text-[11px] font-semibold text-positive">
            +{pct.toFixed(1)}%
          </span>
        );
      },
    },
    {
      key: "reason",
      header: "Reason",
      hideOnMobile: true,
      cell: (r) => <span className="text-sm text-muted">{r.reason ?? "—"}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Increments"
        description="Give a % on gross — split across all components."
        actions={
          canManage ? (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Give increment
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Increments"
          value={String(increments.length)}
          hint="applied to date"
          icon={<TrendingUp className="h-4.5 w-4.5" />}
        />
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-positive-soft bg-positive-soft px-4 py-2.5 text-sm text-positive">
        <TrendingUp className="h-4 w-4" />
        Applying an increment updates the employee&apos;s salary — the next payroll run recalculates from it.
      </div>

      <Card className="mt-4 overflow-hidden">
        <DataTable
          columns={columns}
          rows={increments}
          getRowKey={(r) => r.id}
          dense
          emptyState={
            <EmptyState
              icon={<TrendingUp className="h-5 w-5" />}
              title="No increments yet"
              description={
                canManage ? "Give an increment and it instantly reflects in payroll." : "Nothing here yet."
              }
            />
          }
          mobileCard={(r) => {
            const pct = r.percent ?? (r.oldSalary ? ((r.newSalary - r.oldSalary) / r.oldSalary) * 100 : 0);
            return (
              <Card className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{r.employeeName}</p>
                    <p className="truncate text-xs text-subtle">
                      {r.date} · {r.reason ?? "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm tabular-nums text-muted">
                      <Money value={r.newSalary} compact symbol={false} />
                    </p>
                    <span className="text-xs font-semibold text-positive">+{pct.toFixed(1)}%</span>
                  </div>
                </div>
              </Card>
            );
          }}
        />
      </Card>

      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Give increment"
        subtitle="% on gross, split across components"
        width={480}
      >
        <IncrementForm employees={employees} onClose={() => setAddOpen(false)} />
      </Sheet>
    </>
  );
}

function IncrementForm({ employees, onClose }: { employees: EmployeeOption[]; onClose: () => void }) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [kind, setKind] = useState<"percent" | "absolute">("percent");
  const [percent, setPercent] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState(false);

  const preview = useMemo(() => {
    const emp = employees.find((e) => e.id === employeeId);
    const oldGross = emp?.salary ?? 0;
    const newGross =
      kind === "percent"
        ? oldGross * (1 + (Number(percent) || 0) / 100)
        : oldGross + (Number(amount) || 0);
    return { oldGross, newGross };
  }, [employees, employeeId, kind, percent, amount]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await applyIncrementAction({
      employeeId,
      kind,
      percent: kind === "percent" ? Number(percent) || 0 : null,
      amount: kind === "absolute" ? Number(amount) || 0 : null,
      reason,
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
        <p className="mt-3 text-base font-semibold text-foreground">Increment applied</p>
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
        <Field label="Kind" required>
          <Select value={kind} onChange={(e) => setKind(e.target.value as "percent" | "absolute")}>
            <option value="percent">Percent of gross</option>
            <option value="absolute">Absolute amount</option>
          </Select>
        </Field>
        {kind === "percent" ? (
          <Field label="Percent (%)" required>
            <Input
              type="number"
              min={0}
              step="0.1"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              placeholder="0"
              required
            />
          </Field>
        ) : (
          <Field label="Amount (PKR)" required>
            <Input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              required
            />
          </Field>
        )}
      </div>

      <Field label="Reason" required>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Annual review increment"
          required
        />
      </Field>

      <div className="rounded-xl border border-border bg-surface-muted p-4">
        <BreakdownRow
          label="New gross"
          sub={<>from <Money value={preview.oldGross} symbol={false} /></>}
          value={<Money value={preview.newGross} />}
          emphasis
        />
        {COMPONENTS.map((c) => (
          <BreakdownRow
            key={c.key}
            label={c.label}
            sub={`${Math.round(c.pct * 100)}%`}
            value={<Money value={preview.newGross * c.pct} />}
          />
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Applying…" : "Give increment"}
        </Button>
      </div>
    </form>
  );
}
