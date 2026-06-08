"use client";

import { useMemo, useState } from "react";
import { Building2, Search, UserPlus, Users } from "lucide-react";
import {
  DEPARTMENTS,
  EMPLOYEES,
  TEAMS,
  departmentById,
  getEmployees,
  teamById,
  teamsForDepartment,
} from "@/lib/data";
import type { Employee } from "@/lib/data";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Input, Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { Sheet } from "@/components/ui/sheet";
import { EmployeeForm, EmployeeProfileBody } from "@/components/employees/employee-detail";

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");
  const [team, setTeam] = useState("all");
  const [status, setStatus] = useState("all");

  const [profile, setProfile] = useState<Employee | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formEmployee, setFormEmployee] = useState<Employee | null>(null);

  const teamOptions = dept === "all" ? TEAMS : teamsForDepartment(dept);

  const rows = getEmployees({
    departmentId: dept === "all" ? undefined : dept,
    teamId: team === "all" ? undefined : team,
    status: status === "all" ? undefined : (status as Employee["status"]),
    search: search || undefined,
  });

  const stats = useMemo(() => {
    const active = EMPLOYEES.filter((e) => e.status === "active");
    const avgBasic = active.reduce((s, e) => s + e.salary.basic, 0) / (active.length || 1);
    return { active: active.length, total: EMPLOYEES.length, avgBasic };
  }, []);

  function openAdd() {
    setFormEmployee(null);
    setFormOpen(true);
  }
  function openEdit(emp: Employee) {
    setProfile(null);
    setFormEmployee(emp);
    setFormOpen(true);
  }

  const columns: Column<Employee>[] = [
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
      key: "department",
      header: "Department",
      cell: (e) => {
        const d = departmentById.get(e.departmentId);
        return (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d?.color }} />
            {d?.name}
          </span>
        );
      },
    },
    {
      key: "team",
      header: "Team",
      hideOnMobile: true,
      cell: (e) => <span className="text-sm text-muted">{teamById.get(e.teamId)?.name}</span>,
    },
    {
      key: "designation",
      header: "Designation",
      hideOnMobile: true,
      cell: (e) => <span className="text-sm text-muted">{e.designation}</span>,
    },
    { key: "basic", header: "Basic", align: "right", cell: (e) => <Money value={e.salary.basic} /> },
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
        title="Employees"
        description="Add, edit, and manage your people across departments and teams."
        actions={
          <Button onClick={openAdd}>
            <UserPlus className="h-4 w-4" />
            Add employee
          </Button>
        }
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people…"
              className="pl-9"
            />
          </div>
          <Select
            value={dept}
            onChange={(e) => {
              setDept(e.target.value);
              setTeam("all");
            }}
            className="sm:w-48"
          >
            <option value="all">All departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select value={team} onChange={(e) => setTeam(e.target.value)} className="sm:w-44">
            <option value="all">All teams</option>
            {teamOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-36">
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Active employees"
          value={formatNumber(stats.active)}
          hint={`${stats.total} total`}
          icon={<Users className="h-4.5 w-4.5" />}
        />
        <StatCard label="Departments" value={String(DEPARTMENTS.length)} icon={<Building2 className="h-4.5 w-4.5" />} />
        <StatCard label="Teams" value={String(TEAMS.length)} />
        <StatCard label="Avg basic" value={<Money value={stats.avgBasic} compact />} hint="active employees" />
      </div>

      <Card className="mt-4 overflow-hidden">
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(e) => e.id}
          onRowClick={(e) => setProfile(e)}
          dense
          emptyState={
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No employees found"
              description="Adjust the filters or add a new employee."
              action={
                <Button onClick={openAdd}>
                  <UserPlus className="h-4 w-4" />
                  Add employee
                </Button>
              }
            />
          }
          mobileCard={(e) => (
            <Card interactive className="p-3">
              <div className="flex items-center gap-3">
                <Avatar name={e.name} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{e.name}</p>
                  <p className="truncate text-xs text-subtle">{e.designation}</p>
                </div>
                <StatusBadge status={e.status} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Badge tone="brand">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: departmentById.get(e.departmentId)?.color }}
                  />
                  {departmentById.get(e.departmentId)?.name}
                </Badge>
                <span className="text-sm font-semibold tabular-nums">
                  <Money value={e.salary.basic} compact />
                </span>
              </div>
            </Card>
          )}
        />
      </Card>

      {/* Profile */}
      <Sheet
        open={!!profile}
        onClose={() => setProfile(null)}
        title="Employee profile"
        subtitle={profile?.name ?? ""}
        footer={
          profile ? (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setProfile(null)}>
                Close
              </Button>
              <Button onClick={() => profile && openEdit(profile)}>Edit</Button>
            </div>
          ) : null
        }
      >
        {profile ? <EmployeeProfileBody employee={profile} /> : null}
      </Sheet>

      {/* Add / Edit */}
      <Sheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={formEmployee ? "Edit employee" : "Add employee"}
        subtitle={formEmployee?.name ?? "New team member"}
        width={560}
      >
        <EmployeeForm employee={formEmployee} onClose={() => setFormOpen(false)} />
      </Sheet>
    </>
  );
}
