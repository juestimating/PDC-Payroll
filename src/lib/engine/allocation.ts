// =============================================================================
// Multi-entity cost-allocation engine — sheet "All office expenses".
//
// The owner runs three legal entities out of ONE shared cost base (JU
// Estimation, Pavilion Design Consultants, B4U). Every consolidated expense
// line on the "All office expenses" sheet is split across cols H=JU, I=PDC,
// J=B4U so each entity carries its true share. This engine is the policy-driven
// allocator behind that split.
//
// THE GOLDEN INVARIANT: for every line, the per-entity amounts MUST sum back to
// the line's own total (within RECONCILE_EPSILON). A consolidated cost is never
// created or destroyed by allocation — only apportioned. allocateAll() then
// rolls the per-entity shares up into entity totals + a grand total and asserts
// the grand total equals the sum of every line amount.
//
// Methods supported (the union of what the live sheet actually does):
//   - single_entity : 100% of the line to one entity.
//   - fixed_pct     : weights per entity, e.g. {JU:0.75, PDC:0.25} (utilities,
//                     misc). Weights must sum to 1.
//   - explicit      : caller supplies the per-entity amounts directly; they are
//                     asserted to sum to the line total.
//   - team_routing  : a base total with a carve-out — base − carveOut goes to
//                     the "to" entity, the carveOut to the "carveTo" entity.
//                     (Sales: total 1,178,083 − 96,500 Social-Media → JU, the
//                     96,500 → PDC.)
//   - pre_split     : fixed amounts are peeled off to named entities and the
//                     REMAINDER goes to a base entity. (Admin: 298,333.33 − 55,000
//                     PDC − 18,000 B4U → JU.)
//
// Control totals it reproduces — the CURRENT "All office expenses" allocation
// (historical baseline; a future config may re-apportion WHT/IT across entities,
// but this reproduces today's sheet):
//   JU  total = 3,276,902.3465
//   PDC total =   454,951.9167
//   B4U total =    18,000
//   grand     = 3,749,854.2632   (col E33)
// Verified in scripts/checks/allocation-check.ts.
// =============================================================================
import { num, sum, approxEqual } from "./money";
import { ENTITY_CODES, EntityCode, RECONCILE_EPSILON } from "./constants";

/** Per-entity amount vector. Every entity is always present (missing = 0). */
export type EntitySplit = Record<EntityCode, number>;

/** A zeroed split — the additive identity for accumulating entity totals. */
export function zeroSplit(): EntitySplit {
  return { JU: 0, PDC: 0, B4U: 0 };
}

// ---- Allocation methods (discriminated union) -------------------------------

/** 100% of the line to a single entity. */
export interface SingleEntityMethod {
  kind: "single_entity";
  entity: EntityCode;
}

/** Weighted split; weights must sum to 1 (e.g. {JU:0.75, PDC:0.25}). */
export interface FixedPctMethod {
  kind: "fixed_pct";
  weights: Partial<Record<EntityCode, number>>;
}

/** Caller-supplied per-entity amounts; asserted to sum to the line total. */
export interface ExplicitMethod {
  kind: "explicit";
  amounts: Partial<Record<EntityCode, number>>;
}

/**
 * A base total minus a carve-out: (total − carveOut) → `to`, carveOut → `carveTo`.
 * Models Sales: 1,178,083 routed with 96,500 (Social Media) peeled to PDC.
 */
export interface TeamRoutingMethod {
  kind: "team_routing";
  carveOut: number;
  to: EntityCode;
  carveTo: EntityCode;
}

/**
 * Peel fixed amounts off to named entities; the remainder goes to `base`.
 * Models Admin: 298,333.33 − 55,000 (PDC) − 18,000 (B4U) → JU.
 */
export interface PreSplitMethod {
  kind: "pre_split";
  base: EntityCode;
  carveOuts: Partial<Record<EntityCode, number>>;
}

export type AllocationMethod =
  | SingleEntityMethod
  | FixedPctMethod
  | ExplicitMethod
  | TeamRoutingMethod
  | PreSplitMethod;

/** One consolidated expense line on the sheet. */
export interface AllocationLine {
  /** Row label (e.g. "Technical Estimation", "Utilities/rents"). */
  label: string;
  /** The consolidated line total (col E). May be negative (e.g. salary taxes). */
  amount: number;
  /** How to split `amount` across the three entities. */
  method: AllocationMethod;
}

/** Per-line allocation result: the split plus a reconciliation flag. */
export interface AllocatedLine {
  label: string;
  amount: number;
  split: EntitySplit;
  /** Does the split sum back to `amount` within RECONCILE_EPSILON? */
  reconciled: boolean;
}

/** Roll-up of every line: per-entity totals, grand total, completeness flags. */
export interface AllocationResult {
  lines: AllocatedLine[];
  /** Per-entity column totals (cols H/I/J). */
  byEntity: EntitySplit;
  /** Grand total across all entities (col E33). */
  grandTotal: number;
  /** Sum of the raw input line amounts — what grandTotal must equal. */
  inputTotal: number;
  /** Every line reconciled AND grandTotal === inputTotal (within epsilon). */
  complete: boolean;
}

// ---- Core: split one line ---------------------------------------------------

/**
 * Apply a line's allocation method to produce its per-entity split. FULL
 * PRECISION — no rounding here; rounding is a display concern only.
 */
export function allocateLine(line: AllocationLine): AllocatedLine {
  const amount = num(line.amount);
  const split = zeroSplit();
  const m = line.method;

  switch (m.kind) {
    case "single_entity": {
      split[m.entity] = amount;
      break;
    }
    case "fixed_pct": {
      const weightTotal = sum(ENTITY_CODES.map((e) => num(m.weights[e])));
      if (!approxEqual(weightTotal, 1, 1e-9)) {
        throw new Error(
          `allocateLine("${line.label}"): fixed_pct weights sum to ${weightTotal}, must be 1`,
        );
      }
      for (const e of ENTITY_CODES) split[e] = amount * num(m.weights[e]);
      break;
    }
    case "explicit": {
      for (const e of ENTITY_CODES) split[e] = num(m.amounts[e]);
      break;
    }
    case "team_routing": {
      const carveOut = num(m.carveOut);
      split[m.carveTo] += carveOut;
      split[m.to] += amount - carveOut;
      break;
    }
    case "pre_split": {
      let remainder = amount;
      for (const e of ENTITY_CODES) {
        const carve = num(m.carveOuts[e]);
        if (carve !== 0) {
          split[e] += carve;
          remainder -= carve;
        }
      }
      split[m.base] += remainder;
      break;
    }
    default: {
      // Exhaustiveness guard — TS errors if a new method kind is unhandled.
      const _never: never = m;
      throw new Error(`allocateLine: unhandled method ${JSON.stringify(_never)}`);
    }
  }

  const reconciled = approxEqual(
    sum(ENTITY_CODES.map((e) => split[e])),
    amount,
    RECONCILE_EPSILON,
  );
  return { label: line.label, amount, split, reconciled };
}

// ---- Core: split every line and roll up -------------------------------------

/**
 * Allocate a full set of consolidated lines into per-entity totals + a grand
 * total, with a completeness check (every line reconciles AND the grand total
 * equals the sum of the input line amounts — i.e. nothing leaked).
 */
export function allocateAll(lines: readonly AllocationLine[]): AllocationResult {
  const allocated = lines.map(allocateLine);

  const byEntity = zeroSplit();
  for (const a of allocated) {
    for (const e of ENTITY_CODES) byEntity[e] += a.split[e];
  }

  const grandTotal = sum(ENTITY_CODES.map((e) => byEntity[e]));
  const inputTotal = sum(allocated.map((a) => a.amount));
  const everyLineOk = allocated.every((a) => a.reconciled);
  const grandOk = approxEqual(grandTotal, inputTotal, RECONCILE_EPSILON);

  return {
    lines: allocated,
    byEntity,
    grandTotal,
    inputTotal,
    complete: everyLineOk && grandOk,
  };
}
