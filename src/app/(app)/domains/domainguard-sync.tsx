"use client";

import * as React from "react";
import { useTransition } from "react";
import { RefreshCw, Eye } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  previewDomainGuardSync,
  runDomainGuardSync,
} from "@/lib/actions/domainguard";
import type { SyncResult } from "@/lib/domainguard/sync";

/** Кнопки синхронизации с реестром DomainGuard (только Admin). */
export function DomainGuardSync() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = React.useState<SyncResult | null>(null);

  const run = (fn: () => Promise<SyncResult>, label: string) =>
    startTransition(async () => {
      const res = await fn();
      setResult(res);
      if (!res.ok) toast.error(res.error);
      else
        toast.success(
          `${label}: создано ${res.created}, обновлено ${res.updated}` +
            (res.adopted ? `, связано ${res.adopted}` : "")
        );
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => run(previewDomainGuardSync, "Предпросмотр")}
        >
          <Eye className="size-4" /> Проверить (без записи)
        </Button>
        <Button
          disabled={pending}
          onClick={() => run(runDomainGuardSync, "Синхронизация")}
        >
          <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
          Синхронизировать с DomainGuard
        </Button>
      </div>

      {result?.ok && (
        <div className="rounded-md border bg-muted/30 p-3 text-xs">
          <p className="font-medium">
            {result.dryRun ? "Предпросмотр (ничего не записано)" : "Готово"}
          </p>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            <li>
              в реестре всего: {result.fetched}, подходит по проектам:{" "}
              <strong>{result.matched}</strong>
            </li>
            <li>
              создано: {result.created} · обновлено: {result.updated} · связано с
              существующими: {result.adopted}
            </li>
            {result.withoutPrice > 0 && (
              <li className="text-amber-600">
                без цены в реестре: {result.withoutPrice} — стоимость этих
                доменов не учитывается, заполните вручную
              </li>
            )}
            {result.errors.length > 0 && (
              <li className="text-destructive">
                ошибок: {result.errors.length} ({result.errors.slice(0, 3).join("; ")})
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
