"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, LogOut, Menu, Search } from "lucide-react";
import { useAppState } from "@/components/providers/app-state";
import { useWorkspace } from "@/components/providers/workspace";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { CURRENT_MONTH, ROLES, ROLE_ORDER } from "@/lib/data";
import type { Role } from "@/lib/data";
import { formatMonthKey } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { PeriodControl } from "@/components/payroll/period-control";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { month, setMonth, role, setRole, user, authed } = useAppState();
  const { months, openMonth, isCreated, ready } = useWorkspace();

  async function signOut() {
    try {
      await getSupabaseBrowser().auth.signOut();
    } catch {
      /* ignore */
    }
    window.location.href = "/login";
  }

  // Once hydrated, default the view to the open month if the user hasn't moved off
  // the seed default — so a month opened in a previous session is shown on load.
  const synced = useRef(false);
  useEffect(() => {
    if (ready && !synced.current) {
      synced.current = true;
      if (month === CURRENT_MONTH && openMonth !== CURRENT_MONTH) setMonth(openMonth);
    }
  }, [ready, openMonth, month, setMonth]);

  const canManagePeriod = role === "super_admin" || role === "admin" || role === "hr";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open menu"
        className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative hidden max-w-xs flex-1 md:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input
          placeholder="Search employees, tasks…"
          className="h-9 w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 text-sm placeholder:text-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {canManagePeriod ? (
          <div className="hidden sm:block">
            <PeriodControl compact />
          </div>
        ) : null}

        <label className="hidden items-center gap-2 sm:flex">
          <span className="text-xs text-subtle">Month</span>
          <div className="relative">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 appearance-none rounded-lg border border-border bg-surface pl-3 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {[...months].reverse().map((m) => (
                <option key={m} value={m}>
                  {formatMonthKey(m)}
                  {m === openMonth ? " · open" : isCreated(m) ? " · new" : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          </div>
        </label>

        {!authed ? (
          <div className="relative" title="Preview the UI as a different role (demo)">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="h-9 appearance-none rounded-lg border border-border bg-surface pl-3 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {ROLES[r].label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-l border-border pl-2 sm:pl-3">
          <Avatar name={user.name} size={32} />
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-medium text-foreground">{user.name}</p>
            <p className="text-xs text-muted">{ROLES[role].label}</p>
          </div>
          {authed ? (
            <button
              type="button"
              onClick={signOut}
              title="Sign out"
              aria-label="Sign out"
              className="ml-1 rounded-lg p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
