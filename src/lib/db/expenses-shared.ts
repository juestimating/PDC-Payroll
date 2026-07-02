// =============================================================================
// Expense constants shared by server AND client code — no "server-only" here.
// The three fixed main categories; expense_categories rows are subcategories.
// =============================================================================

export type MainCategoryId = "utility_bills" | "it_expense" | "misc_expense";

export const MAIN_CATEGORIES: { id: MainCategoryId; label: string }[] = [
  { id: "utility_bills", label: "Utility Bills" },
  { id: "it_expense", label: "IT Expense" },
  { id: "misc_expense", label: "Miscellaneous Expense" },
];

export function isMainCategoryId(v: string): v is MainCategoryId {
  return MAIN_CATEGORIES.some((m) => m.id === v);
}

export function mainCategoryLabel(id: string | null | undefined): string {
  return MAIN_CATEGORIES.find((m) => m.id === id)?.label ?? "Uncategorised";
}
