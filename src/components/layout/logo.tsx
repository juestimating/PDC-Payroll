import { cn } from "@/lib/utils";

/**
 * PDC wordmark placeholder. Swap the mark for your real SVG logo when ready —
 * the colours come from the brand tokens, so it re-skins automatically.
 */
export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-xs">
        P
      </span>
      {!compact ? (
        <span className="text-base font-semibold tracking-tight text-foreground">
          PDC <span className="font-normal text-muted">Payroll</span>
        </span>
      ) : null}
    </div>
  );
}
