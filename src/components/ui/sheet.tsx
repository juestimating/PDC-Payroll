"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Right-side drill-down drawer. This is the workhorse of the "click any number
 * to reveal its breakdown" interaction. Handles escape, scroll-lock, backdrop,
 * and enter/exit transitions. Full-width on mobile, panel on desktop.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 220);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className={cn(
          "absolute inset-0 bg-foreground/30 transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute right-0 top-0 flex h-full w-full flex-col bg-surface shadow-pop transition-transform duration-200 ease-out",
          visible ? "translate-x-0" : "translate-x-full",
        )}
        style={{ maxWidth: width }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? <div className="border-t border-border bg-surface p-4">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/** A labelled figure row used inside drill-down sheets. */
export function BreakdownRow({
  label,
  value,
  sub,
  emphasis = false,
  accent,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  emphasis?: boolean;
  accent?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-2.5",
        emphasis && "border-t border-border pt-3 font-semibold",
      )}
    >
      <div className="flex items-center gap-2.5">
        {accent ? <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} /> : null}
        <div>
          <p className={cn("text-sm", emphasis ? "font-semibold text-foreground" : "text-muted")}>
            {label}
          </p>
          {sub ? <p className="text-xs text-subtle">{sub}</p> : null}
        </div>
      </div>
      <div className={cn("text-sm tabular-nums", emphasis ? "text-foreground" : "text-foreground")}>
        {value}
      </div>
    </div>
  );
}
