"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, ChevronRight, CreditCard, Pencil, Plus, Trash2 } from "lucide-react";
import type { DbExpense, ExpenseCategory } from "@/lib/db/expenses";
import type { EntityRow } from "@/lib/db/employees";
import {
  MAIN_CATEGORIES,
  isMainCategoryId,
  mainCategoryLabel,
  type MainCategoryId,
} from "@/lib/db/expenses-shared";
import {
  addExpenseSubcategoryAction,
  createExpenseAction,
  deleteExpenseAction,
  updateExpenseAction,
} from "@/app/(app)/expenses/actions";
import { formatMonthKey, formatMonthKeyLong } from "@/lib/format";
import { cn } from "@/lib/utils";
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
import { BreakdownRow, Sheet } from "@/components/ui/sheet";

/** Which breakdown sheet is open. */
type Drill =
  | { kind: "entity"; id: "JU" | "PDC" | "B4U" | "combined" }
  | { kind: "month"; month: string }
  | { kind: "split"; which: "fixed" | "variable" }
  | { kind: "main"; main: MainCategoryId }
  | null;

const ENTITY_DRILL: Record<string, { label: string; ids: string[] }> = {
  JU: { label: "JU Estimation", ids: ["JU"] },
  PDC: { label: "Pavilion (PDC)", ids: ["PDC"] },
  B4U: { label: "Bed Sheet 4u", ids: ["B4U"] },
  combined: { label: "JU + PDC combined", ids: ["JU", "PDC", "JU_PDC"] },
};

/** Shared costs are tagged JU_PDC in the DB; badge them as "JU+PDC". */
function entityBadgeLabel(id: string | null): string {
  return id === "JU_PDC" ? "JU+PDC" : id ?? "—";
}

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
  const [drill, setDrill] = useState<Drill>(null);
  const [detail, setDetail] = useState<DbExpense | null>(null);
  // Subcategories added on the fly this session — merged until router.refresh lands.
  const [extraCats, setExtraCats] = useState<ExpenseCategory[]>([]);

  const allCategories = useMemo(() => {
    const ids = new Set(categories.map((c) => c.id));
    return [...categories, ...extraCats.filter((c) => !ids.has(c.id))];
  }, [categories, extraCats]);
  const addLocalCategory = (cat: ExpenseCategory) =>
    setExtraCats((prev) => (prev.some((c) => c.id === cat.id) ? prev : [...prev, cat]));

  const currentMonth = new Date().toISOString().slice(0, 7);

  const months = useMemo(
    () => [...new Set(expenses.map((e) => e.month))].sort((a, b) => b.localeCompare(a)),
    [expenses],
  );

  // Month-scoped set drives the entity sections; entity + type filter the table.
  const monthScoped = useMemo(
    () => (month === "all" ? expenses : expenses.filter((e) => e.month === month)),
    [expenses, month],
  );
  const scopeLabel = month === "all" ? "All months" : formatMonthKeyLong(month);

  const byEntity = (id: string) =>
    monthScoped.filter((e) => e.entityId === id).reduce((s, e) => s + e.amount, 0);
  const ju = byEntity("JU");
  const pdc = byEntity("PDC");
  const b4u = byEntity("B4U");
  const shared = byEntity("JU_PDC");
  const combined = ju + pdc + shared;
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

  const mainTotals = useMemo(
    () =>
      MAIN_CATEGORIES.map((m) => ({
        ...m,
        total: monthScoped.filter((e) => e.categoryMain === m.id).reduce((s, e) => s + e.amount, 0),
      })),
    [monthScoped],
  );
  const mainMax = Math.max(1, ...mainTotals.map((m) => m.total));

  const columns: Column<DbExpense>[] = [
    {
      key: "entity",
      header: "Co.",
      cell: (e) =>
        e.entityId ? <Badge tone="brand">{entityBadgeLabel(e.entityId)}</Badge> : <span className="text-subtle">—</span>,
    },
    { key: "label", header: "Expense", cell: (e) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{e.label}</p>
        {e.description ? <p className="truncate text-xs text-subtle">{e.description}</p> : null}
      </div>
    ) },
    {
      key: "category",
      header: "Category",
      hideOnMobile: true,
      cell: (e) => (
        <span className="text-sm text-muted">
          {e.categoryName ?? "—"}
          {e.categoryMain ? <span className="text-xs text-subtle"> · {mainCategoryLabel(e.categoryMain)}</span> : null}
        </span>
      ),
    },
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
        description="Company costs across JU, PDC, B4U and the shared JU + PDC book — fixed and variable."
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

      {/* Four entity sections: JU / PDC / B4U / JU+PDC combined — click to drill */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="JU Estimation" value={<Money value={ju} compact />} hint={pct(ju, total)} onClick={() => setDrill({ kind: "entity", id: "JU" })} />
        <StatCard label="Pavilion (PDC)" value={<Money value={pdc} compact />} hint={pct(pdc, total)} onClick={() => setDrill({ kind: "entity", id: "PDC" })} />
        <StatCard label="Bed Sheet 4u" value={<Money value={b4u} compact />} hint={pct(b4u, total)} onClick={() => setDrill({ kind: "entity", id: "B4U" })} />
        <StatCard label="JU + PDC combined" value={<Money value={combined} compact />} hint="JU + PDC + shared" onClick={() => setDrill({ kind: "entity", id: "combined" })} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          {/* Monthly trend */}
          <Card>
            <CardHeader title="Monthly spend" subtitle={`Total ${money(total)}${month === "all" ? "" : " · " + formatMonthKey(month)}`} />
            <CardBody className="space-y-3">
              {trend.arr.length === 0 ? (
                <p className="text-sm text-muted">No expenses yet.</p>
              ) : (
                trend.arr.map((t) => (
                  <button
                    key={t.month}
                    type="button"
                    onClick={() => setDrill({ kind: "month", month: t.month })}
                    className="block w-full rounded-lg text-left transition-colors hover:bg-surface-muted/50"
                  >
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted">{formatMonthKey(t.month)}</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        <Money value={t.total} compact />
                      </span>
                    </div>
                    <Bar value={t.total} max={trend.max} />
                  </button>
                ))
              )}
              <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
                <span className="text-muted">Fixed / Variable</span>
                <span className="font-medium tabular-nums text-foreground">
                  <button
                    type="button"
                    onClick={() => setDrill({ kind: "split", which: "fixed" })}
                    className="rounded transition-colors hover:text-brand-700 hover:underline"
                  >
                    <Money value={fixedTotal} compact />
                  </button>
                  {" · "}
                  <button
                    type="button"
                    onClick={() => setDrill({ kind: "split", which: "variable" })}
                    className="rounded transition-colors hover:text-brand-700 hover:underline"
                  >
                    <Money value={total - fixedTotal} compact />
                  </button>
                </span>
              </div>
            </CardBody>
          </Card>

          {/* By main category */}
          <Card>
            <CardHeader title="By main category" subtitle={scopeLabel} />
            <CardBody className="space-y-3">
              {mainTotals.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setDrill({ kind: "main", main: m.id })}
                  className="block w-full rounded-lg text-left transition-colors hover:bg-surface-muted/50"
                >
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted">{m.label}</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      <Money value={m.total} compact />
                    </span>
                  </div>
                  <Bar value={m.total} max={mainMax} />
                </button>
              ))}
            </CardBody>
          </Card>
        </div>

        {/* Ledger */}
        <Card className="overflow-hidden lg:col-span-2">
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(e) => e.id}
            onRowClick={(e) => setDetail(e)}
            dense
            emptyState={
              <EmptyState
                icon={<CreditCard className="h-5 w-5" />}
                title="No expenses"
                description="Adjust the filters or add an expense."
              />
            }
            mobileCard={(e) => (
              <Card interactive className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-medium text-foreground">{e.label}</p>
                  <span className="shrink-0 font-semibold tabular-nums">
                    <Money value={e.amount} compact />
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge tone="brand">{entityBadgeLabel(e.entityId)}</Badge>
                  <Badge tone={e.isFixed ? "info" : "neutral"}>{e.isFixed ? "Fixed" : "Variable"}</Badge>
                  <span className="ml-auto text-xs text-subtle">{formatMonthKey(e.month)}</span>
                </div>
              </Card>
            )}
          />
        </Card>
      </div>

      {/* Drill-down sheets behind every headline figure */}
      <ExpenseDrillSheet
        drill={drill}
        monthScoped={monthScoped}
        expenses={expenses}
        scopeLabel={scopeLabel}
        onClose={() => setDrill(null)}
      />

      {/* Row detail: view / edit / delete */}
      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.label ?? "Expense"}
        subtitle={detail ? `${entityBadgeLabel(detail.entityId)} · ${formatMonthKeyLong(detail.month)}` : undefined}
        width={520}
      >
        {detail ? (
          <ExpenseDetail
            key={detail.id}
            expense={detail}
            entities={entities}
            categories={allCategories}
            canManage={canManage}
            onAddLocalCategory={addLocalCategory}
            onClose={() => setDetail(null)}
          />
        ) : null}
      </Sheet>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add expense" subtitle="Company cost" width={520}>
        <ExpenseForm
          categories={allCategories}
          entities={entities}
          defaultMonth={currentMonth}
          onAddLocalCategory={addLocalCategory}
          onCancel={() => setAddOpen(false)}
          onDone={() => setAddOpen(false)}
        />
      </Sheet>
    </>
  );
}

// =============================================================================
// Drill-down sheets
// =============================================================================

function ExpenseDrillSheet({
  drill,
  monthScoped,
  expenses,
  scopeLabel,
  onClose,
}: {
  drill: Drill;
  monthScoped: DbExpense[];
  expenses: DbExpense[];
  scopeLabel: string;
  onClose: () => void;
}) {
  let title = "";
  let subtitle: string | undefined = scopeLabel;
  let body: React.ReactNode = null;

  if (drill?.kind === "entity") {
    const d = ENTITY_DRILL[drill.id];
    title = d.label;
    body = <ExpenseRowList rows={monthScoped.filter((e) => !!e.entityId && d.ids.includes(e.entityId))} />;
  } else if (drill?.kind === "month") {
    title = formatMonthKeyLong(drill.month);
    subtitle = "By main category";
    body = <MonthBreakdown rows={expenses.filter((e) => e.month === drill.month)} />;
  } else if (drill?.kind === "split") {
    title = drill.which === "fixed" ? "Fixed expenses" : "Variable expenses";
    body = <ExpenseRowList rows={monthScoped.filter((e) => (drill.which === "fixed") === !!e.isFixed)} />;
  } else if (drill?.kind === "main") {
    title = mainCategoryLabel(drill.main);
    subtitle = `${scopeLabel} · by subcategory`;
    body = <MainCategoryBreakdown key={drill.main} rows={monthScoped.filter((e) => e.categoryMain === drill.main)} />;
  }

  return (
    <Sheet open={!!drill} onClose={onClose} title={title} subtitle={subtitle}>
      {body}
    </Sheet>
  );
}

/** Flat list of expense rows with an emphasised total. */
function ExpenseRowList({ rows }: { rows: DbExpense[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted">No expenses in this scope.</p>;
  const sorted = [...rows].sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((s, e) => s + e.amount, 0);
  return (
    <div>
      {sorted.map((e) => (
        <BreakdownRow
          key={e.id}
          label={e.label}
          sub={`${e.categoryName ?? "Uncategorised"} · ${entityBadgeLabel(e.entityId)} · ${formatMonthKey(e.month)}`}
          value={<Money value={e.amount} />}
        />
      ))}
      <BreakdownRow label={`Total (${rows.length})`} value={<Money value={total} />} emphasis />
    </div>
  );
}

/** One month's rows grouped under the three main categories. */
function MonthBreakdown({ rows }: { rows: DbExpense[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted">No expenses this month.</p>;
  const groups: { id: string; label: string; items: DbExpense[] }[] = MAIN_CATEGORIES.map((m) => ({
    id: m.id,
    label: m.label,
    items: rows.filter((e) => e.categoryMain === m.id),
  }));
  const other = rows.filter((e) => !isMainCategoryId(e.categoryMain ?? ""));
  if (other.length > 0) groups.push({ id: "other", label: "Uncategorised", items: other });
  const total = rows.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <div key={g.id} className="mt-5 first:mt-0">
            <p className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-subtle">
              <span>{g.label}</span>
              <span className="tabular-nums">
                <Money value={g.items.reduce((s, e) => s + e.amount, 0)} compact />
              </span>
            </p>
            {g.items.map((e) => (
              <BreakdownRow
                key={e.id}
                label={e.label}
                sub={`${e.categoryName ?? "—"} · ${entityBadgeLabel(e.entityId)}`}
                value={<Money value={e.amount} />}
              />
            ))}
          </div>
        ))}
      <BreakdownRow label="Month total" value={<Money value={total} />} emphasis />
    </div>
  );
}

/** Per-subcategory totals; each subcategory expands to its expense rows. */
function MainCategoryBreakdown({ rows }: { rows: DbExpense[] }) {
  const [openSub, setOpenSub] = useState<string | null>(null);
  const subs = useMemo(() => {
    const map = new Map<string, { id: string; name: string; total: number; items: DbExpense[] }>();
    for (const e of rows) {
      const id = e.categoryId ?? "uncategorised";
      const g = map.get(id) ?? { id, name: e.categoryName ?? "Uncategorised", total: 0, items: [] };
      g.total += e.amount;
      g.items.push(e);
      map.set(id, g);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [rows]);

  if (rows.length === 0) return <p className="text-sm text-muted">No expenses in this scope.</p>;
  const total = rows.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      {subs.map((s) => (
        <div key={s.id} className="border-b border-border/70 last:border-0">
          <button
            type="button"
            onClick={() => setOpenSub(openSub === s.id ? null : s.id)}
            className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
          >
            <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
              <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition-transform", openSub === s.id && "rotate-90")} />
              <span className="truncate">{s.name}</span>
              <span className="shrink-0 text-xs text-subtle">({s.items.length})</span>
            </span>
            <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
              <Money value={s.total} />
            </span>
          </button>
          {openSub === s.id ? (
            <div className="mb-2.5 space-y-1.5 rounded-lg bg-surface-muted/50 px-3 py-2">
              {s.items.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-muted">
                    {e.label} <span className="text-xs text-subtle">· {formatMonthKey(e.month)}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <Money value={e.amount} />
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
      <BreakdownRow label="Total" value={<Money value={total} />} emphasis />
    </div>
  );
}

// =============================================================================
// Row detail: view → edit / two-step delete
// =============================================================================

function ExpenseDetail({
  expense,
  entities,
  categories,
  canManage,
  onAddLocalCategory,
  onClose,
}: {
  expense: DbExpense;
  entities: EntityRow[];
  categories: ExpenseCategory[];
  canManage: boolean;
  onAddLocalCategory: (cat: ExpenseCategory) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (mode === "edit") {
    return (
      <ExpenseForm
        categories={categories}
        entities={entities}
        defaultMonth={expense.month}
        initial={expense}
        onAddLocalCategory={onAddLocalCategory}
        onCancel={() => setMode("view")}
        onDone={onClose}
      />
    );
  }

  const entityName = entities.find((en) => en.id === expense.entityId)?.name ?? expense.entityId ?? "—";

  async function doDelete() {
    setError(null);
    setDeleting(true);
    const res = await deleteExpenseAction(expense.id);
    setDeleting(false);
    if (!res.ok) {
      setError(res.error ?? "Failed to delete.");
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div role="alert" className="rounded-lg border border-negative/30 bg-negative-soft px-3 py-2 text-sm text-negative">
          {error}
        </div>
      ) : null}

      <div>
        <BreakdownRow
          label="Category"
          value={
            <span className="font-medium">
              {mainCategoryLabel(expense.categoryMain)} › {expense.categoryName ?? "—"}
            </span>
          }
        />
        <BreakdownRow label="Company" value={<span className="font-medium">{entityName}</span>} />
        <BreakdownRow label="Month" value={formatMonthKey(expense.month)} />
        <BreakdownRow
          label="Type"
          value={<Badge tone={expense.isFixed ? "info" : "neutral"}>{expense.isFixed ? "Fixed" : "Variable"}</Badge>}
        />
        <BreakdownRow label="Vendor" value={expense.vendor ?? "—"} />
        <BreakdownRow label="Amount" value={<Money value={expense.amount} />} emphasis />
      </div>

      {expense.description ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">Description</p>
          <p className="text-sm text-muted">{expense.description}</p>
        </div>
      ) : null}

      {canManage ? (
        confirming ? (
          <div className="rounded-xl border border-negative/30 bg-negative-soft p-3">
            <p className="text-sm font-medium text-negative">Delete this expense permanently?</p>
            <div className="mt-2 flex items-center gap-2">
              <Button variant="danger" size="sm" disabled={deleting} onClick={doDelete}>
                {deleting ? "Deleting…" : "Yes, delete"}
              </Button>
              <Button variant="ghost" size="sm" disabled={deleting} onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setMode("edit")}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button variant="danger" onClick={() => setConfirming(true)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}

// =============================================================================
// Add / edit form with the searchable subcategory picker
// =============================================================================

function ExpenseForm({
  categories,
  entities,
  defaultMonth,
  initial,
  onAddLocalCategory,
  onCancel,
  onDone,
}: {
  categories: ExpenseCategory[];
  entities: EntityRow[];
  defaultMonth: string;
  initial?: DbExpense;
  onAddLocalCategory: (cat: ExpenseCategory) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const editing = !!initial;
  const [entityId, setEntityId] = useState(
    initial?.entityId ?? entities.find((e) => e.id === "JU")?.id ?? entities[0]?.id ?? "",
  );
  const [mainCat, setMainCat] = useState<MainCategoryId>(() => {
    if (initial?.categoryMain && isMainCategoryId(initial.categoryMain)) return initial.categoryMain;
    const byId = categories.find((c) => c.id === initial?.categoryId);
    return byId?.mainCategory ?? MAIN_CATEGORIES[0].id;
  });
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [month, setMonth] = useState(initial?.month ?? defaultMonth);
  const [label, setLabel] = useState(initial?.label ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [vendor, setVendor] = useState(initial?.vendor ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState(false);

  const subcategories = categories.filter((c) => c.mainCategory === mainCat);
  const category = categories.find((c) => c.id === categoryId);
  const needsDetail = !!category?.requiresDetail;

  function changeMain(next: MainCategoryId) {
    setMainCat(next);
    // Selected subcategory belongs to the old main — clear it.
    if (category && category.mainCategory !== next) setCategoryId("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!categoryId) {
      setError("Pick a subcategory — search and select, or add a new one.");
      return;
    }
    setSubmitting(true);
    const input = {
      month,
      entityId,
      categoryId,
      label,
      description: needsDetail ? description : description || null,
      amount: Number(amount) || 0,
      vendor: vendor || null,
    };
    const res = initial ? await updateExpenseAction(initial.id, input) : await createExpenseAction(input);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setOk(true);
    router.refresh();
    setTimeout(onDone, 900);
  }

  if (ok) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle2 className="h-12 w-12 text-positive" />
        <p className="mt-3 text-base font-semibold text-foreground">
          {editing ? "Expense updated" : "Expense added"}
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

      <Field label="Main category" required>
        <Select value={mainCat} onChange={(e) => changeMain(e.target.value as MainCategoryId)}>
          {MAIN_CATEGORIES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Subcategory" required hint="Search the list — if it's missing, add it and it'll be there next time.">
        <SubcategoryPicker
          key={mainCat}
          options={subcategories}
          mainCategory={mainCat}
          value={categoryId}
          onSelect={setCategoryId}
          onAddLocal={onAddLocalCategory}
        />
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
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? (editing ? "Saving…" : "Adding…") : editing ? "Save changes" : "Add expense"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Searchable subcategory combobox. Filters the chosen main category's
 * subcategories; when nothing matches, offers "+ Add" which creates the
 * subcategory on the server and selects it immediately.
 */
function SubcategoryPicker({
  options,
  mainCategory,
  value,
  onSelect,
  onAddLocal,
}: {
  options: ExpenseCategory[];
  mainCategory: MainCategoryId;
  value: string;
  onSelect: (id: string) => void;
  onAddLocal: (cat: ExpenseCategory) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const sorted = [...options].sort((a, b) => a.name.localeCompare(b.name));
  const filtered = q ? sorted.filter((c) => c.name.toLowerCase().includes(q)) : sorted;
  const selected = options.find((c) => c.id === value);

  async function addNew() {
    const name = query.trim();
    if (!name || adding) return;
    setError(null);
    setAdding(true);
    const res = await addExpenseSubcategoryAction(name, mainCategory);
    setAdding(false);
    if (!res.ok || !res.id) {
      setError(res.error ?? "Could not add the subcategory.");
      return;
    }
    onAddLocal({
      id: res.id,
      name,
      kind: mainCategory === "utility_bills" ? "fixed" : "variable",
      requiresDetail: false,
      mainCategory,
    });
    onSelect(res.id);
    setQuery("");
    router.refresh();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (filtered.length > 0) onSelect(filtered[0].id);
    else void addNew();
  }

  return (
    <div className="space-y-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Search subcategories…"
      />
      {selected ? (
        <p className="text-xs text-muted">
          Selected: <span className="font-medium text-foreground">{selected.name}</span> ·{" "}
          {mainCategoryLabel(selected.mainCategory)}
        </p>
      ) : null}
      {error ? <p className="text-xs text-negative">{error}</p> : null}
      <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border p-1.5">
        {filtered.map((c) => {
          const active = c.id === value;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                active ? "bg-brand-50 font-medium text-brand-700" : "text-foreground hover:bg-surface-muted",
              )}
            >
              <span className="min-w-0 truncate">{c.name}</span>
              {active ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <span className="shrink-0 text-xs text-subtle">{c.kind}</span>
              )}
            </button>
          );
        })}
        {filtered.length === 0 ? (
          q ? (
            <button
              type="button"
              onClick={addNew}
              disabled={adding}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-60"
            >
              <Plus className="h-4 w-4 shrink-0" />
              {adding ? "Adding…" : `Add "${query.trim()}"`}
            </button>
          ) : (
            <p className="px-2.5 py-1.5 text-sm text-muted">No subcategories yet — type a name to add one.</p>
          )
        ) : null}
      </div>
      <input type="hidden" name="categoryId" value={value} />
    </div>
  );
}

function pct(part: number, whole: number): string {
  if (!whole) return "—";
  return `${((part / whole) * 100).toFixed(1)}% of total`;
}
function money(n: number): string {
  return `Rs ${Math.round(n).toLocaleString()}`;
}
