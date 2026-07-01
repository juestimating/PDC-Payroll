import { Landmark } from "lucide-react";
import { computePayrollForMonth } from "@/lib/db/payroll";
import { listEntities } from "@/lib/db/employees";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { TaxClient } from "@/components/tax/tax-client";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function TaxPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  if (!hasSupabaseEnv()) {
    return (
      <>
        <PageHeader title="Tax & Compliance" description="FBR withholding register." />
        <EmptyState
          icon={<Landmark className="h-5 w-5" />}
          title="Connect the database"
          description="The tax register loads from Supabase once the environment is configured."
        />
      </>
    );
  }

  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : "2026-05";
  const [rows, entities] = await Promise.all([computePayrollForMonth(month), listEntities()]);

  return <TaxClient rows={rows} entities={entities} month={month} />;
}
