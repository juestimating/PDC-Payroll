"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, UserMinus } from "lucide-react";
import { EXIT_REASONS, EXIT_REASON_LABEL, type DepartureRow } from "@/lib/db/offboarding-shared";
import type { EmployeeOption } from "@/lib/db/adjustments";
import { markAsLeftAction } from "@/app/(app)/offboarding/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { Sheet } from "@/components/ui/sheet";

export function OffboardingClient({
  departures,
  employeeOptions,
  canManage,
}: {
  departures: DepartureRow[];
  employeeOptions: EmployeeOption[];
  canManage: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);

  const columns: Column<DepartureRow>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{r.name}</p>
          {r.code ? <p className="truncate text-xs text-subtle">{r.code}</p> : null}
        </div>
      ),
    },
    {
      key: "company",
      header: "Company",
      hideOnMobile: true,
      cell: (r) =>
        r.entityId ? <Badge tone="brand">{r.entityId}</Badge> : <span className="text-subtle">—</span>,
    },
    {
      key: "last",
      header: "Last working day",
      hideOnMobile: true,
      cell: (r) => <span className="text-sm tabular-nums text-muted">{r.lastWorkingDay}</span>,
    },
    {
      key: "reason",
      header: "Reason",
      align: "center",
      cell: (r) =>
        r.exitReason ? (
          <Badge tone="warning">{EXIT_REASON_LABEL[r.exitReason]}</Badge>
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Offboarding"
        description="No gratuity — final salary is prorated to the last working day."
        actions={
          canManage ? (
            <Button onClick={() => setAddOpen(true)}>
              <UserMinus className="h-4 w-4" />
              Mark as left
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">
        There is <span className="font-semibold">no gratuity or end-of-service</span> settlement. When
        someone leaves, the payroll engine simply prorates their final month to the last working day.
      </div>

      <Card className="overflow-hidden">
        <DataTable
          columns={columns}
          rows={departures}
          getRowKey={(r) => r.id}
          dense
          emptyState={
            <EmptyState
              icon={<UserMinus className="h-5 w-5" />}
              title="No departures yet"
              description={
                canManage
                  ? "When someone leaves, mark them here to prorate their final month."
                  : "Departed employees will appear here once HR marks them as left."
              }
              action={
                canManage ? (
                  <Button onClick={() => setAddOpen(true)}>
                    <UserMinus className="h-4 w-4" />
                    Mark as left
                  </Button>
                ) : undefined
              }
            />
          }
          mobileCard={(r) => (
            <Card className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.name}</p>
                  <p className="truncate text-xs text-subtle">Left {r.lastWorkingDay}</p>
                </div>
                {r.exitReason ? (
                  <Badge tone="warning">{EXIT_REASON_LABEL[r.exitReason]}</Badge>
                ) : null}
              </div>
              <div className="mt-2 flex items-center gap-2">
                {r.entityId ? <Badge tone="brand">{r.entityId}</Badge> : null}
                {r.code ? <span className="ml-auto text-xs text-subtle">{r.code}</span> : null}
              </div>
            </Card>
          )}
        />
      </Card>

      {canManage ? (
        <Sheet
          open={addOpen}
          onClose={() => setAddOpen(false)}
          title="Mark as left"
          subtitle="Final month is prorated — no gratuity"
          width={520}
        >
          <MarkAsLeftForm employeeOptions={employeeOptions} onClose={() => setAddOpen(false)} />
        </Sheet>
      ) : null}
    </>
  );
}

function MarkAsLeftForm({
  employeeOptions,
  onClose,
}: {
  employeeOptions: EmployeeOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState(employeeOptions[0]?.id ?? "");
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [exitReason, setExitReason] = useState<string>("resigned");
  const [exitNote, setExitNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await markAsLeftAction({
      employeeId,
      lastWorkingDay,
      exitReason,
      exitNote: exitNote || null,
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
        <p className="mt-3 text-base font-semibold text-foreground">Marked as left</p>
        <p className="mt-1 text-sm text-muted">
          They stay on payroll through their exit month, prorated to that date, and drop off from
          the next month.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-negative/30 bg-negative-soft px-3 py-2 text-sm text-negative"
        >
          {error}
        </div>
      ) : null}

      <Field label="Employee" required>
        <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
          {employeeOptions.length === 0 ? <option value="">No active employees</option> : null}
          {employeeOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.code ? `${o.code} · ${o.name}` : o.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Last working day" required>
          <Input
            type="date"
            value={lastWorkingDay}
            onChange={(e) => setLastWorkingDay(e.target.value)}
            required
          />
        </Field>
        <Field label="Exit reason" required>
          <Select value={exitReason} onChange={(e) => setExitReason(e.target.value)} required>
            {EXIT_REASONS.map((r) => (
              <option key={r} value={r}>
                {EXIT_REASON_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Note" hint="Optional context for the record">
        <Textarea
          value={exitNote}
          onChange={(e) => setExitNote(e.target.value)}
          placeholder="Optional"
        />
      </Field>

      <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted">
        No gratuity or end-of-service is paid. They remain on the exit month&apos;s payroll, prorated
        to the last working day, and are unlisted from later months.
      </p>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !employeeId}>
          {submitting ? "Saving…" : "Mark as left"}
        </Button>
      </div>
    </form>
  );
}
