import { listAdvances, listEmployeeOptions } from "@/lib/db/adjustments";
import { getSessionProfile, hasSupabaseEnv } from "@/lib/supabase/server";
import { AdvancesClient } from "@/components/adjustments/advances-client";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";
import { Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdvancesPage() {
  if (!hasSupabaseEnv()) {
    return (
      <>
        <PageHeader title="Advances" description="Fixed monthly advances deducted from that month's salary." />
        <EmptyState
          icon={<Wallet className="h-5 w-5" />}
          title="Connect the database"
          description="Advances load from Supabase once the environment is configured."
        />
      </>
    );
  }

  const [advances, employees, session] = await Promise.all([
    listAdvances(),
    listEmployeeOptions(),
    getSessionProfile(),
  ]);
  const canManage = session?.role === "super_admin" || session?.role === "hr";

  return <AdvancesClient advances={advances} employees={employees} canManage={canManage} />;
}
