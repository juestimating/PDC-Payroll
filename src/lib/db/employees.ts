// =============================================================================
// Server-side employee reads from Supabase (RLS-gated by the caller's session).
// Shapes are flattened for the UI. Salary is the open salary_structure (D).
// =============================================================================
import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface DbEmployee {
  id: string;
  employeeCode: string | null;
  name: string;
  email: string;
  entityId: string | null;
  entityName: string | null;
  teamId: string;
  teamName: string | null;
  teamKind: string | null;
  juSalesSubtype: string | null;
  designation: string;
  status: "active" | "inactive";
  joinedOn: string;
  probationEnd: string | null;
  lastWorkingDay: string | null;
  bank: string | null;
  account: string | null;
  accountTitle: string | null;
  cnic: string | null;
  city: string | null;
  taxAddress: string | null;
  note: string | null;
  salary: number;
  /** Open salary-structure components (basic + medical + travel ≈ salary). */
  basic: number;
  medical: number;
  travel: number;
}

export interface EntityRow {
  id: string;
  code: string;
  name: string;
}
export interface TeamRow {
  id: string;
  name: string;
  kind: string;
  isSales: boolean;
  isTechnical: boolean;
}

/** All employees with their entity + team + open salary, ordered by code. */
export async function listEmployees(): Promise<DbEmployee[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: emps, error }, { data: structures }] = await Promise.all([
    supabase
      .from("employees")
      .select(
        "id, employee_code, name, email, entity_id, team_id, ju_sales_subtype, designation, status, joined_on, probation_end, last_working_day, bank, account, account_title, cnic, city, tax_address, note, entities(name), teams(name,kind)",
      )
      .order("employee_code", { ascending: true }),
    supabase.from("salary_structures").select("employee_id, salary, basic, medical, travel").is("effective_to", null),
  ]);
  if (error) throw error;

  const structByEmp = new Map<string, { salary: number; basic: number; medical: number; travel: number }>();
  for (const s of structures ?? []) {
    const basic = Number(s.basic) || 0;
    const medical = Number(s.medical) || 0;
    const travel = Number(s.travel) || 0;
    const gross = Number(s.salary) || basic + medical + travel;
    structByEmp.set(s.employee_id, { salary: gross, basic, medical, travel });
  }

  return (emps ?? []).map((r: any) => {
    const entity = (Array.isArray(r.entities) ? r.entities[0] : r.entities) as { name: string } | null;
    const team = (Array.isArray(r.teams) ? r.teams[0] : r.teams) as { name: string; kind: string } | null;
    const st = structByEmp.get(r.id);
    return {
      id: r.id,
      employeeCode: r.employee_code,
      name: r.name,
      email: r.email,
      entityId: r.entity_id,
      entityName: entity?.name ?? null,
      teamId: r.team_id,
      teamName: team?.name ?? null,
      teamKind: team?.kind ?? null,
      juSalesSubtype: r.ju_sales_subtype,
      designation: r.designation,
      status: r.status as "active" | "inactive",
      joinedOn: r.joined_on,
      probationEnd: r.probation_end,
      lastWorkingDay: r.last_working_day,
      bank: r.bank,
      account: r.account,
      accountTitle: r.account_title,
      cnic: r.cnic,
      city: r.city,
      taxAddress: r.tax_address,
      note: r.note,
      salary: st?.salary ?? 0,
      basic: st?.basic ?? 0,
      medical: st?.medical ?? 0,
      travel: st?.travel ?? 0,
    };
  });
}

export async function listEntities(): Promise<EntityRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("entities").select("id, code, name").eq("active", true).order("id");
  return (data ?? []) as EntityRow[];
}

export async function listTeams(): Promise<TeamRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("teams")
    .select("id, name, kind, is_sales, is_technical")
    .not("kind", "is", null)
    .order("name");
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    kind: t.kind,
    isSales: t.is_sales,
    isTechnical: t.is_technical,
  }));
}
