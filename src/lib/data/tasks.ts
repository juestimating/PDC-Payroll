// =============================================================================
// Task board data: monthly recurring payroll tasks auto-scheduled at the start
// of every month, plus general operational tasks. Past months are done; the
// current month is live.
// =============================================================================
import { CURRENT_MONTH, MONTHS, monthIndex } from "./engine";
import type { TaskItem, TaskStatus } from "./types";

interface Recurring {
  key: string;
  title: (label: string) => string;
  day: string; // day-of-month due
  assigneeId?: string;
  kind: "payroll" | "general";
  priority: TaskItem["priority"];
}

const RECURRING: Recurring[] = [
  { key: "process", title: (m) => `Process ${m} payroll`, day: "25", assigneeId: "emp-036", kind: "payroll", priority: "high" },
  { key: "commissions", title: (m) => `Approve ${m} sales commissions`, day: "22", assigneeId: "emp-001", kind: "general", priority: "high" },
  { key: "overtime", title: (m) => `Verify ${m} overtime logs`, day: "21", assigneeId: "emp-016", kind: "general", priority: "medium" },
  { key: "expenses", title: (m) => `Reconcile ${m} expenses`, day: "27", assigneeId: "emp-038", kind: "general", priority: "medium" },
  { key: "tax", title: (m) => `File ${m} withholding tax`, day: "15", assigneeId: "emp-036", kind: "general", priority: "medium" },
];

const MONTH_LABEL: Record<string, string> = {};
{
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (const m of MONTHS) {
    const [y, mm] = m.split("-").map(Number);
    MONTH_LABEL[m] = `${names[mm - 1]} ${y}`;
  }
}

function buildTasks(): TaskItem[] {
  const out: TaskItem[] = [];
  const curIdx = monthIndex(CURRENT_MONTH);

  for (const month of MONTHS) {
    const idx = monthIndex(month);
    const label = MONTH_LABEL[month];
    for (const r of RECURRING) {
      let status: TaskStatus;
      if (idx < curIdx) status = "done";
      else if (r.key === "process") status = "todo";
      else if (r.key === "commissions") status = "in_progress";
      else if (r.key === "overtime") status = "in_progress";
      else status = "todo";

      out.push({
        id: `task-${r.key}-${month}`,
        title: r.title(label),
        description:
          r.kind === "payroll"
            ? "Auto-scheduled at the start of the month. Review components, confirm, and lock the run."
            : undefined,
        status,
        priority: r.priority,
        assigneeId: r.assigneeId,
        dueDate: `${month}-${r.day}`,
        month,
        kind: r.kind,
      });
    }
  }

  // A few standalone general tasks in the current month.
  out.push(
    {
      id: "task-onboard-001",
      title: "Onboard new design hire",
      description: "Set up salary structure, accounts, and equipment.",
      status: "todo",
      priority: "medium",
      assigneeId: "emp-036",
      dueDate: `${CURRENT_MONTH}-18`,
      month: CURRENT_MONTH,
      kind: "general",
    },
    {
      id: "task-audit-001",
      title: "Quarterly payroll audit",
      description: "Reconcile recomputed totals against stored figures for Q2.",
      status: "in_progress",
      priority: "high",
      assigneeId: "emp-038",
      dueDate: `${CURRENT_MONTH}-30`,
      month: CURRENT_MONTH,
      kind: "general",
    },
    {
      id: "task-policy-001",
      title: "Review travel allowance policy",
      description: "Propose updated travel tiers for FY26.",
      status: "todo",
      priority: "low",
      assigneeId: "emp-036",
      dueDate: `${CURRENT_MONTH}-28`,
      month: CURRENT_MONTH,
      kind: "general",
    },
  );

  return out;
}

export const TASKS: TaskItem[] = buildTasks();
