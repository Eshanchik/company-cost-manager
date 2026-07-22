import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/authz";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuditTable, type AuditRow } from "@/components/audit-table";
import { entityLabel } from "@/lib/audit-display";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    entity?: string;
    action?: string;
    actor?: string;
    page?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user || !hasRole(user.role, "admin")) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Аудит-лог</h1>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-destructive" />
              <CardTitle>Только для администраторов</CardTitle>
            </div>
            <CardDescription>
              Журнал изменений доступен роли «Администратор».
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const where: Prisma.AuditLogWhereInput = {};
  if (sp.entity) where.entity = sp.entity;
  if (sp.action) where.action = sp.action;
  if (sp.actor) where.actor = { contains: sp.actor, mode: "insensitive" };

  const [entities, total, logs] = await Promise.all([
    prisma.auditLog.findMany({ distinct: ["entity"], select: { entity: true } }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { ts: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const rows: AuditRow[] = logs.map((l) => ({
    id: l.id,
    ts: l.ts.toISOString(),
    entity: l.entity,
    entityId: l.entityId,
    actor: l.actor,
    action: l.action,
    diff: l.diff,
  }));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (sp.entity) params.set("entity", sp.entity);
    if (sp.action) params.set("action", sp.action);
    if (sp.actor) params.set("actor", sp.actor);
    params.set("page", String(p));
    return `/audit?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Аудит-лог</h1>
        <p className="text-sm text-muted-foreground">
          Все изменения сущностей: кто, что, когда (old → new). Всего записей:{" "}
          {total}.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3" action="/audit">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Сущность</label>
          <NativeSelect name="entity" defaultValue={sp.entity ?? ""} className="w-48">
            <option value="">Все</option>
            {entities.map((e) => (
              <option key={e.entity} value={e.entity}>
                {entityLabel(e.entity)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Действие</label>
          <Input name="action" defaultValue={sp.action ?? ""} className="w-40" placeholder="напр. update" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Автор</label>
          <Input name="actor" defaultValue={sp.actor ?? ""} className="w-52" placeholder="email или токен" />
        </div>
        <Button type="submit" variant="outline">
          Фильтровать
        </Button>
        {(sp.entity || sp.action || sp.actor) && (
          <Button asChild variant="ghost">
            <Link href="/audit">Сбросить</Link>
          </Button>
        )}
      </form>

      <AuditTable rows={rows} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Стр. {page} из {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={page <= 1}
            >
              <Link href={qs(Math.max(1, page - 1))}>Назад</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
            >
              <Link href={qs(Math.min(totalPages, page + 1))}>Вперёд</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
