"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Search, UserMinus, Users, Wallet } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace";
import {
  EXIT_REASON_LABEL,
  departmentById,
  getDepartedEmployees,
  offboardingSummary,
} from "@/lib/data";
import type { DepartedEmployee } from "@/lib/data";
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
import { OffboardForm, SettlementBody, tenureLabel } from "@/components/offboarding/settlement";

export default function OffboardingPage() {
  // Subscribe to workspace changes so newly-offboarded people appear immediately.
  const { version, isUiDeparted, reinstate } = useWorkspace();
  void version;

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<DepartedEmployee | null>(null);
  const [offboardOpen, setOffboardOpen] = useState(false);

  const summary = offboardingSummary();
  let rows = getDepartedEmployees();
  if (status !== "all") rows = rows.filter((r) => r.settlement.status === status);
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(
      (r) => r.name.toLowerCase().includes(s) || r.designation.toLowerCase().includes(s),
    );
  }

  const columns: Column<DepartedEmployee>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={r.name} size={32} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.name}</p>
            <p className="truncate text-xs text-subtle">{r.designation}</p>
          </div>
        </div>
      ),
    },
    {
      key: "department",
      header: "Department",
      hideOnMobile: true,
      cell: (r) => {
        const d = departmentById.get(r.departmentId);
        return (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d?.color }} />
            {d?.name}
          </span>
        );
      },
    },
    {
      key: "left",
      header: "Left on",
      hideOnMobile: true,
      cell: (r) => <span className="text-sm tabular-nums text-muted">{r.leftOn}</span>,
    },
    {
      key: "tenure",
      header: "Tenure",
      hideOnMobile: true,
      cell: (r) => <span className="text-sm text-muted">{tenureLabel(r.settlement.tenureMonths)}</span>,
    },
    {
      key: "reason",
      header: "Reason",
      hideOnMobile: true,
      cell: (r) => <Badge tone="warning">{EXIT_REASON_LABEL[r.exitReason]}</Badge>,
    },
    {
      key: "dues",
      header: "Net dues",
      align: "right",
      cell: (r) => <Money value={r.settlement.net} className="font-semibold text-brand-700" />,
    },
    {
      key: "status",
      header: "Settlement",
      align: "center",
      cell: (r) => <StatusBadge status={r.settlement.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Offboarding"
        description="Departed employees, their final settlement, and outstanding dues."
        actions={
          <Button onClick={() => setOffboardOpen(true)}>
            <UserMinus className="h-4 w-4" />
            Offboard employee
          </Button>
        }
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search departed people…"
              className="pl-9"
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
            <option value="all">All settlements</option>
            <option value="pending">Pending</option>
            <option value="cleared">Cleared</option>
          </Select>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Departed"
          value={formatNumber(summary.count)}
          hint={`${summary.thisYear} this year`}
          icon={<Users className="h-4.5 w-4.5" />}
        />
        <StatCard
          label="Pending settlements"
          value={formatNumber(summary.pending)}
          hint={`${summary.cleared} cleared`}
          icon={<Clock className="h-4.5 w-4.5" />}
        />
        <StatCard
          label="Outstanding dues"
          value={<Money value={summary.pendingDue} compact />}
          hint="net, still to pay"
          icon={<Wallet className="h-4.5 w-4.5" />}
        />
        <StatCard
          label="Total final dues"
          value={<Money value={summary.netDue} compact />}
          hint="all settlements"
          icon={<CheckCircle2 className="h-4.5 w-4.5" />}
        />
      </div>

      <Card className="mt-4 overflow-hidden">
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.id}
          onRowClick={(r) => setSelected(r)}
          dense
          emptyState={
            <EmptyState
              icon={<UserMinus className="h-5 w-5" />}
              title="No departed employees"
              description="When someone leaves, mark them here to generate their final settlement."
              action={
                <Button onClick={() => setOffboardOpen(true)}>
                  <UserMinus className="h-4 w-4" />
                  Offboard employee
                </Button>
              }
            />
          }
          mobileCard={(r) => (
            <Card interactive className="p-3">
              <div className="flex items-center gap-3">
                <Avatar name={r.name} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{r.name}</p>
                  <p className="truncate text-xs text-subtle">Left {r.leftOn}</p>
                </div>
                <StatusBadge status={r.settlement.status} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Badge tone="warning">{EXIT_REASON_LABEL[r.exitReason]}</Badge>
                <span className="text-sm font-semibold tabular-nums text-brand-700">
                  <Money value={r.settlement.net} compact />
                </span>
              </div>
            </Card>
          )}
        />
      </Card>

      <p className="mt-3 text-center text-xs text-subtle">
        Tap any row to see the full final settlement — earnings, deductions, and net payable.
      </p>

      {/* Settlement detail */}
      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Final settlement"
        subtitle={selected?.name ?? ""}
        footer={
          selected ? (
            <div className="flex justify-end gap-2">
              {isUiDeparted(selected.id) ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    reinstate(selected.id);
                    setSelected(null);
                  }}
                >
                  Reinstate
                </Button>
              ) : null}
              <Button onClick={() => setSelected(null)}>Close</Button>
            </div>
          ) : null
        }
      >
        {selected ? <SettlementBody employee={selected} settlement={selected.settlement} /> : null}
      </Sheet>

      {/* Offboard a new employee */}
      <Sheet
        open={offboardOpen}
        onClose={() => setOffboardOpen(false)}
        title="Offboard employee"
        subtitle="Mark an active employee as left"
        width={560}
      >
        <OffboardForm onClose={() => setOffboardOpen(false)} />
      </Sheet>
    </>
  );
}
