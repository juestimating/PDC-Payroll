// =============================================================================
// Currency + number + date formatting for PDC Payroll.
// Currency: PKR. Display symbol "Rs". Compact uses K / M / B (millions).
// =============================================================================

export const CURRENCY_SYMBOL = "Rs";

const grouped = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const grouped2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Full amount, e.g. formatPKR(1234567) -> "Rs 1,234,567". */
export function formatPKR(
  value: number,
  opts?: { decimals?: boolean; symbol?: boolean },
): string {
  const { decimals = false, symbol = true } = opts ?? {};
  const n = decimals ? grouped2.format(value) : grouped.format(Math.round(value));
  return symbol ? `${CURRENCY_SYMBOL} ${n}` : n;
}

/** Compact amount in millions: "Rs 1.2B", "Rs 12.3M", "Rs 85K", "Rs 850". */
export function formatPKRCompact(value: number, opts?: { symbol?: boolean }): string {
  const { symbol = true } = opts ?? {};
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  let out: string;
  if (abs >= 1_000_000_000) out = `${trimOne(abs / 1_000_000_000)}B`;
  else if (abs >= 1_000_000) out = `${trimOne(abs / 1_000_000)}M`;
  else if (abs >= 1_000) out = `${trimOne(abs / 1_000)}K`;
  else out = `${Math.round(abs)}`;
  const body = `${sign}${out}`;
  return symbol ? `${CURRENCY_SYMBOL} ${body}` : body;
}

/** Amount in millions with fixed decimals, e.g. formatPKRMillions(2866930) -> "2.87M". */
export function formatPKRMillions(value: number, opts?: { symbol?: boolean; decimals?: number }): string {
  const { symbol = false, decimals = 2 } = opts ?? {};
  const body = `${(value / 1_000_000).toFixed(decimals)}M`;
  return symbol ? `${CURRENCY_SYMBOL} ${body}` : body;
}

function trimOne(n: number): string {
  const s = n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** Plain grouped number, no currency. */
export function formatNumber(value: number): string {
  return grouped.format(Math.round(value));
}

/** Percent with fixed decimals, e.g. "12.4%". */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/** Signed delta for trends, e.g. "+4.2%" / "-1.1%". */
export function formatSignedPercent(value: number, decimals = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2025-03" -> "Mar 2025". */
export function formatMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** "2025-03" -> "March 2025". */
export function formatMonthKeyLong(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_LONG[(m ?? 1) - 1]} ${y}`;
}

/** "2025-03" -> "Mar". */
export function formatMonthShort(key: string): string {
  const [, m] = key.split("-").map(Number);
  return MONTHS[(m ?? 1) - 1];
}

/** The real calendar month key for today, e.g. "2026-07". */
export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Inclusive ascending list of month keys, e.g. monthRange("2026-04", "2026-07") -> ["2026-04", …, "2026-07"]. */
export function monthRange(from: string, to: string): string[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const out: string[] = [];
  for (let i = fy * 12 + (fm - 1); i <= ty * 12 + (tm - 1); i++) {
    out.push(`${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`);
  }
  return out;
}

/** Initials from a full name, e.g. "Ayesha Khan" -> "AK". */
export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
