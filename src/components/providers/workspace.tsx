"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  allMonthKeys,
  applyOffboard,
  applyReinstate,
  applyStartNewMonth,
  effectiveOpenMonth,
  isMonthCreated,
  isUiDeparted,
  loadWorkspace,
  resetWorkspace,
  subscribe,
  type UiDeparture,
} from "@/lib/data/overlay";

interface WorkspaceState {
  /** True once localStorage has been read on the client. */
  ready: boolean;
  /** Bumps on every workspace change so consumers re-read the selectors. */
  version: number;
  /** Current open / processing month. */
  openMonth: string;
  /** All selectable months, oldest → newest. */
  months: string[];
  isCreated: (month: string) => boolean;
  /** Whether an employee was offboarded via the UI (vs. a seed departure). */
  isUiDeparted: (id: string) => boolean;
  /** Close the open month and open the next; returns the new open month. */
  startNewMonth: () => string;
  /** Mark an employee as left. */
  offboard: (id: string, info: UiDeparture) => void;
  /** Reverse a UI offboarding. */
  reinstate: (id: string) => void;
  /** Discard all workspace changes (back to the seed). */
  reset: () => void;
}

const Ctx = createContext<WorkspaceState | null>(null);

/**
 * Owns the persisted workspace overlay (open period + offboardings) and bridges
 * its React-free pub/sub into context. Hydrates from localStorage after mount so
 * server and first client render match the seed (no hydration mismatch).
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadWorkspace();
    setReady(true);
    return subscribe(() => setVersion((v) => v + 1));
  }, []);

  const startNewMonth = useCallback(() => applyStartNewMonth(), []);
  const offboard = useCallback((id: string, info: UiDeparture) => applyOffboard(id, info), []);
  const reinstate = useCallback((id: string) => applyReinstate(id), []);
  const reset = useCallback(() => resetWorkspace(), []);

  const value = useMemo<WorkspaceState>(
    () => ({
      ready,
      version,
      openMonth: effectiveOpenMonth(),
      months: allMonthKeys(),
      isCreated: isMonthCreated,
      isUiDeparted,
      startNewMonth,
      offboard,
      reinstate,
      reset,
    }),
    // version is the change signal; the accessors above read fresh overlay state.
    [ready, version, startNewMonth, offboard, reinstate, reset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return v;
}
