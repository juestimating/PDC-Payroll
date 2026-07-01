import { CheckCheck } from "lucide-react";
import { listPendingApprovals } from "@/lib/db/loans";
import { getSessionProfile, hasSupabaseEnv } from "@/lib/supabase/server";
import { ApprovalsClient } from "@/components/loans/approvals-client";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  if (!hasSupabaseEnv()) {
    return (
      <>
        <PageHeader title="Approvals" description="Loan payments awaiting sign-off." />
        <EmptyState
          icon={<CheckCheck className="h-5 w-5" />}
          title="Connect the database"
          description="Approvals load from Supabase once the environment is configured."
        />
      </>
    );
  }

  const [pending, session] = await Promise.all([listPendingApprovals(), getSessionProfile()]);
  const canDecide = session?.role === "super_admin" || session?.role === "admin";

  return <ApprovalsClient pending={pending} canDecide={canDecide} />;
}
