// =============================================================================
// Roles, scopes, and the navigation each role can see.
// This is the UI-side mirror of the RLS model that will enforce access
// server-side. The front-end hides what a role can't use; RLS is the real gate.
// =============================================================================
import type { Role } from "./types";

export interface RoleDef {
  key: Role;
  label: string;
  blurb: string;
  scope: "all" | "department" | "self";
}

export const ROLES: Record<Role, RoleDef> = {
  admin: {
    key: "admin",
    label: "Admin",
    blurb: "Full access to every module and department.",
    scope: "all",
  },
  hr: {
    key: "hr",
    label: "HR",
    blurb: "Manage employees, payroll, overtime, and tasks org-wide.",
    scope: "all",
  },
  dept_head: {
    key: "dept_head",
    label: "Department Head",
    blurb: "Manage only your department's people, expenses, and tasks.",
    scope: "department",
  },
  employee: {
    key: "employee",
    label: "Employee",
    blurb: "View your own payslip, salary breakdown, tax, and tasks.",
    scope: "self",
  },
};

export const ROLE_ORDER: Role[] = ["admin", "hr", "dept_head", "employee"];

/** Module keys each role can reach (drives sidebar + route guards in the UI). */
export const ROLE_NAV: Record<Role, string[]> = {
  admin: [
    "dashboard", "payroll", "employees", "overtime", "increments",
    "deductions", "tax", "expenses", "tasks", "reports",
  ],
  hr: [
    "dashboard", "payroll", "employees", "overtime", "increments",
    "deductions", "tax", "tasks", "reports",
  ],
  dept_head: ["dashboard", "payroll", "employees", "overtime", "expenses", "tasks", "reports"],
  employee: ["my-payslip", "tasks"],
};
