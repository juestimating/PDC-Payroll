// =============================================================================
// May 2026 finance seed — the REAL data behind the Overview cockpit.
//
// Source of truth: the "Payroll May 2026" workbook, audited and verified. The
// 44-employee roster is the same fixture the engine test reconciles to the cent
// (scripts/fixtures). The allocation lines, incentive totals and exit cases are
// the verified consolidated figures. Everything the cockpit shows is derived
// from here through the proven engines in src/lib/engine — no magic numbers in
// the UI.
// =============================================================================
import type { EntityCode } from "@/lib/engine";
import type { AllocationLine } from "@/lib/engine";
import rosterData from "./roster.json";

export type FinanceDept = "sales" | "estimation" | "design" | "admin";

/** One employee row as entered on a department sheet (raw inputs only). */
export interface RosterEmployee {
  name: string;
  designation: string;
  department: FinanceDept;
  team: string;
  entity: EntityCode;
  salary: number; // col D — the canonical input
  days: number; // col Q
  overtime: number;
  incentive: number;
  bonus: number;
  otherDeductions: number;
  advance: number;
  arrears: number;
  bank: string | null;
  account: string | null;
  accountTitle: string | null;
  joinedOn: string | null;
  resignationDate: string | null;
  note: string | null;
}

export const PERIOD = "2026-05";

export const ROSTER: RosterEmployee[] = (rosterData as { employees: RosterEmployee[] }).employees;

// ---- Entity display metadata -------------------------------------------------
export const ENTITY_META: Record<EntityCode, { label: string; short: string; color: string }> = {
  JU: { label: "JU Estimation", short: "JU", color: "#3a4fe0" },
  PDC: { label: "Pavilion Design", short: "PDC", color: "#d4537e" },
  B4U: { label: "B4U", short: "B4U", color: "#f59e0b" },
};

// ---- Consolidated cost lines + their entity-allocation policy -----------------
// These reproduce the "All office expenses" split: JU 3,276,902.35 / PDC
// 454,951.92 / B4U 18,000 / grand 3,749,854.26. The split policy is editable —
// this is the current (sheet) baseline.
export const ALLOCATION_LINES: AllocationLine[] = [
  {
    label: "Sales & marketing",
    amount: 1_178_083,
    method: { kind: "team_routing", carveOut: 96_500, to: "JU", carveTo: "PDC" },
  },
  {
    label: "Technical (estimation + design)",
    amount: 1_532_325.4358901517,
    method: { kind: "team_routing", carveOut: 177_166.66666666666, to: "JU", carveTo: "PDC" },
  },
  {
    label: "Admin & HR",
    amount: 298_333.3333333334,
    method: { kind: "pre_split", base: "JU", carveOuts: { PDC: 55_000, B4U: 18_000 } },
  },
  {
    label: "Salary tax (WHT)",
    amount: -26_972.506060606058,
    method: { kind: "single_entity", entity: "JU" },
  },
  {
    label: "Utilities & rent",
    amount: 338_943,
    method: { kind: "fixed_pct", weights: { JU: 0.75, PDC: 0.25 } },
  },
  {
    label: "IT & software",
    amount: 262_944,
    method: { kind: "single_entity", entity: "JU" },
  },
  {
    label: "Misc & kitchen",
    amount: 166_198,
    method: { kind: "fixed_pct", weights: { JU: 0.75, PDC: 0.25 } },
  },
];

// ---- Verified satellite totals (sales incentives) ----------------------------
export const INCENTIVE_SUMMARY = {
  accrued: 230_702,
  payable: 162_581,
  withheld: 37_163,
  heldCount: 6,
  alreadyPaid: 30_958,
};

// ---- Departures this month (drives the offboarding / attention items) --------
export interface ExitCase {
  name: string;
  salary: number;
  days: number;
  joinedOn: string | null;
  leftOn: string;
  exitReason: "resigned" | "terminated" | "contract_end" | "retired" | "ghosted" | "other";
  servedNotice: boolean;
}

export const EXIT_CASES: ExitCase[] = [
  { name: "Awais Munir", salary: 220_000, days: 22, joinedOn: null, leftOn: "2026-05-22", exitReason: "resigned", servedNotice: true },
  { name: "Umar Rashid", salary: 75_000, days: 30, joinedOn: null, leftOn: "2026-05-22", exitReason: "resigned", servedNotice: true },
  { name: "Haiqa Ashfaq", salary: 55_000, days: 13, joinedOn: null, leftOn: "2026-05-13", exitReason: "ghosted", servedNotice: false },
  { name: "Laraib Naeem", salary: 60_000, days: 15, joinedOn: null, leftOn: "2026-05-15", exitReason: "resigned", servedNotice: false },
];

// ---- Data-quality facts from the audit (become live once captured per row) ---
export const DATA_QUALITY = {
  /** Employees with no CNIC on file — blocks FBR filing (audit: 15 of 42). */
  missingCnic: 15,
};
