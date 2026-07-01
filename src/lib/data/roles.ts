// =============================================================================
// Roles, scopes, and the navigation each role can see.
// This is the UI-side mirror of the RLS model that will enforce access
// server-side. The front-end hides what a role can't use; RLS is the real gate.
//
// The 5-role model (locked with the owner):
//   super_admin  — full control + oversight of everything
//   admin        — adds admin expenses; broad read; approves loan payments
//   hr           — people, payroll, loans, leaves, increments
//   sales_lead   — adds sales incentives (sales/marketing scope)
//   estimation_lead — adds estimation overtime (estimation scope)
// =============================================================================
import type { Role } from "./types";

export interface RoleDef {
  key: Role;
  label: string;
  blurb: string;
  scope: "all" | "department" | "self";
}

export const ROLES: Record<Role, RoleDef> = {
  super_admin: {
    key: "super_admin",
    label: "Super Admin",
    blurb: "Full control and oversight of every module, entity, and department.",
    scope: "all",
  },
  admin: {
    key: "admin",
    label: "Admin",
    blurb: "Logs company expenses and approves loan payments; org-wide visibility.",
    scope: "all",
  },
  hr: {
    key: "hr",
    label: "HR",
    blurb: "Manage employees, payroll, loans, leaves, and increments org-wide.",
    scope: "all",
  },
  sales_lead: {
    key: "sales_lead",
    label: "Sales Lead",
    blurb: "Log sales incentives for the sales & marketing teams.",
    scope: "department",
  },
  estimation_lead: {
    key: "estimation_lead",
    label: "Estimation Lead",
    blurb: "Log overtime for the estimation team.",
    scope: "department",
  },
};

export const ROLE_ORDER: Role[] = ["super_admin", "admin", "hr", "sales_lead", "estimation_lead"];

/**
 * Module keys each role can reach (drives sidebar + route guards in the UI).
 * Keys map to existing routes; new Adjustments routes (loans/advances/leaves/
 * incentives/approvals) are added to the matrix as those pages land.
 */
export const ROLE_NAV: Record<Role, string[]> = {
  super_admin: [
    "overview", "my-payslip", "payroll", "overtime", "increments", "tax",
    "loans", "advances", "leaves", "incentives", "approvals",
    "employees", "offboarding", "expenses", "reports", "tasks",
  ],
  admin: [
    "overview", "my-payslip", "payroll", "overtime", "increments", "tax",
    "loans", "advances", "leaves", "incentives", "approvals",
    "employees", "offboarding", "expenses", "reports", "tasks",
  ],
  hr: [
    "overview", "my-payslip", "payroll", "overtime", "increments", "tax",
    "loans", "advances", "leaves", "incentives",
    "employees", "offboarding", "expenses", "reports", "tasks",
  ],
  sales_lead: ["overview", "my-payslip", "incentives", "employees", "reports", "tasks"],
  estimation_lead: ["overview", "my-payslip", "overtime", "employees", "reports", "tasks"],
};
