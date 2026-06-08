"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Check, ChevronLeft, ChevronRight, Plus, RotateCcw } from "lucide-react";
import { useAppState } from "@/components/providers/app-state";
import { EMPLOYEES, employeeById, getTasks } from "@/lib/data";
import type { TaskItem, TaskStatus } from "@/lib/data";
import { formatMonthKeyLong } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

const ACTIVE = EMPLOYEES.filter((e) => e.status === "active");

export default function TasksPage() {
  const { month } = useAppState();
  const [overrides, setOverrides] = useState<Record<string, TaskStatus>>({});
  const [open, setOpen] = useState(false);

  const tasks = getTasks({ month });
  const status = (t: TaskItem) => overrides[t.id] ?? t.status;
  const move = (id: string, s: TaskStatus) => setOverrides((o) => ({ ...o, [id]: s }));

  const grouped = useMemo(() => {
    const g: Record<TaskStatus, TaskItem[]> = { todo: [], in_progress: [], done: [] };
    for (const t of tasks) g[status(t)].push(t);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, overrides]);

  return (
    <>
      <PageHeader
        title="Task Board"
        description={`${formatMonthKeyLong(month)} · payroll & operations`}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            New task
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm text-brand-700">
        <CalendarClock className="h-4 w-4" />
        Payroll tasks are auto-scheduled at the start of every month (e.g. process salaries on the 25th).
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <div key={col.key} className="rounded-2xl bg-surface-muted/50 p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted">
                {grouped[col.key].length}
              </span>
            </div>
            <div className="space-y-2.5">
              {grouped[col.key].length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-subtle">Nothing here</p>
              ) : (
                grouped[col.key].map((t) => (
                  <TaskCard key={t.id} task={t} status={col.key} onMove={move} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="New task" subtitle={formatMonthKeyLong(month)}>
        <TaskForm onClose={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function TaskCard({
  task,
  status,
  onMove,
}: {
  task: TaskItem;
  status: TaskStatus;
  onMove: (id: string, s: TaskStatus) => void;
}) {
  const assignee = task.assigneeId ? employeeById.get(task.assigneeId) : undefined;
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{task.title}</p>
        {task.kind === "payroll" ? <Badge tone="brand">Payroll</Badge> : null}
      </div>
      {task.description ? (
        <p className="mt-1 line-clamp-2 text-xs text-subtle">{task.description}</p>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <StatusBadge status={task.priority} />
        <span className="text-xs text-subtle">Due {task.dueDate}</span>
        {assignee ? <Avatar name={assignee.name} size={22} className="ml-auto" /> : null}
      </div>
      <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-2.5">
        {status !== "todo" ? (
          <button
            onClick={() => onMove(task.id, status === "done" ? "in_progress" : "todo")}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-surface-muted"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </button>
        ) : null}
        {status === "todo" ? (
          <button
            onClick={() => onMove(task.id, "in_progress")}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
          >
            Start
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : status === "in_progress" ? (
          <button
            onClick={() => onMove(task.id, "done")}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-positive hover:bg-positive-soft"
          >
            <Check className="h-3.5 w-3.5" />
            Complete
          </button>
        ) : (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-positive">
            <Check className="h-3.5 w-3.5" />
            Done
          </span>
        )}
      </div>
    </Card>
  );
}

function TaskForm({ onClose }: { onClose: () => void }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="space-y-4"
    >
      <Field label="Title" required>
        <Input placeholder="e.g. Review increment requests" required />
      </Field>
      <Field label="Assign to">
        <Select>
          {ACTIVE.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Due date">
          <Input type="date" />
        </Field>
        <Field label="Priority">
          <Select defaultValue="medium">
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
        </Field>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Create task</Button>
      </div>
      <p className="text-center text-xs text-subtle">UI preview — saving wires to Supabase later.</p>
    </form>
  );
}
