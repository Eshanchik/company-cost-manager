import { Download } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/authz";
import { serviceMonthlyRunRate } from "@/lib/calc/service-cost";
import { convert, type RateRecord } from "@/lib/calc/fx";
import { Button } from "@/components/ui/button";
import { CsvImportDialog } from "@/components/csv-import-dialog";
import { DomainsTable, type DomainRow } from "./domains-table";
import { DomainGuardSync } from "./domainguard-sync";
import type { ServiceOptions, ServiceDefaults } from "@/components/service-dialog";

function ownerLabel(u: { name: string | null; email: string | null }): string {
  return u.name ?? u.email ?? "—";
}

const DAY_MS = 86_400_000;

export default async function DomainsPage() {
  const user = await getCurrentUser();
  const canEdit = user ? hasRole(user.role, "manager") : false;
  const isAdmin = user ? hasRole(user.role, "admin") : false;
  const dgConfigured = Boolean(
    process.env.DOMAINGUARD_URL && process.env.DOMAINGUARD_TOKEN
  );

  const [domains, categories, users, methods, settings, ratesRaw] =
    await Promise.all([
      prisma.service.findMany({
        where: { kind: "domain" },
        include: { category: true, owner: true, seats: { where: { endedAt: null } } },
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
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  const rows: DomainRow[] = domains.map((s) => {
    const runRate = serviceMonthlyRunRate({
      billingModel: s.billingModel,
      billingCycle: s.billingCycle,
      price: s.price,
      seats: s.seats,
    });
    const runRateBase =
      convert(runRate, s.currency, baseCurrency, now, rates) ?? runRate;

    const defaults: ServiceDefaults = {
      id: s.id,
      kind: "domain",
      registrar: s.registrar ?? "",
      autoRenew: s.autoRenew,
      name: s.name,
      vendorUrl: s.vendorUrl ?? "",
      categoryId: s.categoryId ?? "",
      description: s.description ?? "",
      billingModel: s.billingModel,
      billingCycle: s.billingCycle,
      price: s.price.toString(),
      seatPriceDefault: "",
      currency: s.currency,
      billingDay: s.billingDay != null ? String(s.billingDay) : "",
      renewalDate: s.renewalDate ? s.renewalDate.toISOString().slice(0, 10) : "",
      prepaidUntil: s.prepaidUntil
        ? s.prepaidUntil.toISOString().slice(0, 10)
        : "",
      paymentMethodId: s.paymentMethodId ?? "",
      ownerId: s.ownerId,
      backupOwnerId: s.backupOwnerId ?? "",
      status: s.status,
      cancellationNoticeDays: String(s.cancellationNoticeDays),
      tags: s.tags.join(", "),
      notes: s.notes ?? "",
    };

    return {
      id: s.id,
      name: s.name,
      registrar: s.registrar,
      autoRenew: s.autoRenew,
      price: s.price.toNumber(),
      currency: s.currency,
      runRateBase: runRateBase.toNumber(),
      renewalDate: s.renewalDate?.toISOString() ?? null,
      prepaidUntil: s.prepaidUntil?.toISOString() ?? null,
      daysLeft: s.renewalDate
        ? Math.ceil((s.renewalDate.getTime() - today) / DAY_MS)
        : null,
      status: s.status,
      defaults,
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
          <h1 className="text-2xl font-semibold tracking-tight">Домены</h1>
          <p className="text-sm text-muted-foreground">
            Оплата раз в год в произвольную дату. Стоимость учитывается в общих
            расходах: {baseCurrency}/мес = цена ÷ 12.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <CsvImportDialog kind="domains" />}
          <Button asChild variant="outline">
            <a href="/api/export?kind=domains" download>
              <Download className="size-4" /> Экспорт CSV
            </a>
          </Button>
        </div>
      </div>

      {isAdmin && dgConfigured && <DomainGuardSync />}

      <DomainsTable
        rows={rows}
        options={options}
        canEdit={canEdit}
        baseCurrency={baseCurrency}
      />
    </div>
  );
}
