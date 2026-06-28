// =============================================================================
// Engine verification harness.
//
// Recomputes every figure from RAW salary inputs and asserts it reproduces the
// "Payroll May 2026" workbook to the cent. Run:
//   npm run engine:check
// Exits non-zero on any mismatch.
// =============================================================================
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  decomposeSalary,
  computePayroll,
  calcWHT,
  fbrAnnualTax,
  approxEqual,
} from "../src/lib/engine/index";

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

// ---- 1. Spot checks (known rows) --------------------------------------------
console.log("── Spot checks ────────────────────────────────");
// Aadil Fahim: salary 100000, 15 days → WHT 204.5454…
{
  const c = computePayroll({ salary: 100_000, days: 15 });
  check("Aadil medical", c.medical, 9090.9090909, 1e-4);
  check("Aadil basic", c.basic, 90909.0909091, 1e-4);
  check("Aadil WHT", c.withholdingTax, 204.5454545, 1e-4);
}
// Awais Munir: salary 220000, 22 days → gross 161333.33, taxable 200000, WHT 9900
{
  const c = computePayroll({ salary: 220_000, days: 22 });
  check("Awais gross", c.gross, 161333.3333333, 1e-4);
  check("Awais taxable", c.taxable, 200_000, 1e-4);
  check("Awais WHT", c.withholdingTax, 9900, 1e-4);
  check("Awais net", c.net, 151433.3333333, 1e-4);
}
// Muhammad Yahya: salary 130000, 30 days → WHT 2500
{
  const c = computePayroll({ salary: 130_000, days: 30 });
  check("Yahya WHT", c.withholdingTax, 2500, 1e-4);
}
// Bilal (office boy): salary 35000, advance 25000 → net 10000 (the deductions fix)
{
  const c = computePayroll({ salary: 35_000, days: 30, advance: 25_000 });
  check("Bilal net (advance applied)", c.net, 10_000, 1e-4);
}
// FBR slab edges
check("FBR @600k", fbrAnnualTax(600_000), 0);
check("FBR @1.2M", fbrAnnualTax(1_200_000), 6_000);
check("FBR @2.2M", fbrAnnualTax(2_200_000), 116_000);
check("FBR @3.2M", fbrAnnualTax(3_200_000), 346_000);
check("FBR @4.1M", fbrAnnualTax(4_100_000), 616_000);
// decomposition reconstitutes salary
{
  const d = decomposeSalary(130_000);
  check("decompose sums to salary", d.basic + d.medical + d.travel, 130_000, 1e-6);
}
// calcWHT standalone parity
check("calcWHT Awais", calcWHT({ salary: 220_000, days: 22 }).wht, 9900, 1e-4);

// ---- 2. Full-roster reconciliation against the fixture ----------------------
console.log("\n── Full roster (44 employees) ─────────────────");
interface Row {
  name: string;
  department: string;
  salary: number;
  days: number;
  overtime?: number;
  incentive?: number;
  bonus?: number;
  otherDeductions?: number;
  advance?: number;
  expected: { medical: number; basic: number; gross: number; taxable: number; wht: number; net: number };
}
interface Fixture { month: string; employees: Row[] }

const fixture: Fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), "scripts", "fixtures", "may-2026-payroll.json"), "utf8"),
);

const deptNet: Record<string, number> = {};
let totalWht = 0;
for (const e of fixture.employees) {
  const c = computePayroll(e);
  check(`${e.name} · medical`, c.medical, e.expected.medical);
  check(`${e.name} · basic`, c.basic, e.expected.basic);
  check(`${e.name} · gross`, c.gross, e.expected.gross);
  check(`${e.name} · taxable`, c.taxable, e.expected.taxable);
  check(`${e.name} · wht`, c.withholdingTax, e.expected.wht);
  check(`${e.name} · net`, c.net, e.expected.net);
  deptNet[e.department] = (deptNet[e.department] ?? 0) + c.net;
  totalWht += c.withholdingTax;
}

// ---- 3. Grand-total reconciliation ------------------------------------------
console.log("\n── Control totals ─────────────────────────────");
check("Admin net = O18 239,856.0606", deptNet.admin ?? 0, 239856.0606060606, 0.02);
check("Sales net = O40 936,124.2515", deptNet.sales ?? 0, 936124.2515151515, 0.02);
check("Estimation net = O25 1,252,760", deptNet.estimation ?? 0, 1252760.0, 0.05);
check("Total WHT (dept-sum) 27,040.69", totalWht, 27040.6879, 0.05);

// ---- summary ----------------------------------------------------------------
console.log("\n═══════════════════════════════════════════════");
if (fail === 0) {
  console.log(`✓ ALL ${pass} checks passed — engine reproduces the workbook to the cent.`);
} else {
  console.log(`✗ ${fail} FAILED / ${pass} passed`);
  console.log(failures.slice(0, 40).join("\n"));
  process.exitCode = 1;
}
