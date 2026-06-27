// =============================================================================
// REAL April 2026 operational expenses. Salary / commission / overtime / WHT
// roll-ups from the source sheet are intentionally excluded (they are already
// represented by payroll), so dashboards don't double-count.
// =============================================================================
import type { ExpenseItem } from "./types";

export const EXPENSES: ExpenseItem[] = [
  { id: "exp-2026-04-001", month: "2026-04", departmentId: "dept-estimation", category: "Outsourcing", label: "Outsource", amount: 152000, recurring: false },
  { id: "exp-2026-04-002", month: "2026-04", departmentId: "dept-admin", category: "Facilities", label: "Office Building Rent", amount: 242000, recurring: true },
  { id: "exp-2026-04-003", month: "2026-04", departmentId: "dept-admin", category: "Facilities", label: "Alnoor Building Rent", amount: 25300, recurring: true },
  { id: "exp-2026-04-004", month: "2026-04", departmentId: "dept-admin", category: "Utilities", label: "PTCL 1st Floor", amount: 7690, recurring: true },
  { id: "exp-2026-04-005", month: "2026-04", departmentId: "dept-admin", category: "Utilities", label: "PTCL 2nd Floor", amount: 7700, recurring: true },
  { id: "exp-2026-04-006", month: "2026-04", departmentId: "dept-admin", category: "Utilities", label: "Transword Internet PDC", amount: 7436, recurring: true },
  { id: "exp-2026-04-007", month: "2026-04", departmentId: "dept-admin", category: "Utilities", label: "Transword Internet JU", amount: 5633, recurring: true },
  { id: "exp-2026-04-008", month: "2026-04", departmentId: "dept-admin", category: "Utilities", label: "Alnoor Internet", amount: 1200, recurring: true },
  { id: "exp-2026-04-009", month: "2026-04", departmentId: "dept-admin", category: "Utilities", label: "LESCO 1st Floor", amount: 21235, recurring: true },
  { id: "exp-2026-04-010", month: "2026-04", departmentId: "dept-admin", category: "Utilities", label: "LESCO 2nd Floor", amount: 15768, recurring: true },
  { id: "exp-2026-04-011", month: "2026-04", departmentId: "dept-admin", category: "Utilities", label: "Alnoor Town Bill", amount: 2275, recurring: true },
  { id: "exp-2026-04-012", month: "2026-04", departmentId: "dept-admin", category: "Utilities", label: "DHA Water Bill", amount: 10000, recurring: true },
  { id: "exp-2026-04-013", month: "2026-04", departmentId: "dept-admin", category: "IT & Data", label: "CC Data", amount: 124444, recurring: false },
  { id: "exp-2026-04-014", month: "2026-04", departmentId: "dept-admin", category: "Software", label: "Office 365, Domains", amount: 83500, recurring: true },
  { id: "exp-2026-04-015", month: "2026-04", departmentId: "dept-admin", category: "Office", label: "Kitchen Expense", amount: 66740, recurring: false },
  { id: "exp-2026-04-016", month: "2026-04", departmentId: "dept-admin", category: "Office", label: "Daig (18k/week × 4)", amount: 72000, recurring: false },
  { id: "exp-2026-04-017", month: "2026-04", departmentId: "dept-admin", category: "Hardware", label: "LCD & Systems", amount: 75100, recurring: false },
];

export const expensesByMonth = new Map<string, ExpenseItem[]>();
for (const e of EXPENSES) {
  const list = expensesByMonth.get(e.month) ?? [];
  list.push(e);
  expensesByMonth.set(e.month, list);
}
