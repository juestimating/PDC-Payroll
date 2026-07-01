// =============================================================================
// Demo app users for the DEV-ONLY role switcher. Lets you preview how the UI
// changes per role. In production the role comes from the authenticated Supabase
// session (JWT claim), and RLS is the real gate — this switcher is hidden.
// Each maps to a real employee where relevant so "self" views show believable data.
// =============================================================================
import type { AppUser } from "./types";

export const DEMO_USERS: AppUser[] = [
  { id: "user-super", name: "Owner (You)", role: "super_admin" },
  { id: "user-admin", name: "Ajmal Ramzan", role: "admin", departmentId: "dept-admin", employeeId: "emp-038" },
  { id: "user-hr", name: "Aadil Fahim", role: "hr", departmentId: "dept-admin", employeeId: "emp-036" },
  { id: "user-sales", name: "Muhammad Yahya", role: "sales_lead", departmentId: "dept-sales", employeeId: "emp-001" },
  { id: "user-estimation", name: "Awais Munir", role: "estimation_lead", departmentId: "dept-estimation", employeeId: "emp-016" },
];

export const DEMO_USER_BY_ROLE = Object.fromEntries(
  DEMO_USERS.map((u) => [u.role, u]),
) as Record<AppUser["role"], AppUser>;
