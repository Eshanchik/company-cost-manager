"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu, Wallet, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import type { Role } from "@prisma/client";
import { MainNav } from "@/components/main-nav";
import { Button } from "@/components/ui/button";

/** Навигация для мобильных: бургер + выезжающая панель слева. */
export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // Закрываем панель при переходе на другой маршрут.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Открыть меню"
        >
          <Menu className="size-5" />
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 md:hidden" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-card shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left md:hidden"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            Меню навигации
          </DialogPrimitive.Title>
          <div className="flex h-14 items-center justify-between border-b px-4">
            <span className="flex items-center gap-2 font-semibold">
              <Wallet className="size-5" />
              SubTrack
            </span>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Закрыть меню">
                <X className="size-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <MainNav role={role} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
