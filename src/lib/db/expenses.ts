// =============================================================================
// Server-side expense reads from Supabase (RLS-gated). Flattened for the UI.
// =============================================================================
import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MainCategoryId } from "@/lib/db/expenses-shared";

export interface DbExpense {
  id: string;
  month: string;
  entityId: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryKind: string | null;
  /** Main bucket of the subcategory: utility_bills | it_expense | misc_expense. */
  categoryMain: string | null;
  isFixed: boolean | null;
  label: string;
  description: string | null;
  amount: number;
  vendor: string | null;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  kind: "fixed" | "variable";
  requiresDetail: boolean;
  mainCategory: MainCategoryId;
}

export async function listExpenses(): Promise<DbExpense[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("id, month, entity_id, category_id, is_fixed, label, description, amount, vendor, expense_categories(name,kind,main_category)")
    .order("month", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => {
    const cat = (Array.isArray(r.expense_categories) ? r.expense_categories[0] : r.expense_categories) as
      | { name: string; kind: string; main_category: string }
      | null;
    return {
      id: r.id,
      month: r.month,
      entityId: r.entity_id,
      categoryId: r.category_id,
      categoryName: cat?.name ?? null,
      categoryKind: cat?.kind ?? null,
      categoryMain: cat?.main_category ?? null,
      isFixed: r.is_fixed,
      label: r.label,
      description: r.description,
      amount: Number(r.amount) || 0,
      vendor: r.vendor,
    };
  });
}

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("expense_categories")
    .select("id, name, kind, requires_detail, main_category")
    .order("main_category")
    .order("name");
  return (data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    requiresDetail: c.requires_detail,
    mainCategory: c.main_category,
  }));
}
