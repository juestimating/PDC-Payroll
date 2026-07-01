import { Wallet } from "lucide-react";
import { computePayrollForMonth } from "@/lib/db/payroll";
import { listEntities } from "@/lib/db/employees";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { PayrollRunClient } from "@/components/payroll/payroll-run-client";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  if (!hasSupabaseEnv()) {
    return (
      <>
        <PageHeader title="Payroll Run" description="Monthly salary close across every entity." />
        <EmptyState
          icon={<Wallet className="h-5 w-5" />}
          title="Connect the database"
          description="Payroll loads from Supabase once the environment is configured."
        />
      </>
    );
  }

  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : "2026-05";
  const [rows, entities] = await Promise.all([computePayrollForMonth(month), listEntities()]);

  return <PayrollRunClient rows={rows} entities={entities} month={month} />;
}
