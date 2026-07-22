"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatMoney } from "@/lib/format";
import type { CategorySlice } from "@/lib/dashboard/metrics";

export function CategoryDonut({
  data,
  base,
}: {
  data: CategorySlice[];
  base: string;
}) {
  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Нет данных.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <ResponsiveContainer width="100%" height={220} className="max-w-[220px]">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
          >
            {data.map((s) => (
              <Cell key={s.name} fill={s.color} stroke="hsl(var(--background))" />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number, n) => [formatMoney(v, base), n as string]}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
              color: "hsl(var(--popover-foreground))",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 space-y-1.5 text-sm">
        {data.map((s) => (
          <li key={s.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <span
                className="inline-block size-3 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {formatMoney(s.value, base)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
