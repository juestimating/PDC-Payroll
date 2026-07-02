import { listIncentives, listEmployeeOptions } from "@/lib/db/incentives";
import { getSessionProfile, hasSupabaseEnv } from "@/lib/supabase/server";
import { IncentivesClient } from "@/components/incentives/incentives-client";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";
import { Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function IncentivesPage() {
  if (!hasSupabaseEnv()) {
    return (
      <>
        <PageHeader
          title="Sales Incentives"
          description="FX commission on sales plus manual New Sales / Recurring / Sales Bonus cells, with KPI-gated payout."
        />
        <EmptyState
          icon={<Trophy className="h-5 w-5" />}
          title="Connect the database"
          description="Incentives load from Supabase once the environment is configured."
        />
      </>
    );
  }

  const [incentives, employees, session] = await Promise.all([
    listIncentives(),
    listEmployeeOptions(),
    getSessionProfile(),
  ]);
  const canManage =
    session?.role === "super_admin" || session?.role === "hr" || session?.role === "sales_lead";

  return <IncentivesClient incentives={incentives} employees={employees} canManage={canManage} />;
}
