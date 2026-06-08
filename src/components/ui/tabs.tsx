"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto border-b border-border no-scrollbar", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cn(
            "relative -mb-px whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors",
            value === t.value ? "text-foreground" : "text-muted hover:text-foreground",
          )}
        >
          {t.label}
          {value === t.value ? (
            <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
          ) : null}
        </button>
      ))}
    </div>
  );
}
