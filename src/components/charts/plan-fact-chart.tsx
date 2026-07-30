"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoney } from "@/lib/format";
import type { MonthPoint } from "@/lib/dashboard/metrics";

export function PlanFactChart({
  data,
  base,
}: {
  data: MonthPoint[];
  base: string;
}) {
  const short = data.map((d) => ({ ...d, label: d.month.slice(2) })); // YY-MM
  const missing = short.filter((d) => !d.hasSnapshot).length;

  return (
    <>
      {missing > 0 && (
        <p className="mb-2 text-xs text-muted-foreground">
          За {missing} из {short.length} мес. план-снапшота не было — столбец
          плана не рисуется (это не нулевой план). Снапшот собирается 1-го числа.
        </p>
      )}
      <ResponsiveContainer width="100%" height={280}>
      <BarChart data={short} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          formatter={(v: number, name) => [
            formatMoney(v, base),
            name === "plan" ? "План" : "Факт",
          ]}
          labelFormatter={(l) => {
            const point = short.find((p) => p.label === l);
            return point && !point.hasSnapshot
              ? `20${l} · снапшота плана не было`
              : `20${l}`;
          }}
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
            color: "hsl(var(--popover-foreground))",
          }}
        />
        <Bar dataKey="plan" name="plan" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} />
        <Bar dataKey="fact" name="fact" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
      </BarChart>
      </ResponsiveContainer>
    </>
  );
}
