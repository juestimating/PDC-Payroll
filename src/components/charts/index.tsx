"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPKR, formatPKRCompact } from "@/lib/format";

// Keep in sync with the brand tokens in globals.css.
export const CHART = {
  brand: "#3a4fe0",
  brandSoft: "#9db4ff",
  accent: "#f59e0b",
  positive: "#15a04a",
  negative: "#dc2626",
  info: "#2563eb",
  violet: "#8b5cf6",
  grid: "#eef1f6",
  axis: "#8a94a6",
};

export interface Datum {
  label: string;
  [key: string]: number | string;
}

const axisTick = { fill: CHART.axis, fontSize: 12 } as const;
const compact = (v: number | string) => formatPKRCompact(Number(v), { symbol: false });

/* eslint-disable @typescript-eslint/no-explicit-any */
function CurrencyTooltip({ active, payload, label, full }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-pop">
      <p className="mb-1 text-xs font-medium text-muted">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: p.color || p.stroke || p.fill }}
          />
          <span className="text-muted">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums text-foreground">
            {full ? formatPKR(Number(p.value)) : formatPKRCompact(Number(p.value))}
          </span>
        </div>
      ))}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Single-series filled trend (gradient area). */
export function TrendArea({
  data,
  dataKey,
  name = "Value",
  color = CHART.brand,
  height = 260,
}: {
  data: Datum[];
  dataKey: string;
  name?: string;
  color?: string;
  height?: number;
}) {
  const id = `grad-${dataKey}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.26} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} dy={6} />
        <YAxis tickLine={false} axisLine={false} width={46} tick={axisTick} tickFormatter={compact} />
        <Tooltip content={<CurrencyTooltip />} cursor={{ stroke: CHART.grid }} />
        <Area
          type="monotone"
          dataKey={dataKey}
          name={name}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${id})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Multiple line series (e.g. payroll vs expenses vs tax). */
export function MultiTrend({
  data,
  series,
  height = 280,
}: {
  data: Datum[];
  series: { key: string; name: string; color: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} dy={6} />
        <YAxis tickLine={false} axisLine={false} width={46} tick={axisTick} tickFormatter={compact} />
        <Tooltip content={<CurrencyTooltip />} cursor={{ stroke: CHART.grid }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Horizontal comparison bars (e.g. by department). */
export function ComparisonBar({
  data,
  height,
}: {
  data: { label: string; value: number; color?: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(150, data.length * 46)}>
      <BarChart layout="vertical" data={data} margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={CHART.grid} />
        <XAxis
          type="number"
          tickFormatter={compact}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={104}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "rgba(14,23,38,0.03)" }} />
        <Bar dataKey="value" name="Total" radius={[0, 6, 6, 0]} barSize={18}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color || CHART.brand} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Donut composition with an optional centred figure. */
export function Donut({
  data,
  height = 220,
  centerLabel,
  centerValue,
}: {
  data: { label: string; value: number; color: string }[];
  height?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Tooltip content={<CurrencyTooltip />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="64%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {centerValue ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-lg font-semibold tabular-nums text-foreground">{centerValue}</p>
            {centerLabel ? <p className="text-xs text-muted">{centerLabel}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Tiny inline area trend for KPI cards. */
export function Sparkline({
  data,
  dataKey = "value",
  color = CHART.brand,
  height = 40,
}: {
  data: Datum[];
  dataKey?: string;
  color?: string;
  height?: number;
}) {
  const id = `spark-${dataKey}-${color.replace("#", "")}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={`url(#${id})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
