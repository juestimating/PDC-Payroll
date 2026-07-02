"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Building2, CheckCircle2, Pencil, Search, UserPlus, Users } from "lucide-react";
import type { DbEmployee, EntityRow, TeamRow } from "@/lib/db/employees";
import {
  correctSalaryAction,
  createEmployeeAction,
  updateEmployeeAction,
} from "@/app/(app)/employees/actions";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { BreakdownRow } from "@/components/ui/sheet";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { Sheet } from "@/components/ui/sheet";

const SUBTYPE_LABEL: Record<string, string> = {
  sales_team: "Sales Team",
  marketing: "Marketing",
  business_development: "Business Development",
};

/** Compact entity badge label — the shared entity renders as "JU+PDC". */
function entityLabel(entityId: string | null): string {
  if (!entityId) return "—";
  return entityId === "JU_PDC" ? "JU+PDC" : entityId;
}

type StatDrill = "active" | "companies" | "avg" | null;
type ProfileMode = "view" | "edit" | "salary";

export function PeopleClient({
  employees,
  entities,
  teams,
  canManage,
}: {
  employees: DbEmployee[];
  entities: EntityRow[];
  teams: TeamRow[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState("all");
  const [team, setTeam] = useState("all");
  const [status, setStatus] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [drill, setDrill] = useState<StatDrill>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileMode, setProfileMode] = useState<ProfileMode>("view");

  // Derive from props so the sheet shows fresh data after router.refresh().
  const selected = selectedId ? employees.find((e) => e.id === selectedId) ?? null : null;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (entity !== "all" && e.entityId !== entity) return false;
      if (team !== "all" && e.teamId !== team) return false;
      if (status !== "all" && e.status !== status) return false;
      if (
        q &&
        !(
          e.name.toLowerCase().includes(q) ||
          (e.employeeCode ?? "").toLowerCase().includes(q) ||
          e.designation.toLowerCase().includes(q)
        )
      )
        return false;
      return true;
    });
  }, [employees, search, entity, team, status]);

  const active = employees.filter((e) => e.status === "active");
  const avg = active.length ? active.reduce((s, e) => s + e.salary, 0) / active.length : 0;

  const columns: Column<DbEmployee>[] = [
    {
      key: "code",
      header: "Code",
      cell: (e) => <span className="font-mono text-xs text-muted">{e.employeeCode ?? "—"}</span>,
    },
    {
      key: "employee",
      header: "Employee",
      cell: (e) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={e.name} size={32} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{e.name}</p>
            <p className="truncate text-xs text-subtle">{e.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "entity",
      header: "Company",
      hideOnMobile: true,
      cell: (e) => (e.entityId ? <Badge tone="brand">{entityLabel(e.entityId)}</Badge> : <span className="text-subtle">—</span>),
    },
    {
      key: "team",
      header: "Team",
      hideOnMobile: true,
      cell: (e) => (
        <span className="text-sm text-muted">
          {e.teamName ?? "—"}
          {e.juSalesSubtype ? ` · ${SUBTYPE_LABEL[e.juSalesSubtype] ?? ""}` : ""}
        </span>
      ),
    },
    {
      key: "designation",
      header: "Designation",
      hideOnMobile: true,
      cell: (e) => <span className="text-sm text-muted">{e.designation}</span>,
    },
    { key: "salary", header: "Salary", align: "right", cell: (e) => <Money value={e.salary} /> },
    {
      key: "status",
      header: "Status",
      align: "center",
      hideOnMobile: true,
      cell: (e) => <StatusBadge status={e.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="People"
        description="Your team across JU, PDC, and B4U — search by name or employee code."
        actions={
          canManage ? (
            <Button onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Add employee
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or code (PDC-0001)…"
              className="pl-9"
            />
          </div>
          <Select value={entity} onChange={(e) => setEntity(e.target.value)} className="sm:w-40">
            <option value="all">All companies</option>
            {entities.map((en) => (
              <option key={en.id} value={en.id}>
                {en.name}
              </option>
            ))}
          </Select>
          <Select value={team} onChange={(e) => setTeam(e.target.value)} className="sm:w-44">
            <option value="all">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-32">
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Active employees"
          value={formatNumber(active.length)}
          hint={`${employees.length} total`}
          icon={<Users className="h-4.5 w-4.5" />}
          onClick={() => setDrill("active")}
        />
        <StatCard
          label="Companies"
          value={String(entities.length)}
          icon={<Building2 className="h-4.5 w-4.5" />}
          onClick={() => setDrill("companies")}
        />
        <StatCard label="Showing" value={formatNumber(rows.length)} hint="after filters" />
        <StatCard
          label="Avg salary"
          value={<Money value={avg} compact />}
          hint="active employees"
          onClick={() => setDrill("avg")}
        />
      </div>

      <Card className="mt-4 overflow-hidden">
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(e) => e.id}
          onRowClick={(e) => {
            setSelectedId(e.id);
            setProfileMode("view");
          }}
          dense
          emptyState={
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No employees found"
              description="Adjust the filters or add a new employee."
            />
          }
          mobileCard={(e) => (
            <Card className="p-3">
              <div className="flex items-center gap-3">
                <Avatar name={e.name} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{e.name}</p>
                  <p className="truncate text-xs text-subtle">
                    {e.employeeCode} · {e.designation}
                  </p>
                </div>
                <StatusBadge status={e.status} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Badge tone="brand">{entityLabel(e.entityId)}</Badge>
                <span className="text-sm font-semibold tabular-nums">
                  <Money value={e.salary} compact />
                </span>
              </div>
            </Card>
          )}
        />
      </Card>

      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add employee"
        subtitle="New team member"
        width={560}
      >
        <OnboardingForm entities={entities} teams={teams} onClose={() => setAddOpen(false)} />
      </Sheet>

      {/* Employee profile drill (row click) */}
      <Sheet
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.name ?? ""}
        subtitle={
          selected
            ? profileMode === "edit"
              ? "Edit details"
              : profileMode === "salary"
                ? "Correct salary"
                : `${selected.employeeCode ?? "—"} · ${selected.designation}`
            : undefined
        }
        width={560}
      >
        {selected ? (
          profileMode === "edit" ? (
            <EditEmployeeForm
              employee={selected}
              entities={entities}
              teams={teams}
              onDone={() => setProfileMode("view")}
            />
          ) : profileMode === "salary" ? (
            <CorrectSalaryForm employee={selected} onDone={() => setProfileMode("view")} />
          ) : (
            <EmployeeProfile
              employee={selected}
              canManage={canManage}
              onEdit={() => setProfileMode("edit")}
              onCorrectSalary={() => setProfileMode("salary")}
            />
          )
        ) : null}
      </Sheet>

      {/* StatCard drilldowns */}
      <Sheet
        open={!!drill}
        onClose={() => setDrill(null)}
        title={
          drill === "active"
            ? "Active employees"
            : drill === "companies"
              ? "Companies"
              : drill === "avg"
                ? "Average salary"
                : ""
        }
        subtitle={
          drill === "active"
            ? `${active.length} active of ${employees.length} total`
            : drill === "companies"
              ? "Active headcount by entity"
              : drill === "avg"
                ? "Active employees, highest first"
                : undefined
        }
      >
        {drill === "active" ? (
          <div className="divide-y divide-border/70">
            {active.map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={e.name} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{e.name}</p>
                  <p className="truncate text-xs text-subtle">{e.teamName ?? "—"}</p>
                </div>
                <Badge tone="brand">{entityLabel(e.entityId)}</Badge>
              </div>
            ))}
          </div>
        ) : drill === "companies" ? (
          <div>
            {entities.map((en) => (
              <BreakdownRow
                key={en.id}
                label={en.name}
                sub={en.code}
                value={
                  <span className="font-semibold">
                    {formatNumber(active.filter((e) => e.entityId === en.id).length)}
                  </span>
                }
              />
            ))}
            <BreakdownRow label="Total active" value={<span>{formatNumber(active.length)}</span>} emphasis />
          </div>
        ) : drill === "avg" ? (
          <div>
            {[...active]
              .sort((a, b) => b.salary - a.salary)
              .map((e) => (
                <BreakdownRow key={e.id} label={e.name} sub={e.designation} value={<Money value={e.salary} />} />
              ))}
            <BreakdownRow
              label={`Average · ${active.length} active`}
              value={<Money value={avg} />}
              emphasis
            />
          </div>
        ) : null}
      </Sheet>
    </>
  );
}

// =============================================================================
// Employee profile (live data the list already has) + canManage actions.
// =============================================================================
function EmployeeProfile({
  employee: e,
  canManage,
  onEdit,
  onCorrectSalary,
}: {
  employee: DbEmployee;
  canManage: boolean;
  onEdit: () => void;
  onCorrectSalary: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Avatar name={e.name} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-foreground">{e.name}</p>
          <p className="truncate text-sm text-muted">{e.email}</p>
        </div>
        <StatusBadge status={e.status} />
      </div>

      {canManage ? (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
            Edit details
          </Button>
          <Button size="sm" variant="outline" onClick={onCorrectSalary}>
            <Banknote className="h-3.5 w-3.5" />
            Correct salary
          </Button>
        </div>
      ) : null}

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">Employment</p>
        <BreakdownRow label="Company" value={<Badge tone="brand">{entityLabel(e.entityId)}</Badge>} sub={e.entityName ?? undefined} />
        <BreakdownRow
          label="Team"
          value={
            <span className="text-sm text-muted">
              {e.teamName ?? "—"}
              {e.juSalesSubtype ? ` · ${SUBTYPE_LABEL[e.juSalesSubtype] ?? ""}` : ""}
            </span>
          }
        />
        <BreakdownRow label="Joined" value={<span className="text-sm">{e.joinedOn}</span>} />
        {e.probationEnd ? (
          <BreakdownRow label="Probation ends" value={<span className="text-sm">{e.probationEnd}</span>} />
        ) : null}
        {e.lastWorkingDay ? (
          <BreakdownRow label="Last working day" value={<span className="text-sm">{e.lastWorkingDay}</span>} />
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-surface-muted/50 p-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">Monthly salary</p>
        <BreakdownRow label="Basic" value={<Money value={e.basic} />} />
        <BreakdownRow label="Medical" value={<Money value={e.medical} />} />
        {e.travel > 0 ? <BreakdownRow label="Travel" value={<Money value={e.travel} />} /> : null}
        <BreakdownRow label="Gross" value={<Money value={e.salary} />} emphasis />
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">Bank details</p>
        <BreakdownRow label="Bank" value={<span className="text-sm">{e.bank ?? "—"}</span>} />
        <BreakdownRow
          label="Account / IBAN"
          value={<span className="font-mono text-xs">{e.account ?? "—"}</span>}
        />
        <BreakdownRow label="Account title" value={<span className="text-sm">{e.accountTitle ?? "—"}</span>} />
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">Identity</p>
        <BreakdownRow label="CNIC" value={<span className="font-mono text-xs">{e.cnic ?? "—"}</span>} />
        <BreakdownRow label="City" value={<span className="text-sm">{e.city ?? "—"}</span>} />
      </div>

      {e.note ? <p className="rounded-lg bg-surface-muted/50 px-3 py-2 text-xs text-muted">{e.note}</p> : null}
    </div>
  );
}

// =============================================================================
// Edit details — the onboarding fields, prefilled, minus salary (use "Correct
// salary" or Increments for pay changes).
// =============================================================================
function EditEmployeeForm({
  employee,
  entities,
  teams,
  onDone,
}: {
  employee: DbEmployee;
  entities: EntityRow[];
  teams: TeamRow[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [f, setF] = useState({
    name: employee.name,
    email: employee.email,
    designation: employee.designation,
    cnic: employee.cnic ?? "",
    city: employee.city ?? "",
    taxAddress: employee.taxAddress ?? "",
    bank: employee.bank ?? "",
    account: employee.account ?? "",
    accountTitle: employee.accountTitle ?? "",
    joinedOn: employee.joinedOn,
    note: employee.note ?? "",
  });
  const [entityId, setEntityId] = useState(employee.entityId ?? entities[0]?.id ?? "");
  const [teamId, setTeamId] = useState(employee.teamId);
  const [subtype, setSubtype] = useState(employee.juSalesSubtype ?? "sales_team");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState(false);

  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const selectedTeam = teams.find((t) => t.id === teamId);
  const showSubtype = entityId === "JU" && !!selectedTeam?.isSales;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await updateEmployeeAction(employee.id, {
      name: f.name,
      email: f.email,
      designation: f.designation,
      entityId,
      teamId,
      juSalesSubtype: showSubtype ? subtype : null,
      joinedOn: f.joinedOn,
      cnic: f.cnic || null,
      city: f.city || null,
      taxAddress: f.taxAddress || null,
      bank: f.bank || null,
      account: f.account || null,
      accountTitle: f.accountTitle || null,
      note: f.note || null,
    });
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
        <p className="mt-3 text-base font-semibold text-foreground">Details updated</p>
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
        <Field label="Full name" required>
          <Input value={f.name} onChange={up("name")} required />
        </Field>
        <Field label="Email" required>
          <Input type="email" value={f.email} onChange={up("email")} required />
        </Field>
      </div>

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
        <Field label="Team" required>
          <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {showSubtype ? (
        <Field label="Sub-type (JU sales / marketing / BD)" required>
          <Select value={subtype} onChange={(e) => setSubtype(e.target.value)}>
            <option value="sales_team">Sales Team</option>
            <option value="marketing">Marketing</option>
            <option value="business_development">Business Development</option>
          </Select>
        </Field>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Designation" required>
          <Input value={f.designation} onChange={up("designation")} required />
        </Field>
        <Field label="Joining date" required>
          <Input type="date" value={f.joinedOn} onChange={up("joinedOn")} required />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="CNIC" hint="Format 35202-1234567-1">
          <Input value={f.cnic} onChange={up("cnic")} placeholder="35202-1234567-1" />
        </Field>
        <Field label="City">
          <Input value={f.city} onChange={up("city")} placeholder="Lahore" />
        </Field>
      </div>

      <Field label="Tax address" hint="Defaults to the city">
        <Input value={f.taxAddress} onChange={up("taxAddress")} placeholder={f.city || "Tax address"} />
      </Field>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Bank details</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Bank">
            <Input value={f.bank} onChange={up("bank")} placeholder="e.g. Bank Alfalah" />
          </Field>
          <Field label="Account / IBAN">
            <Input value={f.account} onChange={up("account")} placeholder="PK.. / account no." />
          </Field>
        </div>
        <Field label="Account title" hint="Defaults to the employee name" className="mt-4">
          <Input value={f.accountTitle} onChange={up("accountTitle")} placeholder={f.name || "Account holder"} />
        </Field>
      </div>

      <Field label="Note">
        <Textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Optional" />
      </Field>

      <p className="text-xs text-subtle">
        Salary is not edited here — use &ldquo;Correct salary&rdquo; for a wrong entry or Increments for a raise.
      </p>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

// =============================================================================
// Correct salary — fixes a wrongly entered salary IN PLACE on the open
// salary_structures row (allows decreases). Raises belong in Increments.
// =============================================================================
function CorrectSalaryForm({ employee, onDone }: { employee: DbEmployee; onDone: () => void }) {
  const router = useRouter();
  const [salary, setSalary] = useState(employee.salary ? String(employee.salary) : "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState(false);

  const d = Number(salary) || 0;
  const medical = (d * 10) / 110;
  const basic = d - medical;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await correctSalaryAction(employee.id, d);
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
        <p className="mt-3 text-base font-semibold text-foreground">Salary corrected</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="rounded-lg bg-surface-muted/50 px-3 py-2 text-xs text-muted">
        Use this to fix a wrongly entered salary. For a raise, use Increments.
      </p>

      {error ? (
        <div role="alert" className="rounded-lg border border-negative/30 bg-negative-soft px-3 py-2 text-sm text-negative">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-surface-muted/50 p-3">
        <BreakdownRow label="Current salary" value={<Money value={employee.salary} />} />
      </div>

      <Field label="New monthly salary (PKR)" required>
        <Input
          type="number"
          min={1}
          value={salary}
          onChange={(e) => setSalary(e.target.value)}
          placeholder="0"
          required
        />
      </Field>

      {d > 0 ? (
        <div className="rounded-xl border border-border bg-surface-muted/50 p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">
            Component breakdown
          </p>
          <BreakdownRow label="Basic" value={<Money value={basic} />} />
          <BreakdownRow label="Medical (10/110)" value={<Money value={medical} />} />
          <BreakdownRow label="Gross" value={<Money value={d} />} emphasis />
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || d <= 0}>
          {submitting ? "Saving…" : "Correct salary"}
        </Button>
      </div>
    </form>
  );
}

function OnboardingForm({
  entities,
  teams,
  onClose,
}: {
  entities: EntityRow[];
  teams: TeamRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({
    name: "",
    email: "",
    designation: "",
    cnic: "",
    city: "",
    bank: "",
    account: "",
    accountTitle: "",
    joinedOn: today,
  });
  const [entityId, setEntityId] = useState(entities.find((e) => e.id === "JU")?.id ?? entities[0]?.id ?? "");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [subtype, setSubtype] = useState("sales_team");
  const [salary, setSalary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [okCode, setOkCode] = useState<string | null>(null);

  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const selectedTeam = teams.find((t) => t.id === teamId);
  const showSubtype = entityId === "JU" && !!selectedTeam?.isSales;

  const d = Number(salary) || 0;
  const comp = { basic: d * 0.65, ta: d * 0.1, medical: d * 0.1, hra: d * 0.15 };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await createEmployeeAction({
      name: f.name,
      email: f.email,
      entityId,
      teamId,
      juSalesSubtype: showSubtype ? subtype : null,
      designation: f.designation,
      cnic: f.cnic || null,
      city: f.city || null,
      bank: f.bank || null,
      account: f.account || null,
      accountTitle: f.accountTitle || null,
      joinedOn: f.joinedOn,
      salary: d,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setOkCode(res.employeeCode ?? "created");
    router.refresh();
    setTimeout(onClose, 1100);
  }

  if (okCode) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle2 className="h-12 w-12 text-positive" />
        <p className="mt-3 text-base font-semibold text-foreground">{f.name} added</p>
        <p className="mt-1 text-sm text-muted">
          Employee code <span className="font-mono font-semibold text-foreground">{okCode}</span>
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
        <Field label="Full name" required>
          <Input value={f.name} onChange={up("name")} placeholder="e.g. Ayesha Khan" required />
        </Field>
        <Field label="Email" required>
          <Input type="email" value={f.email} onChange={up("email")} placeholder="name@pdc.com.pk" required />
        </Field>
      </div>

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
        <Field label="Team" required>
          <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {showSubtype ? (
        <Field label="Sub-type (JU sales / marketing / BD)" required>
          <Select value={subtype} onChange={(e) => setSubtype(e.target.value)}>
            <option value="sales_team">Sales Team</option>
            <option value="marketing">Marketing</option>
            <option value="business_development">Business Development</option>
          </Select>
        </Field>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Designation" required>
          <Input value={f.designation} onChange={up("designation")} placeholder="e.g. Senior Estimator" required />
        </Field>
        <Field label="Joining date" required>
          <Input type="date" value={f.joinedOn} onChange={up("joinedOn")} required />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="CNIC" hint="Format 35202-1234567-1">
          <Input value={f.cnic} onChange={up("cnic")} placeholder="35202-1234567-1" />
        </Field>
        <Field label="City">
          <Input value={f.city} onChange={up("city")} placeholder="Lahore" />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Bank details</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Bank">
            <Input value={f.bank} onChange={up("bank")} placeholder="e.g. Bank Alfalah" />
          </Field>
          <Field label="Account / IBAN">
            <Input value={f.account} onChange={up("account")} placeholder="PK.. / account no." />
          </Field>
        </div>
        <Field label="Account title" hint="Defaults to the employee name" className="mt-4">
          <Input value={f.accountTitle} onChange={up("accountTitle")} placeholder={f.name || "Account holder"} />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Monthly salary (PKR)</p>
        <Field label="Gross salary" required>
          <Input
            type="number"
            min={1}
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            placeholder="0"
            required
          />
        </Field>
        {d > 0 ? (
          <div className="mt-3 rounded-xl border border-border bg-surface-muted/50 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">
              Component breakdown
            </p>
            <BreakdownRow label="Basic (65%)" value={<Money value={comp.basic} />} />
            <BreakdownRow label="TA (10%)" value={<Money value={comp.ta} />} />
            <BreakdownRow label="Medical (10%)" value={<Money value={comp.medical} />} />
            <BreakdownRow label="House rent (15%)" value={<Money value={comp.hra} />} />
            <BreakdownRow label="Gross" value={<Money value={d} />} emphasis />
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "Add employee"}
        </Button>
      </div>
    </form>
  );
}
