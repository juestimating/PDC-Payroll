import { CalendarOff } from "lucide-react";
import { listUnpaidLeaves, listEmployeeOptions } from "@/lib/db/adjustments";
import { getSessionProfile, hasSupabaseEnv } from "@/lib/supabase/server";
import { LeavesClient } from "@/components/adjustments/leaves-client";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function LeavesPage() {
  if (!hasSupabaseEnv()) {
    return (
      <>
        <PageHeader title="Unpaid leaves" description="Manually logged unpaid days; deduction = gross × days / 30." />
        <EmptyState
          icon={<CalendarOff className="h-5 w-5" />}
          title="Connect the database"
          description="Unpaid leaves load from Supabase once the environment is configured."
        />
      </>
    );
  }

  const [leaves, employees, session] = await Promise.all([
    listUnpaidLeaves(),
    listEmployeeOptions(),
    getSessionProfile(),
  ]);
  const canManage = session?.role === "super_admin" || session?.role === "hr";

  return <LeavesClient leaves={leaves} employees={employees} canManage={canManage} />;
}
