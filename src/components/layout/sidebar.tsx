"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "@/components/providers/app-state";
import { ROLE_NAV } from "@/lib/data";
import { NAV_ITEMS, SECTION_ORDER } from "./nav";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { role } = useAppState();
  const allowed = new Set(ROLE_NAV[role]);
  const items = NAV_ITEMS.filter((i) => allowed.has(i.key));

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 no-scrollbar">
        {SECTION_ORDER.map((section) => {
          const secItems = items.filter((i) => i.section === section);
          if (secItems.length === 0) return null;
          return (
            <div key={section} className="mb-4">
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">
                {section}
              </p>
              <ul className="space-y-0.5">
                {secItems.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-brand-50 text-brand-700"
                            : "text-muted hover:bg-surface-muted hover:text-foreground",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4.5 w-4.5 shrink-0",
                            active ? "text-brand-600" : "text-subtle group-hover:text-foreground",
                          )}
                        />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="rounded-xl bg-surface-muted p-3">
          <p className="text-xs font-semibold text-foreground">PKR · Monthly cycle</p>
          <p className="mt-0.5 text-xs text-muted">Front-end preview on mock data</p>
        </div>
      </div>
    </div>
  );
}
