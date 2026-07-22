"use client";

import { useRouter } from "next/navigation";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReportView } from "@/lib/report/monthly-report";

export function ReportControls({
  month,
  view,
}: {
  month: string; // YYYY-MM
  view: ReportView;
}) {
  const router = useRouter();

  const go = (nextMonth: string, nextView: ReportView) => {
    router.push(`/reports?month=${nextMonth}&view=${nextView}`);
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Месяц</label>
        <Input
          type="month"
          value={month}
          onChange={(e) => e.target.value && go(e.target.value, view)}
          className="w-44"
        />
      </div>

      <div className="space-y-1">
        <span className="block text-xs text-muted-foreground">Представление</span>
        <div className="inline-flex rounded-md border p-0.5">
          <Button
            type="button"
            size="sm"
            variant={view === "cashflow" ? "default" : "ghost"}
            onClick={() => go(month, "cashflow")}
          >
            Кэш-флоу
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "normalized" ? "default" : "ghost"}
            onClick={() => go(month, "normalized")}
          >
            Нормализованное
          </Button>
        </div>
      </div>

      <Button asChild variant="outline">
        <a href={`/api/reports/export?month=${month}&view=${view}`} download>
          <Download className="size-4" /> Экспорт CSV
        </a>
      </Button>
    </div>
  );
}
