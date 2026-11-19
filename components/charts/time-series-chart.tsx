"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/*
 * Reference categorical palette, fixed order (validated with the dataviz
 * checker on the white card surface). Slot 3 has < 3:1 contrast against
 * white, so this chart always offers a visible table view.
 */
/**
 * Categorical slots 1-3 in fixed order: brand grape, orange, aqua. Validated
 * with the dataviz checker on the white card surface, including all-pairs
 * (worst colour-blind separation dE 9.2, normal vision 27.6). Aqua is under
 * 3:1 on white, so every chart keeps a legend, a table view and visible labels.
 */
export const SERIES_COLORS = ["#5b3fe4", "#eb6834", "#1baf7a"] as const;

export interface Series {
  key: string;
  label: string;
}

type Row = Record<string, string | number>;

function ChartTooltip({ active, payload, label, series }: { active?: boolean; payload?: Array<{ dataKey?: string | number; value?: number }>; label?: string; series: Series[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {series.map((s, i) => (
        <p key={s.key} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-sm" style={{ background: SERIES_COLORS[i] }} aria-hidden />
          {s.label}: <span className="font-medium tabular-nums text-foreground">{payload.find((p) => p.dataKey === s.key)?.value ?? 0}</span>
        </p>
      ))}
    </div>
  );
}

/** Grouped bars over time (max 3 series) with legend, tooltip and a table view. */
export function TimeSeriesChart({ data, series, xKey, ariaLabel, height = 220 }: { data: Row[]; series: Series[]; xKey: string; ariaLabel: string; height?: number }) {
  const [asTable, setAsTable] = useState(false);
  const shown = series.slice(0, 3);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {shown.map((s, i) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: SERIES_COLORS[i] }} aria-hidden />
              {s.label}
            </span>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
          {asTable ? <BarChart3 /> : <Table2 />} {asTable ? "View as chart" : "View as table"}
        </Button>
      </div>
      {asTable ? (
        <div className="max-h-72 overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Date</th>
                {shown.map((s) => (
                  <th key={s.key} className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-1.5">{row[xKey]}</td>
                  {shown.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-right tabular-nums">
                      {row[s.key] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height }} role="img" aria-label={ariaLabel}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#ebe8f7" />
              <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#5b5878" }} minTickGap={20} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#5b5878" }} width={36} />
              <Tooltip cursor={{ fill: "rgba(15,26,43,0.04)" }} content={<ChartTooltip series={shown} />} />
              {shown.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={SERIES_COLORS[i]} radius={[4, 4, 0, 0]} maxBarSize={12} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/** Horizontal magnitude bars for a categorical breakdown (single hue). */
export function BreakdownBars({ rows, valueLabel = "Total" }: { rows: Array<{ label: string; value: number; dotClass?: string }>; valueLabel?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No data yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="sr-only">
        <tr>
          <th>Category</th>
          <th>{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="group">
            <td className="w-40 py-1.5 pr-3 align-middle">
              <span className="flex items-center gap-2">
                {r.dotClass ? <span className={`size-2 rounded-full ${r.dotClass}`} aria-hidden /> : null}
                <span className="truncate">{r.label}</span>
              </span>
            </td>
            <td className="py-1.5 align-middle">
              <div className="flex items-center gap-2">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-[#5b3fe4]" style={{ width: `${(r.value / max) * 100}%` }} />
                </div>
                <span className="w-10 text-right tabular-nums text-muted-foreground">{r.value}</span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
