"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  /** Hide this column below the md breakpoint. */
  hideOnMobile?: boolean;
  headerClassName?: string;
  cellClassName?: string;
  width?: string;
}

/**
 * Dense, responsive table. Sticky header, right-aligned figures, hover rows,
 * optional row click. On mobile it either renders a card per row (when
 * `mobileCard` is provided) or scrolls horizontally.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  dense = false,
  stickyHeader = true,
  footer,
  mobileCard,
  className,
  emptyState,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  dense?: boolean;
  stickyHeader?: boolean;
  footer?: ReactNode;
  mobileCard?: (row: T) => ReactNode;
  className?: string;
  emptyState?: ReactNode;
}) {
  const alignClass = (a?: Column<T>["align"]) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  if (rows.length === 0 && emptyState) {
    return <div>{emptyState}</div>;
  }

  return (
    <div className={className}>
      {/* Desktop / tablet table */}
      <div className={cn("overflow-x-auto", mobileCard && "hidden md:block")}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={cn("border-b border-border", stickyHeader && "sticky top-0 z-10 bg-surface")}>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ width: c.width }}
                  className={cn(
                    "px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-subtle",
                    alignClass(c.align),
                    c.hideOnMobile && "hidden lg:table-cell",
                    c.headerClassName,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={getRowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-border/70 last:border-0",
                  onRowClick && "cursor-pointer transition-colors hover:bg-surface-muted/60",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      dense ? "px-3 py-2" : "px-3 py-3",
                      "text-foreground",
                      alignClass(c.align),
                      (c.align === "right" || c.align === "center") && "tabular-nums",
                      c.hideOnMobile && "hidden lg:table-cell",
                      c.cellClassName,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer ? <tfoot>{footer}</tfoot> : null}
        </table>
      </div>

      {/* Mobile card list */}
      {mobileCard ? (
        <div className="space-y-2.5 md:hidden">
          {rows.map((row, i) => (
            <div key={getRowKey(row, i)} onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {mobileCard(row)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
