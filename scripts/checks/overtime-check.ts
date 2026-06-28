// =============================================================================
// Overtime engine verification — sheet "Overtime May 2026".
//
// Builds a small inline fixture from the sheet's exact rows, runs the overtime
// engine, and asserts it reproduces the column-I total (cell I17) to the cent,
// both with the sheet's STALE grosses and with the CURRENT-month grosses.
//   npx tsc -p scripts/tsconfig.engine.json && node .engine-build/checks/overtime-check.js
// Exits non-zero on any mismatch.
// =============================================================================
import {
  overtimeRate,
  computeOvertimeLine,
  computeOvertimeRegister,
  type OvertimeInput,
} from "../../src/lib/engine/overtime";
import { approxEqual, OT_BASIC_FACTOR, OT_STANDARD_HOURS } from "../../src/lib/engine/index";

const EPS = 0.01;

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

function checkBool(label: string, got: boolean, want: boolean): void {
  if (got === want) {
    pass++;
  } else {
    fail++;
    failures.push(`  ✗ ${label}: got ${got}, want ${want}`);
  }
}

// ---- 1. Per-row spot checks (exact dump figures) ----------------------------
console.log("── Spot checks ────────────────────────────────");
// rate = gross × 0.65 / 176; amount = totalHours × rate × 1.5 (May = 'normal').
{
  const shehroz = computeOvertimeLine({ name: "Shehroz", sheetGross: 75_000, weekdayHours: 7.14 });
  check("Shehroz amount (stale 75k)", shehroz.amount, 2966.548295, 1e-4);
  check("Shehroz rate", shehroz.ratePerHour, (75_000 * OT_BASIC_FACTOR) / OT_STANDARD_HOURS, 1e-9);

  const uzaer = computeOvertimeLine({ name: "Uzaer", sheetGross: 102_000, weekdayHours: 2.18 });
  check("Uzaer amount", uzaer.amount, 1231.823864, 1e-4);

  const rafia = computeOvertimeLine({ name: "Rafia", sheetGross: 150_000, weekdayHours: 5.34 });
  check("Rafia amount", rafia.amount, 4437.357955, 1e-4);

  const zain = computeOvertimeLine({ name: "Zain", sheetGross: 125_000, weekdayHours: 6.25 });
  check("Zain amount", zain.amount, 4327.947443, 1e-4);

  const mahnoor = computeOvertimeLine({ name: "Mahnoor", sheetGross: 64_900, weekdayHours: 5.92 });
  check("Mahnoor amount", mahnoor.amount, 2128.425, 1e-4);
}

// weekday + weekend hours add up before the multiplier is applied.
{
  const split = computeOvertimeLine({
    name: "Split",
    sheetGross: 64_900,
    weekdayHours: 3.92,
    weekendHours: 2.0,
  });
  check("totalHours = weekday + weekend", split.totalHours, 5.92, 1e-9);
  check("split amount == Mahnoor 5.92h", split.amount, 2128.425, 1e-4);
}

// subTotal = amount + bonus + previousPending.
{
  const l = computeOvertimeLine({
    name: "WithExtras",
    sheetGross: 64_900,
    weekdayHours: 5.92,
    bonus: 1_000,
    previousPending: 500,
  });
  check("subTotal = amount + bonus + pending", l.subTotal, 2128.425 + 1_000 + 500, 1e-4);
}

// Probation → amount 0, but bonus/pending still flow through subTotal.
{
  const p = computeOvertimeLine({
    name: "Probie",
    sheetGross: 80_000,
    weekdayHours: 10,
    bonus: 250,
    onProbation: true,
  });
  check("probation amount 0", p.amount, 0, 1e-9);
  check("probation subTotal keeps bonus", p.subTotal, 250, 1e-9);
}

// Stale-gross flag: current gross differs from the sheet's.
{
  const stale = computeOvertimeLine({
    name: "Shehroz",
    sheetGross: 75_000,
    currentGross: 50_000,
    weekdayHours: 7.14,
  });
  checkBool("staleGross flagged", stale.staleGross, true);
  check("honest amount (current 50k)", stale.amount, 1977.698864, 1e-4);

  const fresh = computeOvertimeLine({
    name: "Uzaer",
    sheetGross: 102_000,
    currentGross: 102_000,
    weekdayHours: 2.18,
  });
  checkBool("matching gross not flagged", fresh.staleGross, false);
}

// rate helper parity.
check("overtimeRate(75k)", overtimeRate(75_000), 276.9886363636, 1e-6);

// ---- 2. Roster fixture & control totals -------------------------------------
console.log("\n── Roster control totals ──────────────────────");

// The "Overtime May 2026" roster. Only these rows carried hours; the remaining
// roster members logged 0 h and contribute nothing to I17. `sheetGross` is the
// (possibly stale) value the sheet pulled from the prior-month file; the inline
// `currentGross` is the true May payroll gross.
const roster: OvertimeInput[] = [
  { name: "Shehroz", sheetGross: 75_000, currentGross: 50_000, weekdayHours: 7.14 },
  { name: "Uzaer", sheetGross: 102_000, currentGross: 102_000, weekdayHours: 2.18 },
  { name: "Rafia", sheetGross: 150_000, currentGross: 150_000, weekdayHours: 5.34 },
  { name: "Zain", sheetGross: 125_000, currentGross: 125_000, weekdayHours: 6.25 },
  { name: "Mahnoor", sheetGross: 64_900, currentGross: 64_900, weekdayHours: 5.92 },
  // zero-hour roster members (present on the sheet, no overtime this month):
  { name: "Roster 6", sheetGross: 90_000, weekdayHours: 0 },
  { name: "Roster 7", sheetGross: 110_000, weekdayHours: 0 },
  { name: "Roster 8", sheetGross: 70_000, weekdayHours: 0 },
];

// (a) Sheet reproduction — use the STALE grosses (ignore currentGross).
const staleInputs: OvertimeInput[] = roster.map((r) => ({
  name: r.name,
  sheetGross: r.sheetGross,
  weekdayHours: r.weekdayHours,
  weekendHours: r.weekendHours,
}));
const staleReg = computeOvertimeRegister(staleInputs);
check("I17 total (stale grosses)", staleReg.totalAmount, 15092.10255681818, 1e-6);

// (b) Honest reproduction — bind to current-month grosses.
const honestReg = computeOvertimeRegister(roster);
check("Honest total (current grosses)", honestReg.totalAmount, 14103.25312500, 1e-6);
check("Honest total rounds to 14,103.25", Math.round(honestReg.totalAmount * 100) / 100, 14103.25, 1e-9);

// The only row that moves is Shehroz; the delta is exactly his stale→current gap.
check(
  "stale − honest = Shehroz delta",
  staleReg.totalAmount - honestReg.totalAmount,
  2966.548295 - 1977.698864,
  1e-4,
);

// Exactly one stale row (Shehroz) in the honest register.
check("one stale row", honestReg.staleRows.length, 1, 1e-9);
if (honestReg.staleRows.length === 1) {
  checkBool("stale row is Shehroz", honestReg.staleRows[0].name === "Shehroz", true);
}

// Total hours across the roster (only the 5 active rows).
check("total hours", honestReg.totalHours, 7.14 + 2.18 + 5.34 + 6.25 + 5.92, 1e-9);

// ---- summary ----------------------------------------------------------------
console.log("\n═══════════════════════════════════════════════");
if (fail === 0) {
  console.log(`✓ ALL ${pass} checks passed — overtime engine reproduces I17 to the cent.`);
} else {
  console.log(`✗ ${fail} FAILED / ${pass} passed`);
  console.log(failures.slice(0, 40).join("\n"));
  process.exitCode = 1;
}
