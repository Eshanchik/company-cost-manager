import { ShieldAlert } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/authz";
import { getSettings } from "@/lib/actions/settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CategoriesManager } from "./categories-manager";
import { PaymentMethodsManager } from "./payment-methods-manager";
import { SettingsForm } from "./settings-form";
import { FxRatesManager, type FxRateRow } from "./fx-rates-manager";
import { RebuildSnapshotButton } from "./snapshots-manager";
import { TokensManager, type TokenRow } from "./tokens-manager";
import { AccessManager, type AccessRow } from "./access-manager";
import { monthStart } from "@/lib/plan/generate-snapshot";
import { forecastToEndOfMonth } from "@/lib/plan/forecast";
import { formatMoney, formatDate } from "@/lib/format";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const isAdmin = user ? hasRole(user.role, "admin") : false;

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-destructive" />
              <CardTitle>Раздел только для администраторов</CardTitle>
            </div>
            <CardDescription>
              Справочники и параметры инстанса доступны только роли
              «Администратор».
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const [categories, methods, settings, fxRatesRaw] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.paymentMethod.findMany({
      orderBy: [{ isArchived: "asc" }, { name: "asc" }],
    }),
    getSettings(),
    prisma.fxRate.findMany({ orderBy: { date: "desc" } }),
  ]);

  const [allowedEmails, users] = await Promise.all([
    prisma.allowedEmail.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({ select: { email: true } }),
  ]);
  const userEmails = new Set(
    users.map((u) => u.email?.toLowerCase()).filter(Boolean)
  );
  const selfEmail = user?.email?.toLowerCase();
  const accessRows: AccessRow[] = allowedEmails.map((a) => ({
    id: a.id,
    email: a.email,
    role: a.role,
    addedBy: a.addedBy,
    createdAt: a.createdAt.toISOString(),
    hasLoggedIn: userEmails.has(a.email.toLowerCase()),
    isSelf: selfEmail === a.email.toLowerCase(),
  }));

  const tokens: TokenRow[] = (
    await prisma.apiToken.findMany({ orderBy: { createdAt: "desc" } })
  ).map((t) => ({
    id: t.id,
    name: t.name,
    role: t.role,
    prefix: t.prefix,
    createdAt: t.createdAt.toISOString(),
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
    revokedAt: t.revokedAt?.toISOString() ?? null,
  }));

  // Последний известный курс для каждой пары from→to.
  const latestByPair = new Map<string, FxRateRow>();
  for (const r of fxRatesRaw) {
    const key = `${r.from}-${r.to}`;
    if (!latestByPair.has(key)) {
      latestByPair.set(key, {
        from: r.from,
        to: r.to,
        rate: r.rate.toString(),
        date: r.date.toISOString(),
      });
    }
  }
  const fxRates = [...latestByPair.values()].sort((a, b) =>
    `${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`)
  );
  const today = new Date().toISOString().slice(0, 10);

  // План-снапшот текущего месяца + прогноз до конца месяца.
  const now = new Date();
  const currentMonth = monthStart(now.getUTCFullYear(), now.getUTCMonth());
  const [snapshot, forecast] = await Promise.all([
    prisma.planSnapshot.findUnique({
      where: { month: currentMonth },
      include: { _count: { select: { lines: true } }, lines: true },
    }),
    forecastToEndOfMonth(now),
  ]);
  const snapshotTotal = snapshot
    ? snapshot.lines.reduce((acc, l) => acc + l.amountBase.toNumber(), 0)
    : 0;
  const monthLabel = `${now.getUTCFullYear()}-${String(
    now.getUTCMonth() + 1
  ).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
        <p className="text-sm text-muted-foreground">
          Справочники и параметры инстанса.
        </p>
      </div>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Категории</TabsTrigger>
          <TabsTrigger value="methods">Способы оплаты</TabsTrigger>
          <TabsTrigger value="fx">Курсы валют</TabsTrigger>
          <TabsTrigger value="plans">Планы</TabsTrigger>
          <TabsTrigger value="access">Доступ</TabsTrigger>
          <TabsTrigger value="tokens">API-токены</TabsTrigger>
          <TabsTrigger value="params">Параметры</TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <Card>
            <CardContent className="pt-6">
              <CategoriesManager categories={categories} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="methods">
          <Card>
            <CardContent className="pt-6">
              <PaymentMethodsManager methods={methods} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fx">
          <Card>
            <CardContent className="pt-6">
              <FxRatesManager
                baseCurrency={settings.baseCurrency}
                rates={fxRates}
                today={today}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <Card>
            <CardHeader>
              <CardTitle>План-снапшот месяца {monthLabel}</CardTitle>
              <CardDescription>
                Снапшот фиксирует план 1-го числа (§3.8) и задним числом не
                меняется. Прогноз считается по живым данным.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-x-10 gap-y-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Статус снапшота
                  </div>
                  <div className="mt-1 font-medium">
                    {snapshot
                      ? `Собран ${formatDate(snapshot.createdAt)} · ${snapshot._count.lines} строк`
                      : "Ещё не собран"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    План (снапшот), {forecast.base}
                  </div>
                  <div className="mt-1 font-medium">
                    {snapshot ? formatMoney(snapshotTotal, forecast.base) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Прогноз месяца (живой), {forecast.base}
                  </div>
                  <div className="mt-1 font-medium">
                    {formatMoney(forecast.monthTotal.toNumber(), forecast.base)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Осталось до конца месяца
                  </div>
                  <div className="mt-1 font-medium">
                    {formatMoney(forecast.remaining.toNumber(), forecast.base)}
                  </div>
                </div>
              </div>
              <RebuildSnapshotButton />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access">
          <Card>
            <CardHeader>
              <CardTitle>Доступ (whitelist и роли)</CardTitle>
              <CardDescription>
                Вход в систему — только по Google для приглашённых email. Здесь
                управляете списком и ролями.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AccessManager rows={accessRows} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tokens">
          <Card>
            <CardHeader>
              <CardTitle>API / MCP-токены</CardTitle>
              <CardDescription>
                Bearer-токены для REST API (`/api/v1/*`) и MCP-сервера (`/mcp`).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TokensManager tokens={tokens} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="params">
          <Card>
            <CardHeader>
              <CardTitle>Параметры инстанса</CardTitle>
              <CardDescription>
                Базовая валюта и срок подтверждения списаний.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsForm settings={settings} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
