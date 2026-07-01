"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

export async function createExpenseAction(input: NewExpenseInput): Promise<ActionResult> {
  if (!input.label?.trim()) return { ok: false, error: "Label is required." };
  if (!input.amount || input.amount <= 0) return { ok: false, error: "Amount must be greater than 0." };
  if (!input.entityId) return { ok: false, error: "Company is required." };
  if (!input.categoryId) return { ok: false, error: "Category is required." };
  if (!/^\d{4}-\d{2}$/.test(input.month)) return { ok: false, error: "Month must look like 2026-05." };

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
    amount: input.amount,
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
