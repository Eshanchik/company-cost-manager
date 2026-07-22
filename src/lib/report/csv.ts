import { REASON_LABEL, type MonthlyReport } from "@/lib/report/monthly-report";

const BOM = "﻿";
const SEP = ";";

function cell(v: string | number): string {
  const s = String(v);
  if (s.includes(SEP) || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(cells: (string | number)[]): string {
  return cells.map(cell).join(SEP);
}

/** CSV отчёта план/факт, UTF-8 with BOM (кириллица в Excel не бьётся). */
export function buildReportCsv(report: MonthlyReport): string {
  const monthLabel = `${report.year}-${String(report.month0 + 1).padStart(2, "0")}`;
  const viewLabel = report.view === "normalized" ? "нормализованное" : "кэш-флоу";
  const lines: string[] = [];

  lines.push(row(["Отчёт план/факт", monthLabel, `Представление: ${viewLabel}`, `Валюта: ${report.base}`]));
  lines.push("");
  lines.push(row(["Итого план", "Итого факт", "Дельта", "% отклонения"]));
  lines.push(
    row([report.totals.plan, report.totals.fact, report.totals.delta, report.totals.pct])
  );
  lines.push("");

  lines.push(row(["Сервис", "Категория", "Ответственный", "Валюта", "План", "Факт", "Дельта", "Причина"]));
  for (const s of report.services) {
    lines.push(
      row([s.name, s.category, s.owner, s.currency, s.plan, s.fact, s.delta, REASON_LABEL[s.reason]])
    );
  }
  lines.push("");

  lines.push(row(["Срез по категориям", "План", "Факт", "Дельта"]));
  for (const c of report.byCategory) {
    lines.push(row([c.name, c.plan, c.fact, c.delta]));
  }
  lines.push("");

  lines.push(row(["Срез по ответственным", "План", "Факт", "Дельта"]));
  for (const o of report.byOwner) {
    lines.push(row([o.name, o.plan, o.fact, o.delta]));
  }
  lines.push("");

  lines.push(row(["События месяца"]));
  for (const e of report.events) lines.push(row([e]));

  return BOM + lines.join("\r\n");
}
