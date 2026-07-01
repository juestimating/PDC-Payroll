"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface NewEmployeeInput {
  name: string;
  email: string;
  entityId: string;
  teamId: string;
  juSalesSubtype: string | null;
  designation: string;
  cnic: string | null;
  city: string | null;
  bank: string | null;
  account: string | null;
  accountTitle: string | null;
  joinedOn: string;
  salary: number;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  employeeCode?: string;
}

const CNIC_RE = /^\d{5}-\d{7}-\d$/;

export async function createEmployeeAction(input: NewEmployeeInput): Promise<ActionResult> {
  // --- validate ---
  if (!input.name?.trim()) return { ok: false, error: "Name is required." };
  if (!input.email?.trim()) return { ok: false, error: "Email is required." };
  if (!input.entityId) return { ok: false, error: "Company is required." };
  if (!input.teamId) return { ok: false, error: "Team is required." };
  if (!input.salary || input.salary <= 0) return { ok: false, error: "Monthly salary must be greater than 0." };
  if (input.cnic && !CNIC_RE.test(input.cnic)) {
    return { ok: false, error: "CNIC must look like 35202-1234567-1." };
  }

  const supabase = await createSupabaseServerClient();
  const id = `emp-${randomUUID()}`;

  const { data: emp, error } = await supabase
    .from("employees")
    .insert({
      id,
      name: input.name.trim(),
      email: input.email.trim(),
      entity_id: input.entityId,
      team_id: input.teamId,
      ju_sales_subtype: input.juSalesSubtype,
      designation: input.designation?.trim() || "—",
      status: "active",
      joined_on: input.joinedOn,
      cnic: input.cnic || null,
      city: input.city || null,
      tax_address: input.city || null,
      bank: input.bank || null,
      account: input.account || null,
      account_title: input.accountTitle?.trim() || input.name.trim(),
    })
    .select("id, employee_code")
    .single();

  if (error) {
    // RLS denial surfaces as insufficient_privilege / permission
    if (/row-level security|permission|privilege/i.test(error.message)) {
      return { ok: false, error: "You don't have permission to add employees." };
    }
    if (/duplicate key|unique/i.test(error.message)) {
      return { ok: false, error: "An employee with that email already exists." };
    }
    return { ok: false, error: error.message };
  }

  // Salary structure: anchor on the monthly salary (D); medical = D×10/110, basic = D − medical.
  const salary = Number(input.salary);
  const medical = (salary * 10) / 110;
  const basic = salary - medical;
  const { error: sErr } = await supabase.from("salary_structures").insert({
    employee_id: id,
    salary,
    basic,
    medical,
    travel: 0,
  });
  if (sErr) return { ok: false, error: `Employee added but salary failed: ${sErr.message}` };

  revalidatePath("/employees");
  return { ok: true, employeeCode: emp?.employee_code ?? undefined };
}
