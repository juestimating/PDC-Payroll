import type { Employee, PayrollRecord } from "@/lib/data";
import { commissionTotal } from "@/lib/data";
import { formatMonthKeyLong } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { Sheet, BreakdownRow } from "@/components/ui/sheet";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">{title}</p>
      <div>{children}</div>
    </div>
  );
}

function SubRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm text-muted">
      <span>{label}</span>
      <span className="tabular-nums">
        <Money value={value} />
      </span>
    </div>
  );
}

/**
 * The full per-employee salary breakdown. Reused by the payroll sheet, the
 * employee profile, and the employee self-service payslip — one source of truth
 * for how a salary decomposes.
 */
export function PayrollBreakdownBody({
  record,
  employee,
  departmentName,
}: {
  record: PayrollRecord;
  employee: Employee;
  departmentName?: string;
}) {
  const c = record.commission;
  const ot = record.overtime;
  const deductionTotal = record.deductions.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Avatar name={employee.name} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{employee.name}</p>
          <p className="truncate text-sm text-muted">
            {employee.designation}
            {departmentName ? ` · ${departmentName}` : ""}
          </p>
        </div>
        <StatusBadge status={record.status} />
      </div>

      <Section title="Earnings">
        {record.days < 30 ? (
          <p className="mb-1.5 text-xs text-muted">
            Prorated for {record.days} / 30 days · full month{" "}
            <Money value={record.contractGross} />
          </p>
        ) : null}
        <BreakdownRow label="Basic salary" value={<Money value={record.basic} />} />
        <BreakdownRow label="Medical allowance" value={<Money value={record.medical} />} />
        <BreakdownRow label="Travel allowance" value={<Money value={record.travel} />} />

        {c ? (
          <div className="my-1 rounded-lg bg-surface-muted/70 px-3">
            <BreakdownRow label="Sales commission" value={<Money value={commissionTotal(c)} />} />
            <div className="border-t border-border/70 py-1.5 pl-3">
              <SubRow label="New sales commission" value={c.newSales} />
              <SubRow label="Old bonus" value={c.oldBonus} />
              <SubRow label="Additional bonus" value={c.additionalBonus} />
            </div>
          </div>
        ) : null}

        {ot ? (
          <div className="my-1 rounded-lg bg-surface-muted/70 px-3">
            <BreakdownRow label="Overtime" value={<Money value={ot.amount} />} />
            <p className="pb-2 pl-3 text-xs text-muted">
              {ot.hours} hrs × <Money value={ot.ratePerHour} /> /hr · {ot.workingDays} working days
            </p>
          </div>
        ) : null}

        <BreakdownRow label="Gross salary" value={<Money value={record.gross} />} emphasis />
      </Section>

      <Section title="Tax">
        <BreakdownRow label="Taxable salary" value={<Money value={record.taxable} />} />
        <BreakdownRow
          label="Withholding tax"
          value={
            <span className="text-negative">
              <Money value={record.withholdingTax} />
            </span>
          }
        />
      </Section>

      {record.deductions.length > 0 ? (
        <Section title="Deductions">
          {record.deductions.map((d, i) => (
            <BreakdownRow
              key={i}
              label={d.label}
              value={
                <span className="text-negative">
                  <Money value={d.amount} signed={false} />
                </span>
              }
            />
          ))}
          <BreakdownRow label="Total deductions" value={<Money value={deductionTotal} />} emphasis />
        </Section>
      ) : null}

      <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Net salary</p>
            <p className="text-xs text-muted">Gross − tax − deductions</p>
          </div>
          <p className="text-xl font-bold tabular-nums text-brand-700">
            <Money value={record.net} />
          </p>
        </div>
      </div>

      {employee.bank || employee.account || employee.accountTitle || employee.cnic || employee.city ? (
        <Section title="Bank transfer details">
          {employee.bank ? <BreakdownRow label="Bank" value={employee.bank} /> : null}
          {employee.account ? (
            <BreakdownRow label="Account number" value={<span className="tabular-nums">{employee.account}</span>} />
          ) : null}
          {employee.accountTitle ? <BreakdownRow label="Account title" value={employee.accountTitle} /> : null}
          {employee.cnic ? (
            <BreakdownRow label="CNIC" value={<span className="tabular-nums">{employee.cnic}</span>} />
          ) : null}
          {employee.city ? <BreakdownRow label="City" value={employee.city} /> : null}
        </Section>
      ) : null}

      {employee.note ? (
        <div className="rounded-lg border-l-2 border-brand-400 bg-surface-muted/60 px-3 py-2 text-xs text-muted">
          Note: {employee.note}
        </div>
      ) : null}

      <p className="text-xs text-subtle">
        Recomputed from components equals the stored net · {formatMonthKeyLong(record.month)}.
      </p>
    </div>
  );
}

/** Convenience wrapper: the breakdown inside a right-side sheet. */
export function PayslipSheet({
  open,
  onClose,
  record,
  employee,
  departmentName,
}: {
  open: boolean;
  onClose: () => void;
  record: PayrollRecord | null;
  employee: Employee | null;
  departmentName?: string;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Payslip detail" subtitle={employee?.name ?? ""}>
      {record && employee ? (
        <PayrollBreakdownBody record={record} employee={employee} departmentName={departmentName} />
      ) : null}
    </Sheet>
  );
}
