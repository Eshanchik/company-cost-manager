import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/authz";
import { serviceMonthlyRunRate } from "@/lib/calc/service-cost";
import { ServicesTable, type ServiceRow } from "./services-table";
import type { ServiceOptions } from "@/components/service-dialog";

function ownerLabel(u: { name: string | null; email: string | null }): string {
  return u.name ?? u.email ?? "—";
}

export default async function ServicesPage() {
  const user = await getCurrentUser();
  const canEdit = user ? hasRole(user.role, "manager") : false;

  const [services, categories, users, methods] = await Promise.all([
    prisma.service.findMany({
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
  ]);

  const rows: ServiceRow[] = services.map((s) => ({
    id: s.id,
    name: s.name,
    vendorUrl: s.vendorUrl,
    categoryId: s.categoryId,
    categoryName: s.category?.name ?? null,
    billingModel: s.billingModel,
    billingCycle: s.billingCycle,
    runRateMonthly: serviceMonthlyRunRate({
      billingModel: s.billingModel,
      billingCycle: s.billingCycle,
      price: s.price,
      seats: s.seats,
    }).toNumber(),
    currency: s.currency,
    seatsCount: s.seats.length,
    ownerId: s.ownerId,
    ownerLabel: ownerLabel(s.owner),
    paymentMethodId: s.paymentMethodId,
    paymentMethodName: s.paymentMethod?.name ?? null,
    nextPaymentDate: s.nextPaymentDate?.toISOString() ?? null,
    status: s.status,
  }));

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Сервисы</h1>
        <p className="text-sm text-muted-foreground">
          Подписки компании: стоимость, места, ответственные.
        </p>
      </div>
      <ServicesTable rows={rows} options={options} canEdit={canEdit} />
    </div>
  );
}
