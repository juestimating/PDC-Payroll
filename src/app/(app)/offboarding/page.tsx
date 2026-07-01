import { UserMinus } from "lucide-react";
import { listDepartures } from "@/lib/db/offboarding";
import { listEmployeeOptions } from "@/lib/db/adjustments";
import { getSessionProfile, hasSupabaseEnv } from "@/lib/supabase/server";
import { OffboardingClient } from "@/components/offboarding/offboarding-client";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function OffboardingPage() {
  if (!hasSupabaseEnv()) {
    return (
      <>
        <PageHeader
          title="Offboarding"
          description="No gratuity — final salary is prorated to the last working day."
        />
        <EmptyState
          icon={<UserMinus className="h-5 w-5" />}
          title="Connect the database"
          description="Departures load from Supabase once the environment is configured."
        />
      </>
    );
  }

  const [departures, employeeOptions, session] = await Promise.all([
    listDepartures(),
    listEmployeeOptions(),
    getSessionProfile(),
  ]);
  const canManage = session?.role === "super_admin" || session?.role === "hr";

  return (
    <OffboardingClient departures={departures} employeeOptions={employeeOptions} canManage={canManage} />
  );
}
