// =============================================================================
// Overview cockpit selectors — everything the Overview page renders is derived
// HERE, from the real May seed through the verified engines. The UI never holds
// a magic number; it asks these functions.
// =============================================================================
import {
  computePayroll,
  allocateAll,
  computeFinalSettlement,
  type EntityCode,
  type PayrollComputation,
} from "@/lib/engine";
import {
  ROSTER,
  ALLOCATION_LINES,
  INCENTIVE_SUMMARY,
  EXIT_CASES,
  DATA_QUALITY,
  ENTITY_META,
  type RosterEmployee,
} from "./seed";

export type { EntityCode } from "@/lib/engine";

const ENTITIES: EntityCode[] = ["JU", "PDC", "B4U"];

/** Each roster row paired with its verified payroll computation. */
export function computedRoster(): { emp: RosterEmployee; comp: PayrollComputation }[] {
  return ROSTER.map((emp) => ({ emp, comp: computePayroll(emp) }));
}

// ---- Group headline + entity-filtered headline ------------------------------
export interface CockpitTotals {
  /** Allocated cost (payroll + overhead) for the scope. */
  totalCost: number;
  net: number;
  wht: number;
  headcount: number;
  paid: number;
}

const sum = (ns: number[]): number => ns.reduce((a, b) => a + b, 0);

/**
 * Headline figures for an entity scope. `entity` undefined = the whole group.
 * Total cost is the allocated cost (incl. overhead); net/WHT/headcount are the
 * entity-tagged payroll figures.
 */
export function cockpitTotals(entity?: EntityCode): CockpitTotals {
  const rows = computedRoster().filter((r) => !entity || r.emp.entity === entity);
  const alloc = allocateAll(ALLOCATION_LINES);
  const totalCost = entity ? alloc.byEntity[entity] : alloc.grandTotal;
  return {
    totalCost,
    net: sum(rows.map((r) => r.comp.net)),
    wht: sum(rows.map((r) => r.comp.withholdingTax)),
    headcount: rows.length,
    paid: rows.filter((r) => r.comp.days > 0).length,
  };
}

// ---- Cost by entity (the donut) ---------------------------------------------
export interface EntityPnL {
  entity: EntityCode;
  label: string;
  color: string;
  cost: number;
  share: number; // 0..1 of grand total
  headcount: number;
}

export function entityPnL(): EntityPnL[] {
  const alloc = allocateAll(ALLOCATION_LINES);
  const grand = alloc.grandTotal;
  return ENTITIES.map((e) => ({
    entity: e,
    label: ENTITY_META[e].label,
    color: ENTITY_META[e].color,
    cost: alloc.byEntity[e],
    share: grand ? alloc.byEntity[e] / grand : 0,
    headcount: ROSTER.filter((r) => r.entity === e).length,
  })).sort((a, b) => b.cost - a.cost);
}

/** Did every allocation line reconcile and the grand total tie out? */
export function allocationComplete(): boolean {
  return allocateAll(ALLOCATION_LINES).complete;
}

// ---- Cost composition (where the money goes) --------------------------------
export interface CompositionItem {
  label: string;
  value: number;
}

/** Positive consolidated cost categories, largest first. */
export function costComposition(): CompositionItem[] {
  return ALLOCATION_LINES.filter((l) => l.amount > 0)
    .map((l) => ({ label: l.label, value: l.amount }))
    .sort((a, b) => b.value - a.value);
}

// ---- Needs attention --------------------------------------------------------
export type AttentionTone = "danger" | "warning" | "accent";

export interface AttentionItem {
  id: string;
  icon: "hold" | "calendar" | "trophy" | "id";
  tone: AttentionTone;
  title: string;
  detail: string;
  amount: number | null;
  count: number;
}

export function attentionItems(): AttentionItem[] {
  const settlements = EXIT_CASES.map((c) => ({ c, s: computeFinalSettlement(c) }));
  const held = settlements.filter((x) => x.s.status === "held");
  const scheduled = settlements.filter((x) => x.s.status === "scheduled");

  const items: AttentionItem[] = [];

  if (held.length) {
    items.push({
      id: "held",
      icon: "hold",
      tone: "danger",
      title: `${held.length} payment${held.length > 1 ? "s" : ""} held`,
      detail: held.map((x) => x.c.name.split(" ")[0]).join(", ") + " — no notice / ghosted",
      amount: sum(held.map((x) => x.s.net)),
      count: held.length,
    });
  }
  if (scheduled.length) {
    const when = scheduled[0]?.s.releaseDate ?? "";
    items.push({
      id: "scheduled",
      icon: "calendar",
      tone: "accent",
      title: `${scheduled.length} settlement${scheduled.length > 1 ? "s" : ""} due ${formatShortDate(when)}`,
      detail: scheduled.map((x) => x.c.name.split(" ")[0]).join(", ") + " — notice served",
      amount: sum(scheduled.map((x) => x.s.net)),
      count: scheduled.length,
    });
  }
  items.push({
    id: "kpi-held",
    icon: "trophy",
    tone: "warning",
    title: `${INCENTIVE_SUMMARY.heldCount} KPI-held bonuses`,
    detail: "Pending manager review",
    amount: INCENTIVE_SUMMARY.withheld,
    count: INCENTIVE_SUMMARY.heldCount,
  });
  if (DATA_QUALITY.missingCnic > 0) {
    items.push({
      id: "cnic",
      icon: "id",
      tone: "warning",
      title: `${DATA_QUALITY.missingCnic} missing CNIC`,
      detail: "Blocks FBR filing",
      amount: null,
      count: DATA_QUALITY.missingCnic,
    });
  }
  return items;
}

function formatShortDate(iso: string): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-").map(Number);
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][(m ?? 1) - 1];
  return `${mon} ${d}`;
}
