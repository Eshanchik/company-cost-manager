import { Download } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/authz";
import { serviceMonthlyRunRate } from "@/lib/calc/service-cost";
import { convert, type RateRecord } from "@/lib/calc/fx";
import { Button } from "@/components/ui/button";
import { CsvImportDialog } from "@/components/csv-import-dialog";
import { ServicesTable, type ServiceRow } from "./services-table";
import type { ServiceOptions } from "@/components/service-dialog";

function ownerLabel(u: { name: string | null; email: string | null }): string {
  return u.name ?? u.email ?? "—";
}

export default async function ServicesPage() {
  const user = await getCurrentUser();
  const canEdit = user ? hasRole(user.role, "manager") : false;

  const [services, categories, users, methods, settings, ratesRaw] =
    await Promise.all([
      prisma.service.findMany({
        // Домены живут на своём экране, чтобы не забивать список подписок.
        where: { kind: "service" },
        include: {
          category: true,
          owner: true,
          paymentMethod: true,
          seats: { where: { endedAt: null } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      prisma.user.findMany({ orderBy: { name: "asc" } }),
      prisma.paymentMethod.findMany({ orderBy: { name: "asc" } }),
      prisma.setting.upsert({
        where: { id: "singleton" },
        update: {},
        create: { id: "singleton" },
      }),
      prisma.fxRate.findMany(),
    ]);

  const baseCurrency = settings.baseCurrency;
  const rates: RateRecord[] = ratesRaw.map((r) => ({
    date: r.date,
    from: r.from,
    to: r.to,
    rate: r.rate,
  }));
  const now = new Date();

  const rows: ServiceRow[] = services.map((s) => {
    const runRate = serviceMonthlyRunRate({
      billingModel: s.billingModel,
      billingCycle: s.billingCycle,
      price: s.price,
      seats: s.seats,
    });
    // §4.7: в таблицах и итогах — базовая валюта; исходная сумма — в тултипе.
    const converted = convert(runRate, s.currency, baseCurrency, now, rates);
    return {
    id: s.id,
    name: s.name,
    vendorUrl: s.vendorUrl,
    categoryId: s.categoryId,
    categoryName: s.category?.name ?? null,
    billingModel: s.billingModel,
    billingCycle: s.billingCycle,
    runRateMonthly: runRate.toNumber(),
    runRateBase: (converted ?? runRate).toNumber(),
    hasRate: s.currency === baseCurrency || converted !== null,
    currency: s.currency,
    seatsCount: s.seats.length,
    ownerId: s.ownerId,
    ownerLabel: ownerLabel(s.owner),
    paymentMethodId: s.paymentMethodId,
    paymentMethodName: s.paymentMethod?.name ?? null,
    nextPaymentDate: s.nextPaymentDate?.toISOString() ?? null,
    prepaidUntil: s.prepaidUntil?.toISOString() ?? null,
    status: s.status,
    };
  });

  const options: ServiceOptions = {
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    owners: users.map((u) => ({ id: u.id, label: ownerLabel(u) })),
    methods: methods.map((m) => ({
      id: m.id,
      name: m.name,
      isArchived: m.isArchived,
    })),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Сервисы</h1>
          <p className="text-sm text-muted-foreground">
            Подписки компании: стоимость, места, ответственные.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <CsvImportDialog kind="services" />}
          {canEdit && <CsvImportDialog kind="seats" />}
          <Button asChild variant="outline">
            <a href="/api/export?kind=services" download>
              <Download className="size-4" /> Экспорт CSV
            </a>
          </Button>
        </div>
      </div>
      <ServicesTable
        rows={rows}
        options={options}
        canEdit={canEdit}
        baseCurrency={baseCurrency}
      />
    </div>
  );
}
