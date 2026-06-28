// =============================================================================
// Settlement engine verification harness.
//
// Builds a tiny inline fixture from the dump's exact 'ALL PAYROLL' /
// 'Technical Department' control rows, runs computeFinalSettlement, and asserts
// it reproduces the owner-confirmed exit-policy outcomes:
//   - served notice  → 'scheduled', releaseDate = 20th of next month
//   - not served / ghosted → 'held', disbursedNow 0, releaseDate null
//   - final-month net comes from the proven core engine (matches the workbook).
//
// Compiled to CommonJS (no import.meta). Run via the engine tsconfig; exits
// non-zero on any mismatch.
// =============================================================================
import {
  computeFinalSettlement,
  settlementReleaseDate,
  completedYearsOfService,
  type SettlementExitReason,
  type SettlementStatus,
} from "../../src/lib/engine/settlement";
import { approxEqual } from "../../src/lib/engine/money";

const EPS = 0.01;

let pass = 0;
let fail = 0;
const failures: string[] = [];

function checkNum(label: string, got: number, want: number, eps = EPS): void {
  if (approxEqual(got, want, eps)) {
    pass++;
  } else {
    fail++;
    failures.push(`  x ${label}: got ${got}, want ${want} (delta ${got - want})`);
  }
}

function checkEq<T>(label: string, got: T, want: T): void {
  if (got === want) {
    pass++;
  } else {
    fail++;
    failures.push(`  x ${label}: got ${String(got)}, want ${String(want)}`);
  }
}

// ---- Control fixture (exact dump rows) --------------------------------------
interface Case {
  name: string;
  salary: number;
  days: number;
  leftOn: string;
  joinedOn: string | null;
  exitReason: SettlementExitReason;
  servedNotice: boolean;
  expected: {
    status: SettlementStatus;
    releaseDate: string | null;
    disbursedNow: number;
    finalNet: number; // final-month net from the core engine
  };
}

const cases: Case[] = [
  {
    // Awais Munir — resigned, last day 22 May, 'May Salary pending', served.
    name: "Awais Munir",
    salary: 220_000,
    days: 22,
    leftOn: "2026-05-22",
    joinedOn: null,
    exitReason: "resigned",
    servedNotice: true,
    expected: {
      status: "scheduled",
      releaseDate: "2026-06-20",
      disbursedNow: 0,
      finalNet: 151_433.33333333334,
    },
  },
  {
    // Umar Rashid — last day 31 May, served (note '20th').
    name: "Umar Rashid",
    salary: 75_000,
    days: 30,
    leftOn: "2026-05-31",
    joinedOn: null,
    exitReason: "resigned",
    servedNotice: true,
    expected: {
      status: "scheduled",
      releaseDate: "2026-06-20",
      disbursedNow: 0,
      finalNet: 74_818.18181818182,
    },
  },
  {
    // Haiqa Ashfaq — 'Ghosted without clarification - no salary' → held.
    name: "Haiqa Ashfaq",
    salary: 55_000,
    days: 13,
    leftOn: "2026-05-13",
    joinedOn: null,
    exitReason: "ghosted",
    servedNotice: false,
    expected: {
      status: "held",
      releaseDate: null,
      disbursedNow: 0,
      finalNet: 23_833.333333333332,
    },
  },
  {
    // Laraib Naeem — 'No salary - Notice Period not served' → held.
    name: "Laraib Naeem",
    salary: 60_000,
    days: 15,
    leftOn: "2026-05-15",
    joinedOn: null,
    exitReason: "resigned",
    servedNotice: false,
    expected: {
      status: "held",
      releaseDate: null,
      disbursedNow: 0,
      finalNet: 29_977.272727272728,
    },
  },
  {
    // Hassan — Draftsman, last day 12 May → prorated 12-day final pay.
    name: "Hassan",
    salary: 35_000,
    days: 12,
    leftOn: "2026-05-12",
    joinedOn: null,
    exitReason: "resigned",
    servedNotice: true,
    expected: {
      status: "scheduled",
      releaseDate: "2026-06-20",
      disbursedNow: 0,
      finalNet: 14_000,
    },
  },
];

console.log("-- Settlement control cases ---------------------");
for (const c of cases) {
  const s = computeFinalSettlement({
    salary: c.salary,
    days: c.days,
    joinedOn: c.joinedOn,
    leftOn: c.leftOn,
    exitReason: c.exitReason,
    servedNotice: c.servedNotice,
  });
  checkEq(`${c.name} | status`, s.status, c.expected.status);
  checkEq(`${c.name} | releaseDate`, s.releaseDate, c.expected.releaseDate);
  checkNum(`${c.name} | disbursedNow`, s.disbursedNow, c.expected.disbursedNow);
  // earnings[0] is the final-month net from the core engine.
  checkNum(`${c.name} | final-month net`, s.earnings[0].amount, c.expected.finalNet);
}

// ---- Helper / policy edge checks --------------------------------------------
console.log("\n-- Policy & helper edges ------------------------");
// Release date rolls into January across a December exit.
checkEq("release rolls Dec->Jan", settlementReleaseDate("2026-12-04"), "2027-01-20");
// Gratuity: a 3-year tenure adds 3 x basic; <1yr adds nothing.
{
  const threeYr = computeFinalSettlement({
    salary: 220_000,
    days: 30,
    joinedOn: "2023-04-01",
    leftOn: "2026-05-22",
    exitReason: "resigned",
    servedNotice: true,
  });
  checkNum("3-yr completedYears", threeYr.completedYears, 3);
  // basic = 220000 - medical(20000) = 200000; gratuity = 3 x 200000.
  checkNum("3-yr gratuity line", threeYr.earnings[1].amount, 600_000);
}
checkNum("under-1yr completedYears", completedYearsOfService("2025-09-01", "2026-05-22"), 0);
// Terminated-without-notice is also held.
{
  const t = computeFinalSettlement({
    salary: 100_000,
    days: 20,
    joinedOn: null,
    leftOn: "2026-05-20",
    exitReason: "terminated",
    servedNotice: false,
  });
  checkEq("terminated no-notice held", t.status, "held");
  checkEq("held releaseDate null", t.releaseDate, null);
}

// ---- summary ----------------------------------------------------------------
console.log("\n================================================");
if (fail === 0) {
  console.log(`OK ALL ${pass} checks passed - settlement engine reproduces the exit policy.`);
} else {
  console.log(`FAIL ${fail} failed / ${pass} passed`);
  console.log(failures.slice(0, 40).join("\n"));
  process.exitCode = 1;
}
