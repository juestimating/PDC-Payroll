// =============================================================================
// Server-side reads for Offboarding (departed employees). RLS-gated by the
// caller's session. A departure is any employee with a last_working_day set.
// There is NO gratuity / end-of-service — the payroll engine simply prorates
// the final month to the last working day (see workedDaysFor in db/payroll.ts).
// =============================================================================
import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type ExitReason, type DepartureRow } from "./offboarding-shared";

export { EXIT_REASONS, EXIT_REASON_LABEL } from "./offboarding-shared";
export type { ExitReason, DepartureRow } from "./offboarding-shared";

/** Everyone who has been marked as left (last_working_day set), newest first. */
export async function listDepartures(): Promise<DepartureRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, name, employee_code, entity_id, last_working_day, exit_reason, exit_note, status, entities(name)")
    .not("last_working_day", "is", null)
    .order("last_working_day", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((r: any) => {
    const entity = (Array.isArray(r.entities) ? r.entities[0] : r.entities) as { name: string } | null;
    return {
      id: r.id as string,
      name: r.name as string,
      code: (r.employee_code as string | null) ?? null,
      entityId: (r.entity_id as string | null) ?? null,
      entityName: entity?.name ?? null,
      lastWorkingDay: r.last_working_day as string,
      exitReason: (r.exit_reason as ExitReason | null) ?? null,
      exitNote: (r.exit_note as string | null) ?? null,
      status: (r.status as string) ?? "inactive",
    };
  });
}
