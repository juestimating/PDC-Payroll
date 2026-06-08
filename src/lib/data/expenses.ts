// =============================================================================
// Expense generator: fixed recurring items (auto-post every month, same amount)
// plus deterministic variable items, per department per month.
// =============================================================================
import { MONTHS } from "./engine";
import type { ExpenseItem } from "./types";

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rngFor(...parts: string[]): () => number {
  let s = hashStr(parts.join("|")) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function vary(rng: () => number, min: number, max: number): number {
  return Math.round((min + (max - min) * rng()) / 1000) * 1000;
}

interface Template {
  departmentId: string;
  category: string;
  label: string;
  recurring: boolean;
  vendor?: string;
  amount?: number; // fixed when recurring
  range?: [number, number]; // variable otherwise
  chance?: number; // probability the variable item appears in a month
}

const TEMPLATES: Template[] = [
  // Admin & HR — the org's fixed overhead
  { departmentId: "dept-admin", category: "Facilities", label: "Office Rent", recurring: true, amount: 1200000, vendor: "Gulberg Estates" },
  { departmentId: "dept-admin", category: "Utilities", label: "Electricity & Gas", recurring: true, amount: 185000, vendor: "LESCO / SNGPL" },
  { departmentId: "dept-admin", category: "Utilities", label: "Internet & Phones", recurring: true, amount: 92000, vendor: "Nayatel" },
  { departmentId: "dept-admin", category: "Office", label: "Pantry & Supplies", recurring: false, range: [38000, 86000], chance: 1 },
  { departmentId: "dept-admin", category: "Office", label: "Repairs & Maintenance", recurring: false, range: [20000, 120000], chance: 0.6 },

  // Sales & Marketing
  { departmentId: "dept-sales", category: "Software", label: "CRM & Sales Tools", recurring: true, amount: 120000, vendor: "HubSpot" },
  { departmentId: "dept-sales", category: "Marketing", label: "Digital Ad Spend", recurring: false, range: [200000, 620000], chance: 1 },
  { departmentId: "dept-sales", category: "Travel", label: "Client Visits & Travel", recurring: false, range: [70000, 210000], chance: 0.85 },
  { departmentId: "dept-sales", category: "Marketing", label: "Events & Sponsorships", recurring: false, range: [120000, 350000], chance: 0.35 },

  // Estimation
  { departmentId: "dept-estimation", category: "Software", label: "Estimation Licenses (Bluebeam, PlanSwift)", recurring: true, amount: 165000, vendor: "Bluebeam" },
  { departmentId: "dept-estimation", category: "Training", label: "Team Training", recurring: false, range: [40000, 140000], chance: 0.4 },
  { departmentId: "dept-estimation", category: "Hardware", label: "Workstation Upgrades", recurring: false, range: [80000, 260000], chance: 0.3 },

  // Design
  { departmentId: "dept-design", category: "Software", label: "Creative Suite (Adobe, Autodesk)", recurring: true, amount: 145000, vendor: "Adobe" },
  { departmentId: "dept-design", category: "Hardware", label: "GPU & Render Hardware", recurring: false, range: [90000, 320000], chance: 0.3 },
  { departmentId: "dept-design", category: "Assets", label: "Stock Assets & Plugins", recurring: false, range: [25000, 80000], chance: 0.7 },
];

function buildExpenses(): ExpenseItem[] {
  const out: ExpenseItem[] = [];
  for (const month of MONTHS) {
    for (const t of TEMPLATES) {
      if (t.recurring) {
        out.push({
          id: `exp-${t.departmentId}-${t.label}-${month}`.replace(/[^a-z0-9-]+/gi, "-"),
          month,
          departmentId: t.departmentId,
          category: t.category,
          label: t.label,
          amount: t.amount ?? 0,
          recurring: true,
          vendor: t.vendor,
        });
      } else if (t.range) {
        const rng = rngFor("exp", t.label, month);
        if (rng() <= (t.chance ?? 1)) {
          out.push({
            id: `exp-${t.departmentId}-${t.label}-${month}`.replace(/[^a-z0-9-]+/gi, "-"),
            month,
            departmentId: t.departmentId,
            category: t.category,
            label: t.label,
            amount: vary(rng, t.range[0], t.range[1]),
            recurring: false,
            vendor: t.vendor,
          });
        }
      }
    }
  }
  return out;
}

export const EXPENSES: ExpenseItem[] = buildExpenses();

export const expensesByMonth = new Map<string, ExpenseItem[]>();
for (const e of EXPENSES) {
  const list = expensesByMonth.get(e.month) ?? [];
  list.push(e);
  expensesByMonth.set(e.month, list);
}
