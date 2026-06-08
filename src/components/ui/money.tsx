import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatPKR, formatPKRCompact, formatSignedPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/** A formatted PKR figure with tabular numerals. */
export function Money({
  value,
  compact = false,
  symbol = true,
  signed = false,
  className,
}: {
  value: number;
  compact?: boolean;
  symbol?: boolean;
  signed?: boolean;
  className?: string;
}) {
  const abs = Math.abs(value);
  const formatted = compact ? formatPKRCompact(abs, { symbol }) : formatPKR(abs, { symbol });
  const sign = value < 0 ? "- " : signed ? "+ " : "";
  return <span className={cn("tnum tabular-nums", className)}>{sign}{formatted}</span>;
}

/** A trend chip: arrow + percent, coloured by whether the direction is good. */
export function Delta({
  value,
  goodWhen = "neutral",
  className,
  showIcon = true,
}: {
  value: number | null;
  goodWhen?: "up" | "down" | "neutral";
  className?: string;
  showIcon?: boolean;
}) {
  if (value == null || Number.isNaN(value)) {
    return <span className={cn("text-xs text-subtle", className)}>New</span>;
  }
  const flat = Math.abs(value) < 0.05;
  const up = value > 0;
  const tone = flat
    ? "muted"
    : goodWhen === "neutral"
      ? "muted"
      : up === (goodWhen === "up")
        ? "positive"
        : "negative";

  const toneClass =
    tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-muted";
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium tnum", toneClass, className)}>
      {showIcon ? <Icon className="h-3.5 w-3.5" strokeWidth={2.5} /> : null}
      {formatSignedPercent(value)}
    </span>
  );
}
