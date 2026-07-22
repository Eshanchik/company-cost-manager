import Link from "next/link";

import {
  getMonthlyReport,
  REASON_LABEL,
  type ReportView,
  type DeltaReason,
} from "@/lib/report/monthly-report";
import { formatMoney } from "@/lib/format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReportControls } from "./report-controls";

const REASON_VARIANT: Record<
  DeltaReason,
  "default" | "secondary" | "destructive" | "outline"
> = {
  match: "outline",
  new: "default",
  unconfirmed: "destructive",
  waived: "secondary",
  amount_change: "default",
  fx: "secondary",
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const monthStr =
    sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : currentMonth();
  const view: ReportView = sp.view === "normalized" ? "normalized" : "cashflow";

  const [y, m] = monthStr.split("-").map(Number);
  const report = await getMonthlyReport(y!, m! - 1, view);

  const money = (n: number) => formatMoney(n, report.base);
  const deltaClass = (d: number) =>
    d > 0 ? "text-destructive" : d < 0 ? "text-emerald-600" : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Отчёт «План / Факт»
        </h1>
        <p className="text-sm text-muted-foreground">
          Суммы в базовой валюте ({report.base}).
        </p>
      </div>

      <ReportControls month={monthStr} view={view} />

      {!report.hasSnapshot && (
        <p className="rounded-md border border-dashed border-amber-500/50 bg-amber-500/5 p-3 text-sm text-muted-foreground">
          За этот месяц нет план-снапшота — план считается по факту 0. Снапшот
          создаётся 1-го числа автоматически или пересобирается в настройках.
        </p>
      )}

      {/* Итоги */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Summary title="План">{money(report.totals.plan)}</Summary>
        <Summary title="Факт">{money(report.totals.fact)}</Summary>
        <Summary title="Дельта">
          <span className={deltaClass(report.totals.delta)}>
            {money(report.totals.delta)}
          </span>
        </Summary>
        <Summary title="% отклонения">
          <span className={deltaClass(report.totals.delta)}>
            {report.totals.pct}%
          </span>
        </Summary>
      </div>

      {/* Таблица по сервисам */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>По сервисам</CardTitle>
        </CardHeader>
        <CardContent>
          {report.services.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Нет данных за месяц.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Сервис</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead className="text-right">План</TableHead>
                    <TableHead className="text-right">Факт</TableHead>
                    <TableHead className="text-right">Дельта</TableHead>
                    <TableHead>Причина</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.services.map((s) => (
                    <TableRow key={s.serviceId}>
                      <TableCell>
                        <Link
                          href={`/services/${s.serviceId}`}
                          className="font-medium hover:underline"
                        >
                          {s.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{s.category}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(s.plan)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(s.fact)}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${deltaClass(s.delta)}`}
                      >
                        {money(s.delta)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={REASON_VARIANT[s.reason]}>
                          {REASON_LABEL[s.reason]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Срезы */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SliceCard title="По категориям" rows={report.byCategory} money={money} />
        <SliceCard title="По ответственным" rows={report.byOwner} money={money} />
      </div>

      {/* События */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>События месяца</CardTitle>
        </CardHeader>
        <CardContent>
          {report.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Событий нет.</p>
          ) : (
            <ul className="list-inside list-disc space-y-1 text-sm">
              {report.events.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xl font-semibold tabular-nums">{children}</div>
      </CardContent>
    </Card>
  );
}

function SliceCard({
  title,
  rows,
  money,
}: {
  title: string;
  rows: { name: string; plan: number; fact: number; delta: number }[];
  money: (n: number) => string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead className="text-right">План</TableHead>
                <TableHead className="text-right">Факт</TableHead>
                <TableHead className="text-right">Дельта</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Нет данных.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="text-sm">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(r.plan)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(r.fact)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(r.delta)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
