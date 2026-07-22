import { formatMoney } from "@/lib/format";
import type { TopService } from "@/lib/dashboard/metrics";

export function TopServices({
  data,
  base,
}: {
  data: TopService[];
  base: string;
}) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Нет данных.
      </p>
    );
  }
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <ul className="space-y-3">
      {data.map((s) => (
        <li key={s.name} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate font-medium">{s.name}</span>
            <span className="tabular-nums text-muted-foreground">
              {formatMoney(s.value, base)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max((s.value / max) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
