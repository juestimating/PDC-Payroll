import { CreditCard } from "lucide-react";
import { listExpenses, listExpenseCategories } from "@/lib/db/expenses";
import { listEntities } from "@/lib/db/employees";
import { getSessionProfile, hasSupabaseEnv } from "@/lib/supabase/server";
import { ExpensesClient } from "@/components/expenses/expenses-client";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  if (!hasSupabaseEnv()) {
    return (
      <>
        <PageHeader title="Expenses" description="Company costs across JU, PDC, and B4U." />
        <EmptyState
          icon={<CreditCard className="h-5 w-5" />}
          title="Connect the database"
          description="Expenses load from Supabase once the environment is configured."
        />
      </>
    );
  }

  const [expenses, categories, entities, session] = await Promise.all([
    listExpenses(),
    listExpenseCategories(),
    listEntities(),
    getSessionProfile(),
  ]);
  const canManage = session?.role === "super_admin" || session?.role === "admin";

  return (
    <ExpensesClient expenses={expenses} categories={categories} entities={entities} canManage={canManage} />
  );
}
