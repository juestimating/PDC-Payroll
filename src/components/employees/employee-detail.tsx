"use client";

import { useState } from "react";
import { UserMinus } from "lucide-react";
import type { Employee } from "@/lib/data";
import {
  DEPARTMENTS,
  EXIT_REASON_LABEL,
  TEAMS,
  departmentById,
  getEmployeePayroll,
  getIncrements,
  getSettlement,
  teamsForDepartment,
} from "@/lib/data";
import { formatMonthKey } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Field, Input, Select } from "@/components/ui/field";
import { BreakdownRow } from "@/components/ui/sheet";
import { Sparkline, CHART } from "@/components/charts";
import { PayrollBreakdownBody } from "@/components/payroll/payroll-breakdown";

export function EmployeeProfileBody({
  employee,
  onMarkAsLeft,
}: {
  employee: Employee;
  onMarkAsLeft?: (employee: Employee) => void;
}) {
  const dept = departmentById.get(employee.departmentId);
  const team = TEAMS.find((t) => t.id === employee.teamId);
  const history = getEmployeePayroll(employee.id);
  const latest = history[history.length - 1];
  const incs = getIncrements({ employeeId: employee.id });
  const baseGross = employee.salary.basic + employee.salary.medical + employee.salary.travel;
  const spark = history.map((h) => ({ label: h.month, value: h.net }));
  const settlement = employee.leftOn ? getSettlement(employee.id) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Avatar name={employee.name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-foreground">{employee.name}</p>
          <p className="truncate text-sm text-muted">{employee.designation}</p>
        </div>
        <StatusBadge status={employee.status} />
      </div>

      <div className="flex flex-wrap gap-2">
        {dept ? (
          <Badge tone="brand">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dept.color }} />
            {dept.name}
          </Badge>
        ) : null}
        {team ? <Badge>{team.name}</Badge> : null}
        <Badge>Joined {employee.joinedOn}</Badge>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">
          Current salary structure
        </p>
        <BreakdownRow label="Basic salary" value={<Money value={employee.salary.basic} />} />
        <BreakdownRow label="Medical allowance" value={<Money value={employee.salary.medical} />} />
        <BreakdownRow label="Travel allowance" value={<Money value={employee.salary.travel} />} />
        <BreakdownRow label="Base gross (fixed)" value={<Money value={baseGross} />} emphasis />
      </div>

      {spark.length > 1 ? (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Net pay trend</p>
            <span className="text-xs text-subtle">{spark.length} months</span>
          </div>
          <Sparkline data={spark} color={CHART.brand} height={48} />
        </div>
      ) : null}

      {incs.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">
            Increment history
          </p>
          {incs.map((inc) => (
            <div key={inc.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div>
                <p className="font-medium text-foreground">{inc.reason}</p>
                <p className="text-xs text-subtle">
                  {inc.date} · {inc.byUser}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums text-positive">
                  <Money value={inc.newBasic - inc.oldBasic} compact signed />
                </p>
                <p className="text-xs text-subtle tabular-nums">
                  <Money value={inc.oldBasic} compact symbol={false} /> →{" "}
                  <Money value={inc.newBasic} compact symbol={false} />
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {latest ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
            Latest payslip · {formatMonthKey(latest.month)}
          </p>
          <PayrollBreakdownBody record={latest} employee={employee} departmentName={dept?.name} />
        </div>
      ) : null}

      {employee.leftOn ? (
        <div className="rounded-xl border border-border bg-surface-muted/50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Departed</p>
            {settlement ? <StatusBadge status={settlement.status} /> : null}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
                Last working day
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">{employee.leftOn}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Reason</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {EXIT_REASON_LABEL[employee.exitReason ?? "other"]}
              </p>
            </div>
          </div>
          {employee.exitNote ? (
            <p className="mt-2 text-xs text-muted">{employee.exitNote}</p>
          ) : null}
          {settlement ? (
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm text-muted">Net final dues</span>
              <span className="text-sm font-semibold text-brand-700">
                <Money value={settlement.net} />
              </span>
            </div>
          ) : null}
          <p className="mt-2 text-xs text-subtle">
            See the Offboarding tab for the full final settlement.
          </p>
        </div>
      ) : onMarkAsLeft ? (
        <div className="border-t border-border pt-4">
          <Button variant="outline" className="w-full" onClick={() => onMarkAsLeft(employee)}>
            <UserMinus className="h-4 w-4" />
            Mark as left
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Add/Edit form. Conditional fields appear by department: commission scheme for
 * Sales, overtime settings for technical teams. This pass is UI-only; saving is
 * wired to Supabase in the logic phase.
 */
export function EmployeeForm({
  employee,
  onClose,
}: {
  employee?: Employee | null;
  onClose: () => void;
}) {
  const [deptId, setDeptId] = useState(employee?.departmentId ?? DEPARTMENTS[0].id);
  const dept = departmentById.get(deptId);
  const teams = teamsForDepartment(deptId);
  const [teamId, setTeamId] = useState(employee?.teamId ?? teams[0]?.id ?? "");

  function changeDept(id: string) {
    setDeptId(id);
    const first = teamsForDepartment(id)[0]?.id ?? "";
    setTeamId(first);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" required>
          <Input defaultValue={employee?.name} placeholder="e.g. Ayesha Khan" required />
        </Field>
        <Field label="Email" required>
          <Input type="email" defaultValue={employee?.email} placeholder="name@pdc.com.pk" required />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Department" required>
          <Select value={deptId} onChange={(e) => changeDept(e.target.value)}>
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Designation" required>
          <Input defaultValue={employee?.designation} placeholder="e.g. Senior Estimator" required />
        </Field>
        <Field label="Status">
          <Select defaultValue={employee?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
          Salary structure (PKR / month)
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Basic">
            <Input type="number" defaultValue={employee?.salary.basic} placeholder="0" />
          </Field>
          <Field label="Medical">
            <Input type="number" defaultValue={employee?.salary.medical} placeholder="0" />
          </Field>
          <Field label="Travel">
            <Input type="number" defaultValue={employee?.salary.travel} placeholder="0" />
          </Field>
        </div>
      </div>

      {/* Conditional, department-specific */}
      {dept?.isSales ? (
        <div className="rounded-xl border border-accent-100 bg-accent-50/60 p-4">
          <p className="text-sm font-semibold text-foreground">Sales commission</p>
          <p className="mt-0.5 text-xs text-muted">
            Commission is logged monthly (new sales, old bonus, additional bonus). Set the scheme here.
          </p>
          <Field label="Commission scheme" className="mt-3">
            <Select defaultValue="standard">
              <option value="standard">Standard</option>
              <option value="senior">Senior</option>
              <option value="lead">Team lead</option>
            </Select>
          </Field>
        </div>
      ) : null}

      {dept?.isTechnical ? (
        <div className="rounded-xl border border-info-soft bg-info-soft/50 p-4">
          <p className="text-sm font-semibold text-foreground">Overtime & working days</p>
          <p className="mt-0.5 text-xs text-muted">
            Technical teams log overtime monthly. These set the defaults for the calculation.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Overtime eligible">
              <Select defaultValue="yes">
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </Select>
            </Field>
            <Field label="Standard working days">
              <Input type="number" defaultValue={24} />
            </Field>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">{employee ? "Save changes" : "Add employee"}</Button>
      </div>
      <p className="text-center text-xs text-subtle">
        UI preview — saving is wired to Supabase in the logic phase.
      </p>
    </form>
  );
}
