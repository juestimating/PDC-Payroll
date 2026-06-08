"use client";

import { useState } from "react";
import { CalendarDays, FileText, UserMinus } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace";
import {
  EXIT_REASON_LABEL,
  departmentById,
  getEmployees,
  teamById,
} from "@/lib/data";
import type { Employee, ExitReason, FinalSettlement } from "@/lib/data";
import { formatMonthKeyLong } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { BreakdownRow } from "@/components/ui/sheet";

export function tenureLabel(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts: string[] = [];
  if (y) parts.push(`${y} yr${y > 1 ? "s" : ""}`);
  if (m) parts.push(`${m} mo`);
  return parts.join(" ") || "< 1 mo";
}

/** Read-only final-settlement breakdown for a departed employee. */
export function SettlementBody({
  employee,
  settlement,
}: {
  employee: Employee;
  settlement: FinalSettlement;
}) {
  const dept = departmentById.get(employee.departmentId);
  const team = teamById.get(employee.teamId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Avatar name={employee.name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-foreground">{employee.name}</p>
          <p className="truncate text-sm text-muted">{employee.designation}</p>
        </div>
        <StatusBadge status={settlement.status} />
      </div>

      <div className="flex flex-wrap gap-2">
        {dept ? (
          <Badge tone="brand">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dept.color }} />
            {dept.name}
          </Badge>
        ) : null}
        {team ? <Badge>{team.name}</Badge> : null}
        <Badge tone="warning">{EXIT_REASON_LABEL[settlement.exitReason]}</Badge>
      </div>

      {/* Employment summary */}
      <div className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-surface-muted/50 p-3 text-center">
        <Summary label="Joined" value={employee.joinedOn} />
        <Summary label="Left" value={settlement.leftOn} />
        <Summary label="Tenure" value={tenureLabel(settlement.tenureMonths)} />
      </div>

      {employee.exitNote ? (
        <p className="flex gap-2 rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {employee.exitNote}
        </p>
      ) : null}

      {/* Earnings */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">
          Final dues — earnings
        </p>
        {settlement.earnings.map((l) => (
          <BreakdownRow key={l.label} label={l.label} sub={l.note} value={<Money value={l.amount} />} />
        ))}
        <BreakdownRow
          label="Gross earnings"
          value={<Money value={settlement.grossEarnings} />}
          emphasis
        />
      </div>

      {/* Deductions */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">Deductions</p>
        {settlement.deductions.length > 0 ? (
          <>
            {settlement.deductions.map((l) => (
              <BreakdownRow
                key={l.label}
                label={l.label}
                sub={l.note}
                value={
                  <span className="text-negative">
                    <Money value={l.amount} />
                  </span>
                }
              />
            ))}
            <BreakdownRow
              label="Total deductions"
              value={
                <span className="text-negative">
                  <Money value={settlement.totalDeductions} />
                </span>
              }
              emphasis
            />
          </>
        ) : (
          <p className="py-2 text-sm text-subtle">No deductions.</p>
        )}
      </div>

      {/* Net */}
      <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              Net payable
            </p>
            <p className="mt-0.5 text-xs text-brand-600/80">
              {settlement.status === "pending" ? "Awaiting disbursement" : "Settlement cleared"}
            </p>
          </div>
          <p className="text-xl font-semibold text-brand-700">
            <Money value={settlement.net} />
          </p>
        </div>
      </div>

      <p className="text-center text-xs text-subtle">
        Final-settlement figures are illustrative — derived from salary structure + tenure. Replace
        with your settlement policy in the logic phase.
      </p>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{label}</p>
      <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">{value}</p>
    </div>
  );
}

/**
 * Form to mark an active employee as left. UI persists to the workspace overlay
 * (browser) in this phase; the logic phase writes it to Supabase.
 */
export function OffboardForm({
  presetEmployeeId,
  onClose,
}: {
  presetEmployeeId?: string;
  onClose: () => void;
}) {
  const { openMonth, offboard } = useWorkspace();
  const active = getEmployees({ status: "active" });

  const [employeeId, setEmployeeId] = useState(presetEmployeeId ?? active[0]?.id ?? "");
  const [leftOn, setLeftOn] = useState(`${openMonth}-28`);
  const [reason, setReason] = useState<ExitReason>("resigned");
  const [note, setNote] = useState("");

  const locked = Boolean(presetEmployeeId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) return;
    offboard(employeeId, { leftOn, exitReason: reason, exitNote: note.trim() || undefined });
    onClose();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-warning-soft bg-warning-soft/50 p-3">
        <UserMinus className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <p className="text-xs text-muted">
          Marking someone as left removes them from the next month&apos;s payroll and generates their
          final settlement. Their history stays on record.
        </p>
      </div>

      <Field label="Employee" required>
        <Select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          disabled={locked}
          required
        >
          {locked ? null : (
            <option value="" disabled>
              Select an employee…
            </option>
          )}
          {active.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} — {e.designation}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Last working day" required>
          <Input type="date" value={leftOn} onChange={(e) => setLeftOn(e.target.value)} required />
        </Field>
        <Field label="Reason" required>
          <Select value={reason} onChange={(e) => setReason(e.target.value as ExitReason)}>
            {(Object.keys(EXIT_REASON_LABEL) as ExitReason[]).map((r) => (
              <option key={r} value={r}>
                {EXIT_REASON_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Note" hint="Optional — context for the record (handover, rehire eligibility…).">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Served full notice. Eligible for rehire."
        />
      </Field>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="danger">
          <CalendarDays className="h-4 w-4" />
          Mark as left
        </Button>
      </div>
    </form>
  );
}
