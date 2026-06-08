import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "neutral" | "brand" | "positive" | "negative" | "warning" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted border-border",
  brand: "bg-brand-50 text-brand-700 border-brand-100",
  positive: "bg-positive-soft text-positive border-transparent",
  negative: "bg-negative-soft text-negative border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  info: "bg-info-soft text-info border-transparent",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" /> : null}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  paid: "positive",
  closed: "neutral",
  processing: "info",
  draft: "warning",
  active: "positive",
  inactive: "neutral",
  done: "positive",
  in_progress: "info",
  todo: "neutral",
  high: "negative",
  medium: "warning",
  low: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  in_progress: "In progress",
  todo: "To do",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  const label = STATUS_LABEL[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <Badge tone={tone} dot className={className}>
      {label}
    </Badge>
  );
}
