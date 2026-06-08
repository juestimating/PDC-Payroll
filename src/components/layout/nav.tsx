import {
  BarChart3,
  CreditCard,
  FileText,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import type { ComponentType } from "react";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  section: string;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, section: "Overview" },
  { key: "my-payslip", label: "My Payslip", href: "/my-payslip", icon: FileText, section: "Overview" },
  { key: "payroll", label: "Payroll", href: "/payroll", icon: Wallet, section: "Payroll" },
  { key: "overtime", label: "Overtime", href: "/overtime", icon: Timer, section: "Payroll" },
  { key: "increments", label: "Increments", href: "/increments", icon: TrendingUp, section: "Payroll" },
  { key: "deductions", label: "Deductions", href: "/deductions", icon: TrendingDown, section: "Payroll" },
  { key: "tax", label: "Tax", href: "/tax", icon: Landmark, section: "Payroll" },
  { key: "employees", label: "Employees", href: "/employees", icon: Users, section: "People" },
  { key: "expenses", label: "Expenses", href: "/expenses", icon: CreditCard, section: "Finance" },
  { key: "reports", label: "Reports", href: "/reports", icon: BarChart3, section: "Finance" },
  { key: "tasks", label: "Tasks", href: "/tasks", icon: ListChecks, section: "Workspace" },
];

export const SECTION_ORDER = ["Overview", "Payroll", "People", "Finance", "Workspace"];
