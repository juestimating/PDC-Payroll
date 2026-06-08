// =============================================================================
// Workspace overlay — the mutable, persisted layer on top of the deterministic
// mock base. It holds what the user changes at runtime: which month is open
// (advanced via "Start new month") and who has been marked as left.
//
// Default state == today's behaviour, so an empty overlay renders identically
// to the static seed. This is the clean precursor to the Supabase logic phase:
// the same actions will later write to Postgres instead of localStorage.
// =============================================================================
import {
  CURRENT_MONTH,
  MONTHS,
  generateMonthForRoster,
  monthAfter,
  payrollByMonth,
} from "./engine";
import { EMPLOYEES, employeeById } from "./org";
import type { Employee, ExitReason, PayrollRecord, PayrollStatus } from "./types";

export interface UiDeparture {
  leftOn: string; // ISO date
  exitReason: ExitReason;
  exitNote?: string;
}

export interface WorkspaceState {
  /** The current open / processing month. Everything before it is closed. */
  openMonth: string;
  /** Months opened beyond the seed window, in chronological order. */
  createdMonths: string[];
  /** Generated payroll for created months. */
  createdPayroll: Record<string, PayrollRecord[]>;
  /** Employees offboarded through the UI (id -> departure details). */
  uiDepartures: Record<string, UiDeparture>;
}

const STORAGE_KEY = "pdc-workspace-v1";

function initialState(): WorkspaceState {
  return { openMonth: CURRENT_MONTH, createdMonths: [], createdPayroll: {}, uiDepartures: {} };
}

let state: WorkspaceState = initialState();

// ---- pub/sub (React-free; the provider bridges to it) -----------------------
const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getWorkspace(): WorkspaceState {
  return state;
}

// ---- persistence ------------------------------------------------------------
function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — keep in-memory state */
  }
}

/** Hydrate from localStorage. Call once on the client after mount. */
export function loadWorkspace(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<WorkspaceState>;
    state = {
      openMonth: parsed.openMonth ?? CURRENT_MONTH,
      createdMonths: parsed.createdMonths ?? [],
      createdPayroll: parsed.createdPayroll ?? {},
      uiDepartures: parsed.uiDepartures ?? {},
    };
    emit();
  } catch {
    /* corrupt payload — ignore and keep defaults */
  }
}

// ---- read accessors (used by the data selectors) ----------------------------
export function effectiveOpenMonth(): string {
  return state.openMonth;
}

export function allMonthKeys(): string[] {
  return [...MONTHS, ...state.createdMonths];
}

export function orderIndex(month: string): number {
  return allMonthKeys().indexOf(month);
}

export function isMonthCreated(month: string): boolean {
  return state.createdMonths.includes(month);
}

function withStatus(r: PayrollRecord, open: string): PayrollRecord {
  const status: PayrollStatus = r.month === open ? "processing" : "closed";
  return r.status === status ? r : { ...r, status };
}

/** Payroll rows for a month: created month if present, else the seed, with the
 *  status recomputed against the current open month. */
export function recordsForMonth(month: string): PayrollRecord[] {
  const base = state.createdPayroll[month] ?? payrollByMonth.get(month) ?? [];
  const open = state.openMonth;
  return base.map((r) => withStatus(r, open));
}

export function createdRecordsForEmployee(employeeId: string): PayrollRecord[] {
  const out: PayrollRecord[] = [];
  for (const m of state.createdMonths) {
    for (const r of state.createdPayroll[m] ?? []) {
      if (r.employeeId === employeeId) out.push(withStatus(r, state.openMonth));
    }
  }
  return out;
}

export function isUiDeparted(id: string): boolean {
  return Boolean(state.uiDepartures[id]);
}

export function uiDepartureFor(id: string): UiDeparture | undefined {
  return state.uiDepartures[id];
}

/** An employee with any client-side departure applied (status + leaving info). */
export function effectiveEmployee(e: Employee): Employee {
  const d = state.uiDepartures[e.id];
  if (!d) return e;
  return { ...e, status: "inactive", leftOn: d.leftOn, exitReason: d.exitReason, exitNote: d.exitNote };
}

// ---- mutations --------------------------------------------------------------
/** Close the open month and open the next one, carrying salaries forward. */
export function applyStartNewMonth(): string {
  const next = monthAfter(state.openMonth);
  const roster = EMPLOYEES.filter((e) => e.status === "active" && !state.uiDepartures[e.id]);
  const records = generateMonthForRoster(next, roster);
  state = {
    ...state,
    openMonth: next,
    createdMonths: [...state.createdMonths, next],
    createdPayroll: { ...state.createdPayroll, [next]: records },
  };
  persist();
  emit();
  return next;
}

/** Mark an employee as left (records the leaving date + reason). */
export function applyOffboard(id: string, info: UiDeparture): void {
  if (!employeeById.has(id)) return;
  state = { ...state, uiDepartures: { ...state.uiDepartures, [id]: info } };
  persist();
  emit();
}

/** Reverse a UI offboarding (re-activate). */
export function applyReinstate(id: string): void {
  if (!state.uiDepartures[id]) return;
  const next = { ...state.uiDepartures };
  delete next[id];
  state = { ...state, uiDepartures: next };
  persist();
  emit();
}

/** Clear all workspace changes — back to the seed. */
export function resetWorkspace(): void {
  state = initialState();
  persist();
  emit();
}
