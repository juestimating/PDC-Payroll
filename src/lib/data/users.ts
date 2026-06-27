// =============================================================================
// Demo app users for the role switcher. Lets you preview how the UI changes per
// role (the real gate is RLS server-side). Each maps to a real employee where
// relevant so the "self" views show believable data.
// =============================================================================
import type { AppUser } from "./types";

export const DEMO_USERS: AppUser[] = [
  { id: "user-admin", name: "Admin (You)", role: "admin" },
  { id: "user-hr", name: "Aadil Fahim", role: "hr", departmentId: "dept-admin", employeeId: "emp-036" },
  { id: "user-head", name: "Awais Munir", role: "dept_head", departmentId: "dept-estimation", employeeId: "emp-016" },
  { id: "user-employee", name: "Ayesha Khan", role: "employee", departmentId: "dept-sales", employeeId: "emp-011" },
];

export const DEMO_USER_BY_ROLE = Object.fromEntries(
  DEMO_USERS.map((u) => [u.role, u]),
) as Record<AppUser["role"], AppUser>;
