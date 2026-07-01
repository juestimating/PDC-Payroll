"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, Plus } from "lucide-react";
import type { DbExpense, ExpenseCategory } from "@/lib/db/expenses";
import type { EntityRow } from "@/lib/db/employees";
import { createExpenseAction } from "@/app/(app)/expenses/actions";
import { formatMonthKey } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { Bar } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { Sheet } from "@/components/ui/sheet";

export function ExpensesClient({
  expenses,
  categories,
  entities,
  canManage,
}: {
  expenses: DbExpense[];
  categories: ExpenseCategory[];
  entities: EntityRow[];
  canManage: boolean;
}) {
  const [entity, setEntity] = useState("all");
  const [month, setMonth] = useState("all");
  const [type, setType] = useState("all");
  const [addOpen, setAddOpen] = useState(false);

  const months = useMemo(
    () => [...new Set(expenses.map((e) => e.month))].sort((a, b) => b.localeCompare(a)),
    [expenses],
  );

  // Month-scoped set drives the entity sections; entity + type filter the table.
  const monthScoped = useMemo(
    () => (month === "all" ? expenses : expenses.filter((e) => e.month === month)),
    [expenses, month],
  );

  const byEntity = (id: string) =>
    monthScoped.filter((e) => e.entityId === id).reduce((s, e) => s + e.amount, 0);
  const ju = byEntity("JU");
  const pdc = byEntity("PDC");
  const b4u = byEntity("B4U");
  const total = monthScoped.reduce((s, e) => s + e.amount, 0);
  const fixedTotal = monthScoped.filter((e) => e.isFixed).reduce((s, e) => s + e.amount, 0);

  const rows = useMemo(
    () =>
      monthScoped.filter((e) => {
        if (entity !== "all" && e.entityId !== entity) return false;
        if (type === "fixed" && !e.isFixed) return false;
        if (type === "variable" && e.isFixed) return false;
        return true;
      }),
    [monthScoped, entity, type],
  );

  const trend = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) m.set(e.month, (m.get(e.month) ?? 0) + e.amount);
    const arr = [...m.entries()].map(([mo, v]) => ({ month: mo, total: v })).sort((a, b) => a.month.localeCompare(b.month));
    const max = Math.max(1, ...arr.map((a) => a.total));
    return { arr, max };
  }, [expenses]);

  const columns: Column<DbExpense>[] = [
    {
      key: "entity",
      header: "Co.",
      cell: (e) => (e.entityId ? <Badge tone="brand">{e.entityId}</Badge> : <span className="text-subtle">—</span>),
    },
    { key: "label", header: "Expense", cell: (e) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{e.label}</p>
        {e.description ? <p className="truncate text-xs text-subtle">{e.description}</p> : null}
      </div>
    ) },
    { key: "category", header: "Category", hideOnMobile: true, cell: (e) => <span className="text-sm text-muted">{e.categoryName ?? "—"}</span> },
    {
      key: "type",
      header: "Type",
      align: "center",
      hideOnMobile: true,
      cell: (e) => <Badge tone={e.isFixed ? "info" : "neutral"}>{e.isFixed ? "Fixed" : "Variable"}</Badge>,
    },
    { key: "month", header: "Month", hideOnMobile: true, cell: (e) => <span className="text-sm text-muted">{formatMonthKey(e.month)}</span> },
    { key: "amount", header: "Amount", align: "right", cell: (e) => <Money value={e.amount} /> },
  ];

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Company costs across JU, PDC, and B4U — fixed and variable."
        actions={
          canManage ? (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add expense
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={month} onChange={(e) => setMonth(e.target.value)} className="sm:w-44">
            <option value="all">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonthKey(m)}
              </option>
            ))}
          </Select>
          <Select value={entity} onChange={(e) => setEntity(e.target.value)} className="sm:w-40">
            <option value="all">All companies</option>
            {entities.map((en) => (
              <option key={en.id} value={en.id}>
                {en.name}
              </option>
            ))}
          </Select>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="sm:w-36">
            <option value="all">All types</option>
            <option value="fixed">Fixed</option>
            <option value="variable">Variable</option>
          </Select>
        </div>
      </PageHeader>

      {/* Four entity sections: JU / PDC / B4U / JU+PDC combined */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="JU Estimation" value={<Money value={ju} compact />} hint={pct(ju, total)} />
        <StatCard label="Pavilion (PDC)" value={<Money value={pdc} compact />} hint={pct(pdc, total)} />
        <StatCard label="Bed Sheet 4u" value={<Money value={b4u} compact />} hint={pct(b4u, total)} />
        <StatCard label="JU + PDC combined" value={<Money value={ju + pdc} compact />} hint="shared book" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Monthly trend */}
        <Card className="lg:col-span-1">
          <CardHeader title="Monthly spend" subtitle={`Total ${money(total)}${month === "all" ? "" : " · " + formatMonthKey(month)}`} />
          <CardBody className="space-y-3">
            {trend.arr.length === 0 ? (
              <p className="text-sm text-muted">No expenses yet.</p>
            ) : (
              trend.arr.map((t) => (
                <div key={t.month}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted">{formatMonthKey(t.month)}</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      <Money value={t.total} compact />
                    </span>
                  </div>
                  <Bar value={t.total} max={trend.max} />
                </div>
              ))
            )}
            <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
              <span className="text-muted">Fixed / Variable</span>
              <span className="font-medium tabular-nums text-foreground">
                <Money value={fixedTotal} compact /> · <Money value={total - fixedTotal} compact />
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Ledger */}
        <Card className="overflow-hidden lg:col-span-2">
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(e) => e.id}
            dense
            emptyState={
              <EmptyState
                icon={<CreditCard className="h-5 w-5" />}
                title="No expenses"
                description="Adjust the filters or add an expense."
              />
            }
            mobileCard={(e) => (
              <Card className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-medium text-foreground">{e.label}</p>
                  <span className="shrink-0 font-semibold tabular-nums">
                    <Money value={e.amount} compact />
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge tone="brand">{e.entityId ?? "—"}</Badge>
                  <Badge tone={e.isFixed ? "info" : "neutral"}>{e.isFixed ? "Fixed" : "Variable"}</Badge>
                  <span className="ml-auto text-xs text-subtle">{formatMonthKey(e.month)}</span>
                </div>
              </Card>
            )}
          />
        </Card>
      </div>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add expense" subtitle="Company cost" width={520}>
        <ExpenseForm categories={categories} entities={entities} defaultMonth={months[0] ?? "2026-05"} onClose={() => setAddOpen(false)} />
      </Sheet>
    </>
  );
}

function ExpenseForm({
  categories,
  entities,
  defaultMonth,
  onClose,
}: {
  categories: ExpenseCategory[];
  entities: EntityRow[];
  defaultMonth: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [entityId, setEntityId] = useState(entities.find((e) => e.id === "JU")?.id ?? entities[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [month, setMonth] = useState(defaultMonth);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState(false);

  const category = categories.find((c) => c.id === categoryId);
  const needsDetail = !!category?.requiresDetail;

  const fixed = categories.filter((c) => c.kind === "fixed");
  const variable = categories.filter((c) => c.kind === "variable");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await createExpenseAction({
      month,
      entityId,
      categoryId,
      label,
      description: needsDetail ? description : description || null,
      amount: Number(amount) || 0,
      vendor: vendor || null,
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
        <p className="mt-3 text-base font-semibold text-foreground">Expense added</p>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Company" required>
          <Select value={entityId} onChange={(e) => setEntityId(e.target.value)}>
            {entities.map((en) => (
              <option key={en.id} value={en.id}>
                {en.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Month" required>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} required />
        </Field>
      </div>

      <Field label="Category" required>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <optgroup label="Fixed">
            {fixed.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Variable">
            {variable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        </Select>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Label" required>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. LESCO 2nd floor" required />
        </Field>
        <Field label="Amount (PKR)" required>
          <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required />
        </Field>
      </div>

      <Field label={needsDetail ? "Description / detail (required)" : "Description"} required={needsDetail}>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={needsDetail ? "What was this for?" : "Optional"}
          required={needsDetail}
        />
      </Field>

      <Field label="Vendor">
        <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Optional" />
      </Field>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "Add expense"}
        </Button>
      </div>
    </form>
  );
}

function pct(part: number, whole: number): string {
  if (!whole) return "—";
  return `${((part / whole) * 100).toFixed(1)}% of total`;
}
function money(n: number): string {
  return `Rs ${Math.round(n).toLocaleString()}`;
}
