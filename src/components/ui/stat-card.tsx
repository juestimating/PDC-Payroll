"use client";

import { cn } from "@/lib/utils";
import { Delta } from "./money";
import type { ReactNode } from "react";

/**
 * Headline KPI. Always pairs a figure with context (label + trend + a hint like
 * "vs last month") so a number is never bare. Clickable to drill into detail.
 */
export function StatCard({
  label,
  value,
  delta = null,
  deltaGoodWhen = "neutral",
  hint,
  icon,
  accent,
  onClick,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: number | null;
  deltaGoodWhen?: "up" | "down" | "neutral";
  hint?: string;
  icon?: ReactNode;
  accent?: string;
  onClick?: () => void;
  className?: string;
}) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-card",
        clickable && "cursor-pointer transition-shadow hover:shadow-md",
        className,
      )}
    >
      {accent ? (
        <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accent }} />
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
        {icon ? (
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface-muted text-muted transition-colors group-hover:text-foreground">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</div>
      {delta !== null || hint ? (
        <div className="mt-2 flex items-center gap-2">
          {delta !== null ? <Delta value={delta} goodWhen={deltaGoodWhen} /> : null}
          {hint ? <span className="text-xs text-subtle">{hint}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
