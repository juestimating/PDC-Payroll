"use client";

// =============================================================================
// RoleGate — action-level RBAC for the UI. Wrap a create/approve/export button
// (or any element) so only the allowed roles see it. Route-level hiding lives in
// the sidebar (ROLE_NAV); this gates affordances *within* a page. RLS remains the
// real server-side gate — this is UX, not security.
// =============================================================================
import type { ReactNode } from "react";
import { useAppState } from "@/components/providers/app-state";
import type { Role } from "@/lib/data";

export function RoleGate({
  roles,
  fallback = null,
  children,
}: {
  roles: Role[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { role } = useAppState();
  if (!roles.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}

/** Hook form, for conditional logic (e.g. read-only vs editable columns). */
export function useHasRole(...roles: Role[]): boolean {
  const { role } = useAppState();
  return roles.includes(role);
}
