import Link from "next/link";
import { AlertTriangle, CalendarClock } from "lucide-react";

import { getCurrentUser, hasRole } from "@/lib/authz";
import { getExpectedCharges } from "@/lib/plan/expected-charges";
import { getDashboardMetrics } from "@/lib/dashboard/metrics";
import { getUnusedSeats } from "@/lib/seats/unused";
import { UnusedSeatsPanel } from "@/components/unused-seats-panel";
import { formatMoney, formatDate } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExpectedChargesFeed } from "@/components/expected-charges-feed";
import { PlanFactChart } from "@/components/charts/plan-fact-chart";
import { CategoryDonut } from "@/components/charts/category-donut";
import { TopServices } from "@/components/charts/top-services";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const canEdit = user ? hasRole(user.role, "manager") : false;

  const [m, expected, unused] = await Promise.all([
    getDashboardMetrics(),
    getExpectedCharges(),
    getUnusedSeats(),
  ]);

  const attentionCount =
    m.overdue.length + m.renewals.length + unused.seats.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Дашборд</h1>
        <p className="text-sm text-muted-foreground">
          Обзор расходов на подписки. Суммы в базовой валюте ({m.base}).
        </p>
      </div>

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Run-rate / мес" description="Нормализованная стоимость">
          {formatMoney(m.runRateMonthly, m.base)}
        </Kpi>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Факт vs план</CardTitle>
            <CardDescription>Текущий месяц</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatMoney(m.monthFact, m.base)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              из {formatMoney(m.monthPlan, m.base)} плана · {m.progressPct}%
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(m.progressPct, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Kpi title="Прогноз" description="Осталось до конца месяца">
          {formatMoney(m.forecastRemaining, m.base)}
        </Kpi>
        <Kpi title="Активные" description="Сервисы / места">
          {m.activeServices} / {m.activeSeats}
        </Kpi>
      </div>

      {/* Требует внимания */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            <CardTitle>Требует внимания</CardTitle>
            {attentionCount > 0 && (
              <Badge variant="destructive">{attentionCount}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {attentionCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              Всё в порядке: просрочек и годовых в окне решения нет.
            </p>
          ) : (
            <div className="space-y-4">
              {m.overdue.length > 0 && (
                <div>
                  <h3 className="mb-1 text-sm font-medium">
                    Просроченные подтверждения ({m.overdue.length})
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {m.overdue.map((c) => (
                      <li key={c.id} className="flex justify-between">
                        <Link
                          href={`/services/${c.serviceId}`}
                          className="hover:underline"
                        >
                          {c.serviceName}
                        </Link>
                        <span className="text-muted-foreground">
                          ожидалось {formatDate(c.expectedDate)} ·{" "}
                          {formatMoney(c.amountBase, m.base)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {m.renewals.length > 0 && (
                <div>
                  <h3 className="mb-1 flex items-center gap-1 text-sm font-medium">
                    <CalendarClock className="size-4" /> Годовые в окне решения (
                    {m.renewals.length})
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {m.renewals.map((r) => (
                      <li key={r.serviceId} className="flex justify-between">
                        <Link
                          href={`/services/${r.serviceId}`}
                          className="hover:underline"
                        >
                          {r.name}
                        </Link>
                        <span className="text-muted-foreground">
                          продление {formatDate(r.renewalDate)} · через{" "}
                          {r.daysLeft} дн.
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <UnusedSeatsPanel seats={unused.seats} canEdit={canEdit} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ожидаемые списания */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Ожидаемые списания</CardTitle>
          <CardDescription>
            Подтвердите списание в один клик или пометьте «списания не было».
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExpectedChargesFeed
            charges={expected.charges}
            baseCurrency={expected.baseCurrency}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>

      {/* Графики */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>План / факт — 12 месяцев</CardTitle>
          </CardHeader>
          <CardContent>
            <PlanFactChart data={m.planFact12} base={m.base} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Топ-5 по стоимости</CardTitle>
          </CardHeader>
          <CardContent>
            <TopServices data={m.top5} base={m.base} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Расходы по категориям (run-rate/мес)</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryDonut data={m.byCategory} base={m.base} />
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{children}</div>
      </CardContent>
    </Card>
  );
}
