import { prisma } from "@/lib/prisma";

export type ExpectedCharge = {
  id: string;
  serviceId: string;
  serviceName: string;
  vendorUrl: string | null;
  expectedDate: string; // ISO
  expectedAmount: number;
  currency: string;
  amountBase: number;
  overdue: boolean;
};

/**
 * Ожидаемые (не подтверждённые и не waived) строки плана — лента §4.3.
 * Просрочка: expectedDate + overdueDays < asOf (§4.3).
 */
export async function getExpectedCharges(
  asOf: Date = new Date()
): Promise<{ charges: ExpectedCharge[]; baseCurrency: string }> {
  const settings = await prisma.setting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  const overdueDays = settings.confirmationOverdueDays;

  const lines = await prisma.planLine.findMany({
    where: { status: "expected" },
    include: { service: { select: { name: true, vendorUrl: true } } },
    orderBy: { expectedDate: "asc" },
  });

  const asOfDay = Date.UTC(
    asOf.getUTCFullYear(),
    asOf.getUTCMonth(),
    asOf.getUTCDate()
  );

  const charges: ExpectedCharge[] = lines.map((l) => {
    const overdueThreshold =
      l.expectedDate.getTime() + overdueDays * 24 * 60 * 60 * 1000;
    return {
      id: l.id,
      serviceId: l.serviceId,
      serviceName: l.service.name,
      vendorUrl: l.service.vendorUrl,
      expectedDate: l.expectedDate.toISOString(),
      expectedAmount: l.expectedAmount.toNumber(),
      currency: l.currency,
      amountBase: l.amountBase.toNumber(),
      overdue: overdueThreshold < asOfDay,
    };
  });

  return { charges, baseCurrency: settings.baseCurrency };
}
