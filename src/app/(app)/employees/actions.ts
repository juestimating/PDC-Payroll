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

export interface UpdateEmployeeInput {
  name: string;
  email: string;
  designation: string;
  entityId: string;
  teamId: string;
  juSalesSubtype: string | null;
  joinedOn: string;
  cnic: string | null;
  city: string | null;
  taxAddress: string | null;
  bank: string | null;
  account: string | null;
  accountTitle: string | null;
  note: string | null;
}

/**
 * Fix a wrongly entered employee profile in place. RLS restricts the write to
 * super_admin / hr; the audit trigger records the change automatically. The
 * BEFORE trigger on employees recomputes probation_end from joined_on.
 */
export async function updateEmployeeAction(id: string, input: UpdateEmployeeInput): Promise<ActionResult> {
  // --- validate ---
  if (!id) return { ok: false, error: "Missing employee id." };
  if (!input.name?.trim()) return { ok: false, error: "Name is required." };
  if (!input.email?.trim()) return { ok: false, error: "Email is required." };
  if (!input.entityId) return { ok: false, error: "Company is required." };
  if (!input.teamId) return { ok: false, error: "Team is required." };
  if (!input.joinedOn) return { ok: false, error: "Joining date is required." };
  const cnic = input.cnic?.trim() || null;
  if (cnic && !CNIC_RE.test(cnic)) {
    return { ok: false, error: "CNIC must look like 35202-1234567-1." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("employees")
    .update({
      name: input.name.trim(),
      email: input.email.trim(),
      designation: input.designation?.trim() || "—",
      entity_id: input.entityId,
      team_id: input.teamId,
      ju_sales_subtype: input.entityId === "JU" ? input.juSalesSubtype : null,
      joined_on: input.joinedOn,
      cnic,
      city: input.city?.trim() || null,
      tax_address: input.taxAddress?.trim() || input.city?.trim() || null,
      bank: input.bank?.trim() || null,
      account: input.account?.trim() || null,
      account_title: input.accountTitle?.trim() || input.name.trim(),
      note: input.note?.trim() || null,
    })
    .eq("id", id);

  if (error) {
    if (/row-level security|permission|privilege/i.test(error.message)) {
      return { ok: false, error: "Only HR / Super Admin can edit employees." };
    }
    if (/duplicate key|unique/i.test(error.message)) {
      return { ok: false, error: "Another employee already uses that email." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/employees");
  revalidatePath("/payroll");
  return { ok: true };
}

/**
 * Correct a WRONGLY ENTERED salary in place. Unlike Increments (which roll the
 * structure forward and refuse decreases), this UPDATEs the employee's open
 * salary_structures row — salary = new gross, medical = gross×10/110, basic =
 * gross − medical, travel untouched — and allows decreases. The audit trigger
 * on salary_structures logs the old/new values automatically.
 */
export async function correctSalaryAction(employeeId: string, newSalary: number): Promise<ActionResult> {
  // --- validate ---
  if (!employeeId) return { ok: false, error: "Missing employee id." };
  const gross = Number(newSalary);
  if (!Number.isFinite(gross) || gross <= 0) {
    return { ok: false, error: "The corrected salary must be greater than 0." };
  }

  const supabase = await createSupabaseServerClient();

  // The open (current) salary window — the row payroll reads from.
  const { data: current, error: curErr } = await supabase
    .from("salary_structures")
    .select("id")
    .eq("employee_id", employeeId)
    .is("effective_to", null)
    .maybeSingle();
  if (curErr) return { ok: false, error: curErr.message };
  if (!current) return { ok: false, error: "This employee has no active salary to correct." };

  const salary = Number(gross.toFixed(2));
  const medical = Number(((salary * 10) / 110).toFixed(2));
  const basic = Number((salary - medical).toFixed(2));

  const { error } = await supabase
    .from("salary_structures")
    .update({ salary, basic, medical })
    .eq("id", current.id);

  if (error) {
    if (/row-level security|permission|privilege/i.test(error.message)) {
      return { ok: false, error: "Only HR / Super Admin can correct salaries." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/employees");
  revalidatePath("/payroll");
  return { ok: true };
}
