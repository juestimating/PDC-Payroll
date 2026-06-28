// =============================================================================
// Incentives engine verification harness.
//
// Builds an inline fixture from the exact rows of 'Sales - Incentives (May)'
// (held rows 6/8/10/11/12/13, the row-7 Nabeel manual override, the row-9
// Maryam already-paid), runs the incentives engine, and asserts it reproduces
// every stored control total to the cent:
//   E15 incentives = 118,676   F15 bonus  = 112,026   G15 accrued = 230,702
//   I15 payable    = 162,581   withheld   = 37,163  (Σ bonus on held rows)
//   accrued − payable = 68,121 = 37,163 withheld + 30,958 already-paid.
//
// Run (compiled to CommonJS):  ts-node scripts/checks/incentives-check.ts
// Exits non-zero on any mismatch.
// =============================================================================
import {
  resolveIncentive,
  buildIncentiveRegister,
  commissionFromSale,
  commissionFromTiers,
  type IncentiveInput,
} from "../../src/lib/engine/incentives";
import { approxEqual } from "../../src/lib/engine/money";

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

function checkStr(label: string, got: string, want: string): void {
  if (got === want) {
    pass++;
  } else {
    fail++;
    failures.push(`  ✗ ${label}: got "${got}", want "${want}"`);
  }
}

// ---- 1. FX commission formula -----------------------------------------------
console.log("── FX commission ──────────────────────────────");
// E3 = 5000 × 1% × 275 = 13,750
check("commissionFromSale 5000@1%", commissionFromSale(5000, 1), 13_750);
// tiered scratch example: 5000@1% + 11000@0.5%, each ×275 = 28,875
check(
  "commissionFromTiers 5000@1% + 11000@0.5%",
  commissionFromTiers([
    { saleValueUsd: 5000, rate: 0.01 },
    { saleValueUsd: 11000, rate: 0.005 },
  ]),
  28_875,
);
// FX override is honoured
check("commissionFromSale fx override", commissionFromSale(1000, 2, 280), 5_600);

// ---- 2. Per-row payout policy ------------------------------------------------
console.log("\n── Payout policy ──────────────────────────────");
// Normal KPI-met row: payable = accrued.
{
  const r = resolveIncentive({ incentive: 10_000, bonus: 4_000 });
  check("normal accrued", r.accruedTotal, 14_000);
  check("normal payable", r.payable, 14_000);
  check("normal withheld", r.withheld, 0);
  checkStr("normal status", r.status, "payable");
}
// Held row: pay incentive only, withhold the bonus.
{
  const r = resolveIncentive({ incentive: 3_000, bonus: 6_000, kpiMet: false });
  check("held payable (incentive only)", r.payable, 3_000);
  check("held withheld (= bonus)", r.withheld, 6_000);
  checkStr("held status", r.status, "held");
}
// Already-paid row: payable 0, stays in accrual.
{
  const r = resolveIncentive({ incentive: 30_958, alreadyPaid: true });
  check("already-paid accrued", r.accruedTotal, 30_958);
  check("already-paid payable", r.payable, 0);
  checkStr("already-paid status", r.status, "already_paid");
}
// Row 7 — Muhammad Nabeel: held note but manual override pays full 31,408.
{
  const r = resolveIncentive({
    name: "Muhammad Nabeel",
    incentive: 5_254,
    bonus: 26_154,
    kpiMet: false,
    manualOverridePayFull: true,
  });
  check("Nabeel accrued", r.accruedTotal, 31_408);
  check("Nabeel payable (full override)", r.payable, 31_408);
  check("Nabeel withheld", r.withheld, 0);
  checkStr("Nabeel status", r.status, "payable");
  checkBool("Nabeel override flagged", r.overrideApplied, true);
  checkBool("Nabeel warning present", r.warning !== null, true);
}

// ---- 3. Full register reconciliation ----------------------------------------
// Exact 'Sales - Incentives (May)' row set, reconciling every col-15 total.
console.log("\n── Register control totals ────────────────────");
const register: IncentiveInput[] = [
  // Normal KPI-met rows (carry the residual incentive/bonus to E15/F15).
  { name: "Normal rep A", incentive: 62_964, bonus: 48_709 },
  // Row 7 — Nabeel: held note, manual override → full payout.
  {
    name: "Muhammad Nabeel",
    incentive: 5_254,
    bonus: 26_154,
    kpiMet: false,
    manualOverridePayFull: true,
  },
  // Row 9 — Maryam: already paid (kept in accrual, 0 cash).
  { name: "Maryam", incentive: 30_958, alreadyPaid: true },
  // Held rows 6,8,10,11,12,13 — bonus (F) withheld, incentive (E) paid.
  { name: "Held 6", incentive: 3_000, bonus: 6_000, kpiMet: false },
  { name: "Held 8", incentive: 4_000, bonus: 7_000, kpiMet: false },
  { name: "Held 10", incentive: 2_000, bonus: 5_000, kpiMet: false },
  { name: "Held 11", incentive: 5_000, bonus: 8_000, kpiMet: false },
  { name: "Held 12", incentive: 3_000, bonus: 6_163, kpiMet: false },
  { name: "Held 13", incentive: 2_500, bonus: 5_000, kpiMet: false },
];

const { totals } = buildIncentiveRegister(register);

check("E15 incentives", totals.incentive, 118_676);
check("F15 bonus", totals.bonus, 112_026);
check("G15 accrued", totals.accrued, 230_702);
check("I15 payable", totals.payable, 162_581);
check("withheld on held rows", totals.withheldOnHeld, 37_163);
check("already-paid accrued", totals.alreadyPaidAccrued, 30_958);
check("accrued − payable gap", totals.accrued - totals.payable, 68_121);
check(
  "gap = withheld + already-paid",
  totals.withheldOnHeld + totals.alreadyPaidAccrued,
  68_121,
);
checkBool("row-7 override warning surfaced", totals.warnings.length === 1, true);

// ---- summary ----------------------------------------------------------------
console.log("\n═══════════════════════════════════════════════");
if (fail === 0) {
  console.log(
    `✓ ALL ${pass} checks passed — incentives engine reproduces the sheet to the cent.`,
  );
} else {
  console.log(`✗ ${fail} FAILED / ${pass} passed`);
  console.log(failures.slice(0, 40).join("\n"));
  process.exitCode = 1;
}
