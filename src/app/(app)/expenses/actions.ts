"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMainCategoryId } from "@/lib/db/expenses-shared";

export interface NewExpenseInput {
  month: string;
  entityId: string;
  categoryId: string;
  label: string;
  description: string | null;
  amount: number;
  vendor: string | null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface AddSubcategoryResult {
  ok: boolean;
  id?: string;
  error?: string;
}

function validateExpenseInput(input: NewExpenseInput): string | null {
  if (!input.label?.trim()) return "Label is required.";
  if (!input.amount || input.amount <= 0) return "Amount must be greater than 0.";
  if (!input.entityId) return "Company is required.";
  if (!input.categoryId) return "Category is required.";
  if (!/^\d{4}-\d{2}$/.test(input.month)) return "Month must look like 2026-05.";
  return null;
}

export async function createExpenseAction(input: NewExpenseInput): Promise<ActionResult> {
  const invalid = validateExpenseInput(input);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createSupabaseServerClient();

  const { data: cat } = await supabase
    .from("expense_categories")
    .select("kind, requires_detail")
    .eq("id", input.categoryId)
    .single();

  if (cat?.requires_detail && !input.description?.trim()) {
    return { ok: false, error: "This category needs a description/detail." };
  }

  const { error } = await supabase.from("expenses").insert({
    id: `exp-${randomUUID()}`,
    month: input.month,
    entity_id: input.entityId,
    category_id: input.categoryId,
    is_fixed: cat?.kind === "fixed",
    label: input.label.trim(),
    description: input.description?.trim() || null,
    amount: Number(input.amount.toFixed(2)),
    vendor: input.vendor?.trim() || null,
  });

  if (error) {
    if (/row-level security|permission|privilege/i.test(error.message)) {
      return { ok: false, error: "Only Admin / Super Admin can add expenses." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/expenses");
  return { ok: true };
}

export async function updateExpenseAction(id: string, input: NewExpenseInput): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Missing expense id." };
  const invalid = validateExpenseInput(input);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createSupabaseServerClient();

  const { data: cat } = await supabase
    .from("expense_categories")
    .select("kind, requires_detail")
    .eq("id", input.categoryId)
    .single();

  if (cat?.requires_detail && !input.description?.trim()) {
    return { ok: false, error: "This category needs a description/detail." };
  }

  const { data, error } = await supabase
    .from("expenses")
    .update({
      month: input.month,
      entity_id: input.entityId,
      category_id: input.categoryId,
      is_fixed: cat?.kind === "fixed",
      label: input.label.trim(),
      description: input.description?.trim() || null,
      amount: Number(input.amount.toFixed(2)),
      vendor: input.vendor?.trim() || null,
    })
    .eq("id", id)
    .select("id");

  if (error) {
    if (/row-level security|permission|privilege/i.test(error.message)) {
      return { ok: false, error: "Only Admin / Super Admin can edit expenses." };
    }
    return { ok: false, error: error.message };
  }
  // RLS silently filters rows it won't let you touch — surface that as a denial.
  if (!data?.length) {
    return { ok: false, error: "Only Admin / Super Admin can edit expenses." };
  }

  revalidatePath("/expenses");
  return { ok: true };
}

export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Missing expense id." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("expenses").delete().eq("id", id).select("id");

  if (error) {
    if (/row-level security|permission|privilege/i.test(error.message)) {
      return { ok: false, error: "Only Admin / Super Admin can delete expenses." };
    }
    return { ok: false, error: error.message };
  }
  if (!data?.length) {
    return { ok: false, error: "Only Admin / Super Admin can delete expenses." };
  }

  revalidatePath("/expenses");
  return { ok: true };
}

/** Create a new subcategory under one of the three main categories. */
export async function addExpenseSubcategoryAction(
  name: string,
  mainCategory: string,
): Promise<AddSubcategoryResult> {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return { ok: false, error: "Subcategory name is required." };
  if (trimmed.length > 60) return { ok: false, error: "Keep the name under 60 characters." };
  if (!isMainCategoryId(mainCategory)) return { ok: false, error: "Pick a valid main category." };

  const supabase = await createSupabaseServerClient();

  const base = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  let id = base || `sub-${randomUUID().slice(0, 8)}`;

  const { data: existing } = await supabase
    .from("expense_categories")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (existing) id = `${id}-${randomUUID().slice(0, 4)}`;

  const { error } = await supabase.from("expense_categories").insert({
    id,
    name: trimmed,
    kind: mainCategory === "utility_bills" ? "fixed" : "variable",
    requires_detail: false,
    main_category: mainCategory,
  });

  if (error) {
    if (/row-level security|permission|privilege/i.test(error.message)) {
      return { ok: false, error: "Only Admin / Super Admin can add subcategories." };
    }
    if (/duplicate key|unique/i.test(error.message)) {
      return { ok: false, error: "A subcategory with this name already exists." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/expenses");
  return { ok: true, id };
}
