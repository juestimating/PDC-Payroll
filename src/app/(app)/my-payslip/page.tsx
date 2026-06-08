"use client";

import { CheckCircle2, Download } from "lucide-react";
import { useAppState } from "@/components/providers/app-state";
import {
  departmentById,
  getEmployee,
  getEmployeePayroll,
  getPayrollRecord,
  getTasks,
} from "@/lib/data";
import { formatMonthKeyLong } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { PayrollBreakdownBody } from "@/components/payroll/payroll-breakdown";

const FALLBACK_EMPLOYEE = "emp-011";

export default function MyPayslipPage() {
  const { month, user } = useAppState();
  const employeeId = user.employeeId ?? FALLBACK_EMPLOYEE;
  const employee = getEmployee(employeeId);

  if (!employee) {
    return (
      <EmptyState title="No payslip found" description="Your employee record is not linked yet." />
    );
  }

  const history = getEmployeePayroll(employeeId);
  const record = getPayrollRecord(employeeId, month) ?? history[history.length - 1];
  const dept = departmentById.get(employee.departmentId);
  const tasks = getTasks({ assigneeId: employeeId }).filter((t) => t.status !== "done").slice(0, 4);
  const firstName = employee.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={`Salam, ${firstName}`}
        description={`${employee.designation} · ${dept?.name ?? ""}`}
      />

      {record ? (
        <>
          {/* Net pay hero */}
          <div
            className="overflow-hidden rounded-2xl p-6 text-white shadow-card"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--color-brand-600), var(--color-brand-900))",
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-white/70">Net pay</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">
                  <Money value={record.net} />
                </p>
                <p className="mt-1 text-sm text-white/70">{formatMonthKeyLong(record.month)}</p>
              </div>
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium capitalize">
                {record.status}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/15 pt-4">
              <div>
                <p className="text-xs text-white/60">Gross salary</p>
                <p className="text-base font-semibold tabular-nums">
                  <Money value={record.gross} />
                </p>
              </div>
              <div>
                <p className="text-xs text-white/60">Withholding tax</p>
                <p className="text-base font-semibold tabular-nums">
                  <Money value={record.withholdingTax} />
                </p>
              </div>
            </div>
          </div>

          {/* Full breakdown */}
          <Card className="mt-4">
            <CardHeader
              title="Salary breakdown"
              subtitle="Every figure, fully itemized"
              action={
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4" />
                  PDF
                </Button>
              }
            />
            <CardBody>
              <PayrollBreakdownBody record={record} employee={employee} departmentName={dept?.name} />
            </CardBody>
          </Card>

          {/* My tasks */}
          <Card className="mt-4">
            <CardHeader title="My tasks" subtitle="Assigned to you" />
            <CardBody>
              {tasks.length === 0 ? (
                <div className="flex items-center gap-2 py-3 text-sm text-muted">
                  <CheckCircle2 className="h-4 w-4 text-positive" />
                  You are all caught up.
                </div>
              ) : (
                <div className="space-y-1">
                  {tasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 rounded-lg px-1 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                        <p className="text-xs text-subtle">Due {t.dueDate}</p>
                      </div>
                      <StatusBadge status={t.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      ) : (
        <EmptyState title="No payslip for this month" description="Try selecting a different month." />
      )}
    </div>
  );
}
