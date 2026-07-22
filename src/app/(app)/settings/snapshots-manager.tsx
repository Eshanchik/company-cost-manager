"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { rebuildCurrentSnapshot } from "@/lib/actions/snapshots";

export function RebuildSnapshotButton() {
  const [pending, startTransition] = useTransition();

  const rebuild = () => {
    if (
      !confirm(
        "Пересобрать снапшот текущего месяца по актуальным данным? Действие записывается в аудит-лог."
      )
    )
      return;
    startTransition(async () => {
      const res = await rebuildCurrentSnapshot(null, new FormData());
      if (res.ok) toast.success(res.message ?? "Готово");
      else toast.error(res.error);
    });
  };

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={rebuild}>
      <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
      Пересобрать снапшот
    </Button>
  );
}
