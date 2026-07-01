"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Search, UserPlus, Users } from "lucide-react";
import type { DbEmployee, EntityRow, TeamRow } from "@/lib/db/employees";
import { createEmployeeAction } from "@/app/(app)/employees/actions";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Field, Input, Select } from "@/components/ui/field";
import { BreakdownRow } from "@/components/ui/sheet";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { Sheet } from "@/components/ui/sheet";

const SUBTYPE_LABEL: Record<string, string> = {
  sales_team: "Sales Team",
  marketing: "Marketing",
  business_development: "Business Development",
};

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
      cell: (e) => (e.entityId ? <Badge tone="brand">{e.entityId}</Badge> : <span className="text-subtle">—</span>),
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
        />
        <StatCard label="Companies" value={String(entities.length)} icon={<Building2 className="h-4.5 w-4.5" />} />
        <StatCard label="Showing" value={formatNumber(rows.length)} hint="after filters" />
        <StatCard label="Avg salary" value={<Money value={avg} compact />} hint="active employees" />
      </div>

      <Card className="mt-4 overflow-hidden">
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(e) => e.id}
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
                <Badge tone="brand">{e.entityId ?? "—"}</Badge>
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
    </>
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
