"use client";

import { UserMinus, Wallet } from "lucide-react";
import type { PayrollRow } from "@/lib/db/payroll";
import { formatMonthKeyLong } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { BreakdownRow } from "@/components/ui/sheet";

/**
 * Read-only payslip for the signed-in employee. Mirrors the payroll engine:
 * component split is on the full-month contract gross (D); tax + deductions are
 * on the EARNED (days-worked) salary; net is floored at 0. No gratuity here —
 * the engine prorates by workedDays when a last working day is set.
 */
export function PayslipView({ row, month }: { row: PayrollRow; month: string }) {
  const prorated = row.workedDays < 30;
  const leftThisMonth = !!row.lastWorkingDay && row.lastWorkingDay.slice(0, 7) === month;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Net pay hero */}
      <div
        className="overflow-hidden rounded-2xl p-6 text-white shadow-card"
        style={{
          backgroundImage: "linear-gradient(135deg, var(--color-brand-600), var(--color-brand-900))",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/70">Net pay</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              <Money value={row.net} />
            </p>
            <p className="mt-1 text-sm text-white/70">{formatMonthKeyLong(month)}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
            <Wallet className="h-3.5 w-3.5" />
            {row.onHold ? "On hold" : prorated ? "Prorated" : "Full month"}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/15 pt-4">
          <div>
            <p className="text-xs text-white/60">Earned gross</p>
            <p className="text-base font-semibold tabular-nums">
              <Money value={row.earnedGross} />
            </p>
          </div>
          <div>
            <p className="text-xs text-white/60">Withholding tax</p>
            <p className="text-base font-semibold tabular-nums">
              <Money value={row.wht} />
            </p>
          </div>
        </div>
      </div>

      {/* Final-month notice for leavers */}
      {leftThisMonth ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <UserMinus className="h-4 w-4 shrink-0" />
          Left {row.lastWorkingDay} — final prorated month.
        </div>
      ) : null}

      {/* Identity strip */}
      <Card className="mt-4">
        <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-5 text-sm">
          <div>
            <p className="text-xs text-subtle">Employee</p>
            <p className="font-medium text-foreground">{row.name}</p>
          </div>
          {row.code ? (
            <div>
              <p className="text-xs text-subtle">Code</p>
              <p className="font-medium text-foreground">{row.code}</p>
            </div>
          ) : null}
          <div>
            <p className="text-xs text-subtle">Designation</p>
            <p className="font-medium text-foreground">{row.designation}</p>
          </div>
          <div className="ml-auto">
            <Badge tone="neutral">{row.workedDays} / 30 days worked</Badge>
          </div>
        </CardBody>
      </Card>

      {/* Component breakdown (on full-month contract gross D) */}
      <Card className="mt-4">
        <CardHeader
          title="Salary breakdown"
          subtitle={`Components on full-month gross of ${moneyText(row.salary)}`}
        />
        <CardBody>
          <BreakdownRow
            label="Basic (65%)"
            value={<Money value={row.basic} />}
            accent="var(--color-brand-500)"
          />
          <BreakdownRow
            label="Travel allowance (10%)"
            value={<Money value={row.ta} />}
            accent="var(--color-info)"
          />
          <BreakdownRow
            label="Medical (10%)"
            value={<Money value={row.medical} />}
            accent="var(--color-positive)"
          />
          <BreakdownRow
            label="House rent (15%)"
            value={<Money value={row.hra} />}
            accent="var(--color-warning)"
          />
          <BreakdownRow
            label="Full-month gross"
            value={<Money value={row.salary} />}
            sub="Basic + TA + Medical + HRA"
            emphasis
          />

          <div className="mt-4 space-y-0 border-t border-border pt-2">
            <BreakdownRow
              label="Earned gross"
              value={<Money value={row.earnedGross} />}
              sub={prorated ? `Prorated: gross × ${row.workedDays}/30` : "Full month worked"}
            />
            {row.leaveDays > 0 ? (
              <BreakdownRow
                label="Unpaid leave"
                value={`${row.leaveDays} day${row.leaveDays === 1 ? "" : "s"}`}
                sub="Reduces days worked"
              />
            ) : null}
            <BreakdownRow
              label="Withholding tax"
              value={<Money value={-row.wht} />}
              sub="On earned salary, medical excluded"
            />
            {row.advance > 0 ? (
              <BreakdownRow label="Advance" value={<Money value={-row.advance} />} />
            ) : null}
            {row.loanInstallment > 0 ? (
              <BreakdownRow
                label="Loan installment"
                value={<Money value={-row.loanInstallment} />}
              />
            ) : null}
            <BreakdownRow
              label="Net pay"
              value={<Money value={row.net} />}
              sub="Earned gross − tax − deductions"
              emphasis
            />
          </div>
        </CardBody>
      </Card>

      <p className="mt-3 text-center text-xs text-subtle">
        No gratuity or end-of-service — pay is prorated to days worked.
      </p>
    </div>
  );
}

function moneyText(n: number): string {
  return `Rs ${Math.round(n).toLocaleString()}`;
}
