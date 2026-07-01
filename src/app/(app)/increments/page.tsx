import { listIncrements, listEmployeeOptions } from "@/lib/db/increments";
import { getSessionProfile, hasSupabaseEnv } from "@/lib/supabase/server";
import { IncrementsClient } from "@/components/increments/increments-client";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";
import { TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function IncrementsPage() {
  if (!hasSupabaseEnv()) {
    return (
      <>
        <PageHeader title="Increments" description="Give a % on gross — split across all components." />
        <EmptyState
          icon={<TrendingUp className="h-5 w-5" />}
          title="Connect the database"
          description="Increments load from Supabase once the environment is configured."
        />
      </>
    );
  }

  const [increments, employees, session] = await Promise.all([
    listIncrements(),
    listEmployeeOptions(),
    getSessionProfile(),
  ]);
  const canManage = session?.role === "super_admin" || session?.role === "hr";

  return <IncrementsClient increments={increments} employees={employees} canManage={canManage} />;
}
