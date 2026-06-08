import { cn } from "@/lib/utils";

/** A single horizontal magnitude bar (used for share-of-total comparisons). */
export function Bar({
  value,
  max,
  color = "var(--color-brand-500)",
  className,
  track = true,
  height = 8,
}: {
  value: number;
  max: number;
  color?: string;
  className?: string;
  track?: boolean;
  height?: number;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full", track && "bg-surface-muted", className)}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}
