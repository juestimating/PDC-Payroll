"use client";

import { useState } from "react";
import { ArrowRight, CalendarPlus, Lock, Sparkles } from "lucide-react";
import { useAppState } from "@/components/providers/app-state";
import { useWorkspace } from "@/components/providers/workspace";
import { getEmployees, monthAfter } from "@/lib/data";
import { formatMonthKeyLong } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

/**
 * Closes the current open month and opens the next one. Salaries carry forward;
 * variable components (commission / overtime / deductions) reset to zero, ready
 * to be entered during the new month. The closed month becomes read-only.
 */
export function PeriodControl({ compact = false }: { compact?: boolean }) {
  const { openMonth, startNewMonth } = useWorkspace();
  const { setMonth } = useAppState();
  const [open, setOpen] = useState(false);

  const next = monthAfter(openMonth);
  const rosterCount = getEmployees({ status: "active" }).length;

  function confirm() {
    const opened = startNewMonth();
    setMonth(opened);
    setOpen(false);
  }

  return (
    <>
      <Button variant="outline" size={compact ? "sm" : "md"} onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4" />
        {compact ? "New month" : "Start new month"}
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Start a new month"
        subtitle="Close the current period and open the next"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirm}>
              <CalendarPlus className="h-4 w-4" />
              Open {formatMonthKeyLong(next)}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* current -> next */}
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-xl border border-border bg-surface-muted p-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Closing</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatMonthKeyLong(openMonth)}
              </p>
              <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted">
                <Lock className="h-3 w-3" /> locked
              </span>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-subtle" />
            <div className="flex-1 rounded-xl border border-brand-100 bg-brand-50 p-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">Opening</p>
              <p className="mt-1 text-sm font-semibold text-brand-700">{formatMonthKeyLong(next)}</p>
              <span className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600">
                <Sparkles className="h-3 w-3" /> processing
              </span>
            </div>
          </div>

          {/* what happens */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
              What happens
            </p>
            <ul className="space-y-2 text-sm text-muted">
              <Bullet>
                <strong className="font-medium text-foreground">{rosterCount} active employees</strong>{" "}
                are carried into {formatMonthKeyLong(next)} with their current salary structure.
              </Bullet>
              <Bullet>
                Variable items — commission, overtime, and deductions — start at zero, ready to log
                for the new month.
              </Bullet>
              <Bullet>
                {formatMonthKeyLong(openMonth)} is closed and locked. Its figures stay immutable for
                the record.
              </Bullet>
              <Bullet>Employees marked as left are not carried forward.</Bullet>
            </ul>
          </div>

          <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-subtle">
            Preview phase — this is saved in your browser. In the logic phase it writes to Supabase
            as a real, audited period close.
          </p>
        </div>
      </Sheet>
    </>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
      <span>{children}</span>
    </li>
  );
}
