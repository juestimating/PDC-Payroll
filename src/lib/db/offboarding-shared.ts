// =============================================================================
// Client-safe offboarding constants + types (NO server-only deps, so both the
// server read layer and client components can import these).
// =============================================================================
export const EXIT_REASONS = [
  "resigned",
  "terminated",
  "contract_end",
  "retired",
  "ghosted",
  "other",
] as const;

export type ExitReason = (typeof EXIT_REASONS)[number];

export const EXIT_REASON_LABEL: Record<ExitReason, string> = {
  resigned: "Resigned",
  terminated: "Terminated",
  contract_end: "Contract end",
  retired: "Retired",
  ghosted: "Ghosted",
  other: "Other",
};

export interface DepartureRow {
  id: string;
  name: string;
  code: string | null;
  entityId: string | null;
  entityName: string | null;
  lastWorkingDay: string;
  exitReason: ExitReason | null;
  exitNote: string | null;
  status: string;
}
