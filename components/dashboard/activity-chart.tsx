"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";

/*
 * Two-series grouped bar (saved vs submitted per week).
 * Colours: reference categorical slots 1 & 2 in fixed order, validated with the
 * dataviz palette checker against the white card surface (all checks pass).
 */
const SERIES = [
  { key: "saved", label: "Saved", color: "#2a78d6" },
  { key: "submitted", label: "Submitted", color: "#eb6834" },
] as const;

interface Point {
  week: string;
  label: string;
  saved: number;
  submitted: number;
}

function ChartTooltip({ active, payload, label }: TooltipProps<number, string> & { payload?: Array<{ dataKey?: string | number; value?: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">Week of {label}</p>
      {SERIES.map((s) => {
        const v = payload.find((p) => p.dataKey === s.key)?.value ?? 0;
        return (
          <p key={s.key} className="flex items-center gap-2 text-muted-foreground">
            <span className="size-2 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.label}: <span className="font-medium tabular-nums text-foreground">{v}</span>
          </p>
        );
      })}
    </div>
  );
}

export function ActivityChart({ data }: { data: Point[] }) {
  const total = data.reduce((s, p) => s + p.saved + p.submitted, 0);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground" aria-hidden>
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      {total === 0 ? (
        <div className="flex h-44 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Activity appears here once you start saving and submitting applications.
        </div>
      ) : (
        <div className="h-44" role="img" aria-label="Applications saved and submitted per week, last 12 weeks">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#ece9e2" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#5a6372" }} interval="preserveStartEnd" minTickGap={16} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#5a6372" }} width={36} />
              <Tooltip cursor={{ fill: "rgba(15,26,43,0.04)" }} content={<ChartTooltip />} />
              {SERIES.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <table className="sr-only">
        <caption>Weekly application activity</caption>
        <thead>
          <tr>
            <th>Week of</th>
            <th>Saved</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.week}>
              <td>{p.label}</td>
              <td>{p.saved}</td>
              <td>{p.submitted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
