import { TrendingDown } from "lucide-react";
import { getDeductionsForMonth, listDeductionMonths } from "@/lib/db/deductions";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { DeductionsClient } from "@/components/adjustments/deductions-client";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function DeductionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  if (!hasSupabaseEnv()) {
    return (
      <>
        <PageHeader
          title="Deductions"
          description="Advance, unpaid-leave and loan deductions, derived exactly as payroll counts them."
        />
        <EmptyState
          icon={<TrendingDown className="h-5 w-5" />}
          title="Connect the database"
          description="Deductions load from Supabase once the environment is configured."
        />
      </>
    );
  }

  const sp = await searchParams;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonth;

  const [rows, months] = await Promise.all([getDeductionsForMonth(month), listDeductionMonths()]);

  return <DeductionsClient rows={rows} month={month} months={months} />;
}
