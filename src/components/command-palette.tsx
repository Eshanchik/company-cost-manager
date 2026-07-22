"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  Users,
  FileBarChart,
  Settings,
  ScrollText,
  Plus,
} from "lucide-react";

import type { Role } from "@prisma/client";
import { hasRole } from "@/lib/roles";
import { ServiceFavicon } from "@/components/service-favicon";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type PaletteService = { id: string; name: string; vendorUrl: string | null };

export function CommandPalette({
  services,
  role,
}: {
  services: PaletteService[];
  role: Role;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const isManager = hasRole(role, "manager");
  const isAdmin = hasRole(role, "admin");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:flex"
      >
        Поиск
        <kbd className="rounded bg-muted px-1 font-mono">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Поиск сервисов и действия…" />
      <CommandList>
        <CommandEmpty>Ничего не найдено.</CommandEmpty>

        <CommandGroup heading="Быстрые действия">
          <CommandItem onSelect={() => go("/")}>
            <LayoutDashboard /> Дашборд
          </CommandItem>
          <CommandItem onSelect={() => go("/services")}>
            <Boxes /> Сервисы
          </CommandItem>
          <CommandItem onSelect={() => go("/employees")}>
            <Users /> Сотрудники
          </CommandItem>
          <CommandItem onSelect={() => go("/reports")}>
            <FileBarChart /> Отчёты
          </CommandItem>
          {isManager && (
            <CommandItem onSelect={() => go("/services")}>
              <Plus /> Новый сервис
            </CommandItem>
          )}
          {isAdmin && (
            <CommandItem onSelect={() => go("/audit")}>
              <ScrollText /> Аудит-лог
            </CommandItem>
          )}
          {isAdmin && (
            <CommandItem onSelect={() => go("/settings")}>
              <Settings /> Настройки
            </CommandItem>
          )}
        </CommandGroup>

        <CommandGroup heading="Сервисы">
          {services.map((s) => (
            <CommandItem
              key={s.id}
              value={`сервис ${s.name}`}
              onSelect={() => go(`/services/${s.id}`)}
            >
              <ServiceFavicon vendorUrl={s.vendorUrl} name={s.name} size={20} />
              {s.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      </CommandDialog>
    </>
  );
}
