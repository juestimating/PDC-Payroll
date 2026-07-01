import { listEmployees, listEntities, listTeams } from "@/lib/db/employees";
import { getSessionProfile, hasSupabaseEnv } from "@/lib/supabase/server";
import { PeopleClient } from "@/components/employees/people-client";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  // Demo/mock mode (no Supabase env, e.g. before prod env is set): show a notice.
  if (!hasSupabaseEnv()) {
    return (
      <>
        <PageHeader title="People" description="Your team across JU, PDC, and B4U." />
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="Connect the database"
          description="People loads from Supabase once the environment is configured."
        />
      </>
    );
  }

  const [employees, entities, teams, session] = await Promise.all([
    listEmployees(),
    listEntities(),
    listTeams(),
    getSessionProfile(),
  ]);
  const canManage = session?.role === "super_admin" || session?.role === "hr";

  return <PeopleClient employees={employees} entities={entities} teams={teams} canManage={canManage} />;
}
