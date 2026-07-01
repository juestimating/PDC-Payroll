import { listOvertime, listEstimationEmployees } from "@/lib/db/overtime";
import { getSessionProfile, hasSupabaseEnv } from "@/lib/supabase/server";
import { OvertimeClient } from "@/components/overtime/overtime-client";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";
import { Timer } from "lucide-react";

export const dynamic = "force-dynamic";

const DEFAULT_MONTH = "2026-05";

export default async function OvertimePage() {
  if (!hasSupabaseEnv()) {
    return (
      <>
        <PageHeader title="Overtime" description="Estimation-team overtime, billed against monthly Basic." />
        <EmptyState
          icon={<Timer className="h-5 w-5" />}
          title="Connect the database"
          description="Overtime loads from Supabase once the environment is configured."
        />
      </>
    );
  }

  const [overtime, employees, session] = await Promise.all([
    listOvertime(DEFAULT_MONTH),
    listEstimationEmployees(),
    getSessionProfile(),
  ]);
  const canManage =
    session?.role === "super_admin" || session?.role === "hr" || session?.role === "estimation_lead";

  return (
    <OvertimeClient
      overtime={overtime}
      employees={employees}
      month={DEFAULT_MONTH}
      canManage={canManage}
    />
  );
}
