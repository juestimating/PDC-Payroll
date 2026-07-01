import { HandCoins } from "lucide-react";
import { listLoans } from "@/lib/db/loans";
import { listEmployeeOptions } from "@/lib/db/adjustments";
import { getSessionProfile, hasSupabaseEnv } from "@/lib/supabase/server";
import { LoansClient } from "@/components/loans/loans-client";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function LoansPage() {
  if (!hasSupabaseEnv()) {
    return (
      <>
        <PageHeader title="Loans" description="Approved staff loans with repayment schedules." />
        <EmptyState
          icon={<HandCoins className="h-5 w-5" />}
          title="Connect the database"
          description="Loans load from Supabase once the environment is configured."
        />
      </>
    );
  }

  const [loans, employees, session] = await Promise.all([
    listLoans(),
    listEmployeeOptions(),
    getSessionProfile(),
  ]);
  const canManage = session?.role === "super_admin" || session?.role === "hr";

  return <LoansClient loans={loans} employees={employees} canManage={canManage} />;
}
