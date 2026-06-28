// =============================================================================
// Allocation engine verification harness.
//
// Builds an inline fixture from the EXACT "All office expenses" rows (sheet
// cols H=JU, I=PDC, J=B4U) and asserts the allocation engine reproduces the
// current sheet's per-entity column totals + the grand total (col E33):
//   JU  = 3,276,902.3465
//   PDC =   454,951.9167
//   B4U =    18,000
//   grand = 3,749,854.2632
// It also asserts the GOLDEN INVARIANT — every line's split sums back to the
// line total (sum-to-total within RECONCILE_EPSILON) and nothing leaks in the
// roll-up. Exits non-zero on any mismatch. Compiled to CommonJS (no import.meta).
// =============================================================================
import { approxEqual, RECONCILE_EPSILON } from "../../src/lib/engine/index";
import {
  allocateAll,
  allocateLine,
  AllocationLine,
} from "../../src/lib/engine/allocation";

const EPS = RECONCILE_EPSILON; // 0.01 PKR

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, got: number, want: number, eps = EPS): void {
  if (approxEqual(got, want, eps)) {
    pass++;
  } else {
    fail++;
    failures.push(`  ✗ ${label}: got ${got}, want ${want} (Δ ${got - want})`);
  }
}

function assert(label: string, cond: boolean): void {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(`  ✗ ${label}: expected true`);
  }
}

// ---- Inline fixture — the live "All office expenses" lines (rows 2..33) ------
// Figures as printed on the sheet; the two estimation lines carry repeating
// decimals (…66.6667) at full precision, matching the workbook's raw floats.
const LINES: AllocationLine[] = [
  // Sales 1,178,083 routed: Social Media 96,500 → PDC, the rest → JU.
  {
    label: "Sales",
    amount: 1_178_083,
    method: { kind: "team_routing", carveOut: 96_500, to: "JU", carveTo: "PDC" },
  },
  // Technical Estimation → JU (single entity).
  {
    label: "Technical Estimation",
    amount: 1_275_066.6666666667,
    method: { kind: "single_entity", entity: "JU" },
  },
  // Design → PDC.
  {
    label: "Design",
    amount: 177_166.6666666667,
    method: { kind: "single_entity", entity: "PDC" },
  },
  // Overtime → JU.
  {
    label: "Overtime",
    amount: 15_092.1,
    method: { kind: "single_entity", entity: "JU" },
  },
  // Outsource → JU.
  {
    label: "Outsource",
    amount: 65_000,
    method: { kind: "single_entity", entity: "JU" },
  },
  // Admin 298,333.33 pre_split: −55,000 PDC, −18,000 B4U, remainder → JU.
  {
    label: "Admin",
    amount: 298_333.3333333333,
    method: {
      kind: "pre_split",
      base: "JU",
      carveOuts: { PDC: 55_000, B4U: 18_000 },
    },
  },
  // Salary taxes (a negative line — a credit) → JU.
  {
    label: "Salary taxes",
    amount: -26_972.51,
    method: { kind: "single_entity", entity: "JU" },
  },
  // Utilities / rents 75/25 JU/PDC.
  {
    label: "Utilities/rents",
    amount: 338_943,
    method: { kind: "fixed_pct", weights: { JU: 0.75, PDC: 0.25 } },
  },
  // IT → JU.
  {
    label: "IT",
    amount: 262_944,
    method: { kind: "single_entity", entity: "JU" },
  },
  // Misc 75/25 JU/PDC.
  {
    label: "Misc",
    amount: 166_198,
    method: { kind: "fixed_pct", weights: { JU: 0.75, PDC: 0.25 } },
  },
];

// ---- 1. Per-line sum-to-total invariant (the golden rule) -------------------
console.log("── Per-line sum-to-total ──────────────────────");
for (const line of LINES) {
  const a = allocateLine(line);
  assert(`${a.label} · reconciles (split sums to line total)`, a.reconciled);
}

// ---- 2. Method spot checks --------------------------------------------------
console.log("\n── Method spot checks ─────────────────────────");
{
  const sales = allocateLine(LINES[0]);
  check("Sales · PDC carve-out = 96,500", sales.split.PDC, 96_500);
  check("Sales · JU = total − 96,500", sales.split.JU, 1_178_083 - 96_500);
  check("Sales · B4U = 0", sales.split.B4U, 0);
}
{
  const admin = allocateLine(LINES[5]);
  check("Admin · PDC = 55,000", admin.split.PDC, 55_000);
  check("Admin · B4U = 18,000", admin.split.B4U, 18_000);
  check(
    "Admin · JU = remainder",
    admin.split.JU,
    298_333.3333333333 - 55_000 - 18_000,
  );
}
{
  const util = allocateLine(LINES[7]);
  check("Utilities · JU 75%", util.split.JU, 338_943 * 0.75);
  check("Utilities · PDC 25%", util.split.PDC, 338_943 * 0.25);
}

// ---- 3. Roll-up control totals (current sheet allocation) --------------------
console.log("\n── Control totals (cols H/I/J + E33) ──────────");
const result = allocateAll(LINES);
check("JU total = H · 3,276,902.3465", result.byEntity.JU, 3_276_902.3465);
check("PDC total = I · 454,951.9167", result.byEntity.PDC, 454_951.9167);
check("B4U total = J · 18,000", result.byEntity.B4U, 18_000);
check("Grand total = E33 · 3,749,854.2632", result.grandTotal, 3_749_854.2632);

// Grand total must equal the sum of the raw input lines (nothing leaked).
check("grandTotal === inputTotal", result.grandTotal, result.inputTotal, 1e-6);
assert("result.complete (all lines reconciled + grand matches)", result.complete);

// ---- summary ----------------------------------------------------------------
console.log("\n═══════════════════════════════════════════════");
if (fail === 0) {
  console.log(
    `✓ ALL ${pass} checks passed — allocation reproduces the "All office expenses" sheet.`,
  );
} else {
  console.log(`✗ ${fail} FAILED / ${pass} passed`);
  console.log(failures.slice(0, 40).join("\n"));
  process.exitCode = 1;
}
