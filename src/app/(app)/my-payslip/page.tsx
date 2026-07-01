import { Wallet } from "lucide-react";
import { computePayrollForMonth } from "@/lib/db/payroll";
import { getSessionProfile, hasSupabaseEnv } from "@/lib/supabase/server";
import { PayslipView } from "@/components/payroll/payslip-view";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

const PAYROLL_MONTH = "2026-05";

export default async function MyPayslipPage() {
  if (!hasSupabaseEnv()) {
    return (
      <>
        <PageHeader title="My payslip" description="Your monthly pay, fully itemized." />
        <EmptyState
          icon={<Wallet className="h-5 w-5" />}
          title="Connect the database"
          description="Your payslip loads from Supabase once the environment is configured."
        />
      </>
    );
  }

  const session = await getSessionProfile();

  if (!session?.employeeId) {
    return (
      <>
        <PageHeader title="My payslip" description="Your monthly pay, fully itemized." />
        <EmptyState
          icon={<Wallet className="h-5 w-5" />}
          title="No payslip linked to your account."
          description="This account is not tied to an employee record, so there is no payslip to show."
        />
      </>
    );
  }

  const rows = await computePayrollForMonth(PAYROLL_MONTH);
  const row = rows.find((r) => r.employeeId === session.employeeId);

  if (!row) {
    return (
      <>
        <PageHeader title="My payslip" description="Your monthly pay, fully itemized." />
        <EmptyState
          icon={<Wallet className="h-5 w-5" />}
          title="No payslip for this month."
          description="Your employee record has no salary computed for this payroll month."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="My payslip" description="Your monthly pay, fully itemized." />
      <PayslipView row={row} month={PAYROLL_MONTH} />
    </>
  );
}
