import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const PALETTE = [
  "#6366f1", "#0ea5e9", "#ec4899", "#14b8a6",
  "#f59e0b", "#8b5cf6", "#ef4444", "#10b981",
];

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function Avatar({
  name,
  size = 36,
  color,
  className,
}: {
  name: string;
  size?: number;
  color?: string;
  className?: string;
}) {
  const c = color ?? colorFor(name);
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-semibold", className)}
      style={{
        width: size,
        height: size,
        backgroundColor: `${c}1f`,
        color: c,
        fontSize: size * 0.38,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
