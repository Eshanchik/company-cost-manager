"use client";

import * as React from "react";
import { useTransition } from "react";
import { Pencil, Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  ServiceDialog,
  type ServiceDefaults,
  type ServiceOptions,
} from "@/components/service-dialog";
import { setServiceArchived } from "@/lib/actions/services";

export function ServiceHeaderActions({
  service,
  options,
}: {
  service: ServiceDefaults;
  options: ServiceOptions;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = useTransition();
  const isArchived = service.status === "archived";

  const toggleArchive = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", service.id);
      fd.set("archived", (!isArchived).toString());
      const res = await setServiceArchived(null, fd);
      if (res.ok) toast.success(res.message ?? "Готово");
      else toast.error(res.error);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-4" /> Изменить
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={toggleArchive}
      >
        {isArchived ? (
          <>
            <ArchiveRestore className="size-4" /> Из архива
          </>
        ) : (
          <>
            <Archive className="size-4" /> В архив
          </>
        )}
      </Button>
      <ServiceDialog
        open={open}
        onOpenChange={setOpen}
        service={service}
        options={options}
      />
    </div>
  );
}
