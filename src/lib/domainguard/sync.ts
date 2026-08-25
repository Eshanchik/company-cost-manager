import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import {
  readDgConfig,
  fetchAllDomains,
  DomainGuardError,
} from "@/lib/domainguard/client";
import { mapDgDomain, filterByProjects, DG_SOURCE } from "@/lib/domainguard/map";

export type SyncResult =
  | {
      ok: true;
      dryRun: boolean;
      fetched: number;
      matched: number;
      created: number;
      updated: number;
      adopted: number;
      withoutPrice: number;
      errors: string[];
    }
  | { ok: false; error: string };

const CATEGORY_NAME = "Домены";

/**
 * Синхронизация доменов из DomainGuard в SubTrack.
 *
 * Идемпотентна: связь по (externalSource, externalId). Домен, заведённый ранее
 * руками/из CSV с тем же именем, «усыновляется» (получает externalId), а не
 * дублируется.
 *
 * Что синхронизируется: имя, дата продления, валюта, авто-продление, статус.
 * Цена — только если реестр её знает: пустую цену в реестре не переносим, чтобы
 * не затереть введённую вручную.
 */
export async function syncDomainGuard(
  opts: { dryRun?: boolean; actor?: string } = {}
): Promise<SyncResult> {
  const dryRun = opts.dryRun ?? false;
  const cfg = readDgConfig();
  if (!cfg) {
    return {
      ok: false,
      error:
        "DomainGuard не настроен: нужны DOMAINGUARD_URL и DOMAINGUARD_TOKEN в .env",
    };
  }

  let all;
  try {
    all = await fetchAllDomains(cfg);
  } catch (e) {
    const msg =
      e instanceof DomainGuardError
        ? e.message
        : e instanceof Error
          ? e.message
          : "неизвестная ошибка";
    return { ok: false, error: `Не удалось получить домены: ${msg}` };
  }

  const selected = filterByProjects(all, cfg.projectIds);
  const now = new Date();
  const mapped = selected.map((d) => mapDgDomain(d, now));

  // Ответственный: из env или первый администратор.
  const ownerEmail = process.env.DOMAINGUARD_OWNER_EMAIL?.toLowerCase();
  const owner = ownerEmail
    ? await prisma.user.findFirst({
        where: { email: { equals: ownerEmail, mode: "insensitive" } },
      })
    : ((await prisma.user.findFirst({ where: { role: "admin" } })) ??
      (await prisma.user.findFirst()));
  if (!owner) {
    return { ok: false, error: "Не найден пользователь-ответственный" };
  }

  const errors: string[] = [];
  let created = 0;
  let updated = 0;
  let adopted = 0;
  const withoutPrice = mapped.filter((m) => m.price === null).length;

  if (dryRun) {
    const existing = await prisma.service.findMany({
      where: { kind: "domain" },
      select: { externalId: true, name: true },
    });
    const byExt = new Set(
      existing.filter((e) => e.externalId).map((e) => e.externalId!)
    );
    const byName = new Set(existing.map((e) => e.name));
    for (const m of mapped) {
      if (byExt.has(m.externalId)) updated++;
      else if (byName.has(m.name)) adopted++;
      else created++;
    }
    return {
      ok: true,
      dryRun: true,
      fetched: all.length,
      matched: mapped.length,
      created,
      updated,
      adopted,
      withoutPrice,
      errors,
    };
  }

  // Категория «Домены» — чтобы срезы отчёта были осмысленными.
  const category =
    (await prisma.category.findFirst({ where: { name: CATEGORY_NAME } })) ??
    (await prisma.category.create({
      data: { name: CATEGORY_NAME, color: "#0ea5e9" },
    }));

  for (const m of mapped) {
    try {
      const existing =
        (await prisma.service.findFirst({
          where: { externalSource: DG_SOURCE, externalId: m.externalId },
        })) ??
        (await prisma.service.findFirst({
          where: { kind: "domain", name: m.name },
        }));

      const common = {
        name: m.name,
        renewalDate: m.renewalDate,
        nextPaymentDate: m.nextPaymentDate,
        currency: m.currency,
        autoRenew: m.autoRenew,
        status: m.status,
      };

      if (!existing) {
        await prisma.service.create({
          data: {
            ...common,
            kind: "domain",
            billingModel: "fixed",
            billingCycle: "yearly",
            // Цена неизвестна → 0; в UI помечается «цена не указана».
            price: m.price ?? new Prisma.Decimal(0),
            categoryId: category.id,
            ownerId: owner.id,
            externalSource: DG_SOURCE,
            externalId: m.externalId,
          },
        });
        created++;
      } else {
        const wasAdopted = existing.externalId !== m.externalId;
        await prisma.service.update({
          where: { id: existing.id },
          data: {
            ...common,
            // Пустую цену реестра не переносим — ручной ввод сохраняется.
            ...(m.price !== null ? { price: m.price } : {}),
            externalSource: DG_SOURCE,
            externalId: m.externalId,
          },
        });
        if (wasAdopted) adopted++;
        else updated++;
      }
    } catch (e) {
      console.error("[domainguard] sync", m.name, e);
      errors.push(`${m.name}: ошибка записи`);
    }
  }

  await writeAudit({
    entity: "Service",
    entityId: "domainguard-sync",
    actor: opts.actor ?? "system:domainguard",
    action: "sync",
    diff: {
      projects: cfg.projectIds.join(",") || "all",
      fetched: all.length,
      matched: mapped.length,
      created,
      updated,
      adopted,
      without_price: withoutPrice,
      errors: errors.length,
    },
  });

  return {
    ok: true,
    dryRun: false,
    fetched: all.length,
    matched: mapped.length,
    created,
    updated,
    adopted,
    withoutPrice,
    errors,
  };
}
