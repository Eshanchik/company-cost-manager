"use client";

import { RefreshCw } from "lucide-react";

import { ConfirmAction } from "@/components/confirm-action";
import { rebuildCurrentSnapshot } from "@/lib/actions/snapshots";

export function RebuildSnapshotButton() {
  return (
    <ConfirmAction
      title="Пересобрать снапшот текущего месяца?"
      description="План будет пересчитан по актуальным данным. Действие записывается в аудит-лог."
      confirmLabel="Пересобрать"
      variant="outline"
      size="sm"
      onConfirm={() => rebuildCurrentSnapshot(null, new FormData())}
    >
      <RefreshCw className="size-4" />
      Пересобрать снапшот
    </ConfirmAction>
  );
}
