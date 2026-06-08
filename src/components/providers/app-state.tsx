"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { CURRENT_MONTH, DEMO_USER_BY_ROLE } from "@/lib/data";
import type { AppUser, Role } from "@/lib/data";

interface AppState {
  role: Role;
  setRole: (r: Role) => void;
  user: AppUser;
  month: string;
  setMonth: (m: string) => void;
}

const Ctx = createContext<AppState | null>(null);

/**
 * Global UI state: the previewed role (for the RBAC demo) and the selected
 * payroll month. In production the role comes from the authenticated session;
 * here a switcher lets you preview every role's view.
 */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("admin");
  const [month, setMonth] = useState<string>(CURRENT_MONTH);

  const value = useMemo<AppState>(
    () => ({ role, setRole, user: DEMO_USER_BY_ROLE[role], month, setMonth }),
    [role, month],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState must be used within AppStateProvider");
  return v;
}
