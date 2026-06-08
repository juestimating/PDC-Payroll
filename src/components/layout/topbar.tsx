"use client";

import { ChevronDown, Menu, Search } from "lucide-react";
import { useAppState } from "@/components/providers/app-state";
import { MONTHS, ROLES, ROLE_ORDER } from "@/lib/data";
import type { Role } from "@/lib/data";
import { formatMonthKey } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { month, setMonth, role, setRole, user } = useAppState();

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
        <label className="hidden items-center gap-2 sm:flex">
          <span className="text-xs text-subtle">Month</span>
          <div className="relative">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 appearance-none rounded-lg border border-border bg-surface pl-3 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {[...MONTHS].reverse().map((m) => (
                <option key={m} value={m}>
                  {formatMonthKey(m)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          </div>
        </label>

        <div className="relative" title="Preview the UI as a different role">
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

        <div className="flex items-center gap-2 border-l border-border pl-2 sm:pl-3">
          <Avatar name={user.name} size={32} />
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-medium text-foreground">{user.name}</p>
            <p className="text-xs text-muted">{ROLES[role].label}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
