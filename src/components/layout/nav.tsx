import {
  BadgePercent,
  BarChart3,
  CalendarOff,
  CheckCheck,
  CreditCard,
  FileText,
  Gauge,
  HandCoins,
  Landmark,
  ListChecks,
  Timer,
  TrendingDown,
  TrendingUp,
  UserMinus,
  Users,
  Wallet,
  Wallet2,
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
  { key: "overview", label: "Overview", href: "/overview", icon: Gauge, section: "Overview" },
  { key: "my-payslip", label: "My Payslip", href: "/my-payslip", icon: FileText, section: "Overview" },
  { key: "payroll", label: "Payroll", href: "/payroll", icon: Wallet, section: "Payroll" },
  { key: "overtime", label: "Overtime", href: "/overtime", icon: Timer, section: "Payroll" },
  { key: "increments", label: "Increments", href: "/increments", icon: TrendingUp, section: "Payroll" },
  { key: "deductions", label: "Deductions", href: "/deductions", icon: TrendingDown, section: "Payroll" },
  { key: "tax", label: "Tax", href: "/tax", icon: Landmark, section: "Payroll" },
  { key: "loans", label: "Loans", href: "/loans", icon: HandCoins, section: "Adjustments" },
  { key: "advances", label: "Advances", href: "/advances", icon: Wallet2, section: "Adjustments" },
  { key: "leaves", label: "Unpaid Leaves", href: "/leaves", icon: CalendarOff, section: "Adjustments" },
  { key: "incentives", label: "Sales Incentives", href: "/incentives", icon: BadgePercent, section: "Adjustments" },
  { key: "approvals", label: "Approvals", href: "/approvals", icon: CheckCheck, section: "Adjustments" },
  { key: "employees", label: "Employees", href: "/employees", icon: Users, section: "People" },
  { key: "offboarding", label: "Offboarding", href: "/offboarding", icon: UserMinus, section: "People" },
  { key: "expenses", label: "Expenses", href: "/expenses", icon: CreditCard, section: "Finance" },
  { key: "reports", label: "Reports", href: "/reports", icon: BarChart3, section: "Finance" },
  { key: "tasks", label: "Tasks", href: "/tasks", icon: ListChecks, section: "Workspace" },
];

export const SECTION_ORDER = ["Overview", "Payroll", "Adjustments", "People", "Finance", "Workspace"];
