// =============================================================================
// Static org structure: 4 fixed departments, teams, and the employee roster
// with current salary structures. Numbers are monthly PKR.
// =============================================================================
import type { Department, Employee, Team } from "./types";

export const DEPARTMENTS: Department[] = [
  { id: "dept-sales", key: "sales", name: "Sales & Marketing", color: "#6366f1", isTechnical: false, isSales: true },
  { id: "dept-estimation", key: "estimation", name: "Estimation", color: "#0ea5e9", isTechnical: true, isSales: false },
  { id: "dept-design", key: "design", name: "Design", color: "#ec4899", isTechnical: true, isSales: false },
  { id: "dept-admin", key: "admin", name: "Admin & HR", color: "#14b8a6", isTechnical: false, isSales: false },
];

export const TEAMS: Team[] = [
  { id: "team-sales-inside", name: "Inside Sales", departmentId: "dept-sales" },
  { id: "team-sales-field", name: "Field & Marketing", departmentId: "dept-sales" },
  { id: "team-est-civil", name: "Civil Estimation", departmentId: "dept-estimation" },
  { id: "team-est-mep", name: "MEP Estimation", departmentId: "dept-estimation" },
  { id: "team-design-arch", name: "Architecture", departmentId: "dept-design" },
  { id: "team-design-viz", name: "3D & Visualization", departmentId: "dept-design" },
  { id: "team-admin-hr", name: "HR & People", departmentId: "dept-admin" },
  { id: "team-admin-accounts", name: "Accounts & Admin", departmentId: "dept-admin" },
];

/** Department head employee per department (used by the dept_head RBAC demo). */
export const DEPARTMENT_HEADS: Record<string, string> = {
  "dept-sales": "emp-001",
  "dept-estimation": "emp-009",
  "dept-design": "emp-017",
  "dept-admin": "emp-023",
};

type Row = [
  id: string,
  name: string,
  departmentId: string,
  departmentKey: Employee["departmentKey"],
  teamId: string,
  designation: string,
  status: Employee["status"],
  joinedOn: string,
  basic: number,
  medical: number,
  travel: number,
];

const ROWS: Row[] = [
  // --- Sales & Marketing ---
  ["emp-001", "Bilal Ahmed", "dept-sales", "sales", "team-sales-inside", "Head of Sales", "active", "2019-03-11", 300000, 28000, 35000],
  ["emp-002", "Hamza Tariq", "dept-sales", "sales", "team-sales-field", "Senior Sales Executive", "active", "2020-07-01", 165000, 15000, 20000],
  ["emp-003", "Usman Raza", "dept-sales", "sales", "team-sales-inside", "Sales Executive", "active", "2021-09-15", 95000, 9000, 12000],
  ["emp-004", "Zainab Ali", "dept-sales", "sales", "team-sales-field", "Sales Executive", "active", "2022-01-20", 92000, 9000, 12000],
  ["emp-005", "Fahad Iqbal", "dept-sales", "sales", "team-sales-inside", "Business Development", "active", "2021-04-05", 110000, 10000, 13000],
  ["emp-006", "Sana Mirza", "dept-sales", "sales", "team-sales-field", "Marketing Lead", "active", "2020-11-10", 140000, 13000, 16000],
  ["emp-007", "Hira Shah", "dept-sales", "sales", "team-sales-field", "Marketing Associate", "active", "2023-02-01", 70000, 7000, 9000],
  ["emp-008", "Kamran Nadeem", "dept-sales", "sales", "team-sales-inside", "Sales Executive", "inactive", "2022-08-12", 88000, 8000, 11000],

  // --- Estimation (technical) ---
  ["emp-009", "Adnan Sheikh", "dept-estimation", "estimation", "team-est-civil", "Estimation Manager", "active", "2018-06-01", 280000, 26000, 32000],
  ["emp-010", "Faisal Mehmood", "dept-estimation", "estimation", "team-est-civil", "Senior Estimator", "active", "2020-02-17", 175000, 16000, 20000],
  ["emp-011", "Owais Khan", "dept-estimation", "estimation", "team-est-mep", "Estimator", "active", "2021-10-01", 105000, 10000, 13000],
  ["emp-012", "Rabia Aslam", "dept-estimation", "estimation", "team-est-civil", "Estimator", "active", "2022-03-22", 102000, 10000, 13000],
  ["emp-013", "Junaid Akhtar", "dept-estimation", "estimation", "team-est-mep", "Quantity Surveyor", "active", "2021-01-11", 120000, 11000, 14000],
  ["emp-014", "Saad Qureshi", "dept-estimation", "estimation", "team-est-civil", "Junior Estimator", "active", "2023-05-02", 68000, 6500, 9000],
  ["emp-015", "Maryam Nawaz", "dept-estimation", "estimation", "team-est-mep", "Junior Estimator", "active", "2023-08-14", 65000, 6500, 9000],
  ["emp-016", "Talha Riaz", "dept-estimation", "estimation", "team-est-mep", "Senior Estimator", "active", "2020-09-09", 168000, 15000, 19000],

  // --- Design (technical) ---
  ["emp-017", "Ayesha Khan", "dept-design", "design", "team-design-arch", "Design Lead", "active", "2019-08-19", 260000, 24000, 30000],
  ["emp-018", "Hassan Javed", "dept-design", "design", "team-design-viz", "Senior Designer", "active", "2021-03-03", 160000, 15000, 19000],
  ["emp-019", "Noor Fatima", "dept-design", "design", "team-design-arch", "Architect", "active", "2021-12-01", 115000, 11000, 14000],
  ["emp-020", "Bilal Saeed", "dept-design", "design", "team-design-viz", "3D Artist", "active", "2022-06-20", 98000, 9000, 12000],
  ["emp-021", "Areeba Malik", "dept-design", "design", "team-design-arch", "Junior Designer", "active", "2023-09-05", 62000, 6000, 8000],
  ["emp-022", "Daniyal Yousaf", "dept-design", "design", "team-design-viz", "Architect", "active", "2022-02-14", 112000, 11000, 14000],

  // --- Admin & HR ---
  ["emp-023", "Sadia Rauf", "dept-admin", "admin", "team-admin-hr", "HR Manager", "active", "2019-05-13", 230000, 22000, 27000],
  ["emp-024", "Imran Baig", "dept-admin", "admin", "team-admin-accounts", "Finance Manager", "active", "2018-10-22", 290000, 27000, 33000],
  ["emp-025", "Nida Asif", "dept-admin", "admin", "team-admin-hr", "HR Executive", "active", "2022-04-18", 92000, 9000, 12000],
  ["emp-026", "Waleed Anwar", "dept-admin", "admin", "team-admin-accounts", "Senior Accountant", "active", "2020-12-07", 150000, 14000, 18000],
  ["emp-027", "Tooba Hashmi", "dept-admin", "admin", "team-admin-accounts", "Accountant", "active", "2022-07-25", 98000, 9000, 12000],
  ["emp-028", "Shahbaz Gul", "dept-admin", "admin", "team-admin-accounts", "Admin Officer", "active", "2023-01-30", 72000, 7000, 9000],
  ["emp-029", "Mehwish Iftikhar", "dept-admin", "admin", "team-admin-hr", "Office Manager", "active", "2021-06-16", 105000, 10000, 13000],
  ["emp-030", "Asad Mahmood", "dept-admin", "admin", "team-admin-hr", "HR Executive", "active", "2022-11-11", 90000, 9000, 12000],

  // --- Departed (kept on record for history + final settlement) ---
  ["emp-031", "Rizwan Haider", "dept-estimation", "estimation", "team-est-civil", "Estimator", "inactive", "2021-05-10", 108000, 10000, 13000],
  ["emp-032", "Mahnoor Siddiqui", "dept-design", "design", "team-design-viz", "3D Artist", "inactive", "2022-09-01", 96000, 9000, 12000],
];

/**
 * Employees who have left. Keyed by id; sets the leaving date and reason used by
 * the offboarding view and the final-settlement calculator. Their payroll
 * history is preserved up to (and including) their leaving month.
 */
export const SEED_DEPARTURES: Record<
  string,
  { leftOn: string; exitReason: Employee["exitReason"]; exitNote?: string }
> = {
  "emp-008": {
    leftOn: "2026-02-19",
    exitReason: "resigned",
    exitNote: "Moved to a competitor. Notice period served in full.",
  },
  "emp-031": {
    leftOn: "2026-04-30",
    exitReason: "contract_end",
    exitNote: "Fixed-term project contract completed.",
  },
  "emp-032": {
    leftOn: "2026-05-23",
    exitReason: "resigned",
    exitNote: "Relocating abroad. Final dues under processing.",
  },
};

export const EMPLOYEES: Employee[] = ROWS.map(
  ([id, name, departmentId, departmentKey, teamId, designation, status, joinedOn, basic, medical, travel]) => {
    const exit = SEED_DEPARTURES[id];
    return {
      id,
      name,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@pdc.com.pk`,
      departmentId,
      departmentKey,
      teamId,
      designation,
      status,
      joinedOn,
      salary: { basic, medical, travel },
      ...(exit ? { leftOn: exit.leftOn, exitReason: exit.exitReason, exitNote: exit.exitNote } : {}),
    };
  },
);

// ---- lookups -----------------------------------------------------------------
export const employeeById = new Map(EMPLOYEES.map((e) => [e.id, e]));
export const departmentById = new Map(DEPARTMENTS.map((d) => [d.id, d]));
export const teamById = new Map(TEAMS.map((t) => [t.id, t]));

export function departmentByKey(key: string): Department | undefined {
  return DEPARTMENTS.find((d) => d.key === key);
}
