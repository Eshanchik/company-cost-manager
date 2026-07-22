import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/authz";
import { serviceMonthlyRunRate } from "@/lib/calc/service-cost";
import { formatMoney, formatDate } from "@/lib/format";
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  BILLING_MODEL_LABEL,
  BILLING_CYCLE_LABEL,
} from "@/lib/service-display";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ServiceFavicon } from "@/components/service-favicon";
import type {
  ServiceDefaults,
  ServiceOptions,
} from "@/components/service-dialog";
import { AuditTable, type AuditRow } from "@/components/audit-table";
import { ServiceHeaderActions } from "./service-header-actions";
import { SeatsPanel, type SeatRow } from "./seats-panel";
import { AddPaymentButton } from "./add-payment";

const PAYMENT_SOURCE_LABEL: Record<string, string> = {
  manual: "Вручную",
  confirmed_expected: "Подтверждён",
  csv_import: "Импорт CSV",
};

function ownerLabel(u: { name: string | null; email: string | null }): string {
  return u.name ?? u.email ?? "—";
}

function toDefaults(s: {
  id: string;
  name: string;
  vendorUrl: string | null;
  categoryId: string | null;
  description: string | null;
  billingModel: ServiceDefaults["billingModel"];
  billingCycle: ServiceDefaults["billingCycle"];
  price: { toString(): string };
  seatPriceDefault: { toString(): string } | null;
  currency: string;
  billingDay: number | null;
  renewalDate: Date | null;
  paymentMethodId: string | null;
  ownerId: string;
  backupOwnerId: string | null;
  status: ServiceDefaults["status"];
  cancellationNoticeDays: number;
  tags: string[];
  notes: string | null;
}): ServiceDefaults {
  return {
    id: s.id,
    name: s.name,
    vendorUrl: s.vendorUrl ?? "",
    categoryId: s.categoryId ?? "",
    description: s.description ?? "",
    billingModel: s.billingModel,
    billingCycle: s.billingCycle,
    price: s.price.toString(),
    seatPriceDefault: s.seatPriceDefault ? s.seatPriceDefault.toString() : "",
    currency: s.currency,
    billingDay: s.billingDay != null ? String(s.billingDay) : "",
    renewalDate: s.renewalDate
      ? s.renewalDate.toISOString().slice(0, 10)
      : "",
    paymentMethodId: s.paymentMethodId ?? "",
    ownerId: s.ownerId,
    backupOwnerId: s.backupOwnerId ?? "",
    status: s.status,
    cancellationNoticeDays: String(s.cancellationNoticeDays),
    tags: s.tags.join(", "),
    notes: s.notes ?? "",
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const canEdit = user ? hasRole(user.role, "manager") : false;

  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      category: true,
      owner: true,
      backupOwner: true,
      paymentMethod: true,
      seats: { include: { employee: true }, orderBy: { startedAt: "desc" } },
      payments: { orderBy: { paidAt: "desc" } },
    },
  });
  if (!service) notFound();

  const [categories, users, methods, employees, settings] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.paymentMethod.findMany({ orderBy: { name: "asc" } }),
    prisma.employee.findMany({
      where: { status: "active" },
      orderBy: { fullName: "asc" },
    }),
    prisma.setting.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    }),
  ]);
  const baseCurrency = settings.baseCurrency;

  const auditLogs = await prisma.auditLog.findMany({
    where: { entity: "Service", entityId: service.id },
    orderBy: { ts: "desc" },
    take: 100,
  });
  const historyRows: AuditRow[] = auditLogs.map((l) => ({
    id: l.id,
    ts: l.ts.toISOString(),
    entity: l.entity,
    entityId: l.entityId,
    actor: l.actor,
    action: l.action,
    diff: l.diff,
  }));

  const activeSeats = service.seats.filter((s) => !s.endedAt);
  const runRate = serviceMonthlyRunRate({
    billingModel: service.billingModel,
    billingCycle: service.billingCycle,
    price: service.price,
    seats: activeSeats,
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

  const seatRows: SeatRow[] = service.seats.map((s) => ({
    id: s.id,
    employeeId: s.employeeId,
    employeeName: s.employee.fullName,
    employeeEmail: s.employee.email,
    seatPrice: s.seatPrice.toNumber(),
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/services"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> К списку сервисов
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <ServiceFavicon
            vendorUrl={service.vendorUrl}
            name={service.name}
            size={40}
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {service.name}
              </h1>
              <Badge variant={STATUS_VARIANT[service.status]}>
                {STATUS_LABEL[service.status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {BILLING_MODEL_LABEL[service.billingModel]} ·{" "}
              {BILLING_CYCLE_LABEL[service.billingCycle]} · {service.currency}
            </p>
          </div>
        </div>
        {canEdit && (
          <ServiceHeaderActions service={toDefaults(service)} options={options} />
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="seats">
            Места ({activeSeats.length})
          </TabsTrigger>
          <TabsTrigger value="payments">
            Платежи ({service.payments.length})
          </TabsTrigger>
          <TabsTrigger value="history">История</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="grid gap-x-8 gap-y-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
              <Fact label="Стоимость/мес (норм.)">
                <span className="text-lg font-semibold">
                  {formatMoney(runRate, service.currency)}
                </span>
              </Fact>
              <Fact label="Категория">
                {service.category?.name ?? "—"}
              </Fact>
              <Fact label="Ответственный">
                {ownerLabel(service.owner)}
              </Fact>
              <Fact label="Резервный ответственный">
                {service.backupOwner ? ownerLabel(service.backupOwner) : "—"}
              </Fact>
              <Fact label="Способ оплаты">
                {service.paymentMethod?.name ?? "—"}
              </Fact>
              <Fact label="Следующая оплата">
                {formatDate(service.nextPaymentDate)}
              </Fact>
              {service.billingModel !== "per_seat" && (
                <Fact label="Фикс. цена (за цикл)">
                  {formatMoney(service.price, service.currency)}
                </Fact>
              )}
              {service.billingModel !== "fixed" && (
                <Fact label="Цена места по умолч.">
                  {service.seatPriceDefault
                    ? formatMoney(service.seatPriceDefault, service.currency)
                    : "—"}
                </Fact>
              )}
              {service.billingCycle === "monthly" ? (
                <Fact label="День списания">
                  {service.billingDay ?? "—"}
                </Fact>
              ) : (
                <Fact label="Дата продления">
                  {formatDate(service.renewalDate)}
                </Fact>
              )}
              {service.billingCycle === "yearly" && (
                <Fact label="Уведомление об отмене">
                  {service.cancellationNoticeDays} дн.
                </Fact>
              )}
              {service.tags.length > 0 && (
                <Fact label="Теги">
                  <div className="flex flex-wrap gap-1">
                    {service.tags.map((t) => (
                      <Badge key={t} variant="secondary">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </Fact>
              )}
              {service.description && (
                <Fact label="Описание" className="sm:col-span-2 lg:col-span-3">
                  {service.description}
                </Fact>
              )}
              {service.notes && (
                <Fact label="Заметки" className="sm:col-span-2 lg:col-span-3">
                  {service.notes}
                </Fact>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seats">
          <Card>
            <CardContent className="pt-6">
              <SeatsPanel
                serviceId={service.id}
                hasSeats={service.billingModel !== "fixed"}
                seatPriceDefault={
                  service.seatPriceDefault
                    ? service.seatPriceDefault.toString()
                    : null
                }
                currency={service.currency}
                seats={seatRows}
                employees={employees.map((e) => ({
                  email: e.email,
                  fullName: e.fullName,
                }))}
                canEdit={canEdit}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">
                  Платежи ({service.payments.length})
                </h3>
                {canEdit && (
                  <AddPaymentButton
                    serviceId={service.id}
                    currency={service.currency}
                    today={new Date().toISOString().slice(0, 10)}
                  />
                )}
              </div>
              {service.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Платежей пока нет.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead className="text-right">Сумма</TableHead>
                        <TableHead className="text-right">В базовой</TableHead>
                        <TableHead>Источник</TableHead>
                        <TableHead>Комментарий</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {service.payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{formatDate(p.paidAt)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(p.amount, p.currency)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {formatMoney(p.amountBase, baseCurrency)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {PAYMENT_SOURCE_LABEL[p.source] ?? p.source}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {p.comment ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="pt-6">
              <AuditTable rows={historyRows} showEntity={false} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Fact({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
