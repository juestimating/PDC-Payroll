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
  /** True when a real Supabase session drives the role (hides the demo switcher). */
  authed: boolean;
}

const Ctx = createContext<AppState | null>(null);

/**
 * Global UI state: the active role + selected payroll month. When `authed` (a
 * real Supabase session), the role/user come from the server (the demo switcher
 * is hidden). Otherwise a client switcher lets you preview each role on mock data.
 */
export function AppStateProvider({
  children,
  authed = false,
  initialRole,
  initialUser,
}: {
  children: ReactNode;
  authed?: boolean;
  initialRole?: Role;
  initialUser?: AppUser;
}) {
  const [role, setRole] = useState<Role>(initialRole ?? "super_admin");
  const [month, setMonth] = useState<string>(CURRENT_MONTH);

  const value = useMemo<AppState>(
    () => ({
      role,
      setRole,
      user: authed && initialUser ? initialUser : DEMO_USER_BY_ROLE[role],
      month,
      setMonth,
      authed,
    }),
    [role, month, authed, initialUser],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState must be used within AppStateProvider");
  return v;
}
