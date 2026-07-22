import Link from "next/link";
import { Wallet } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { MainNav } from "@/components/main-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { CommandPalette } from "@/components/command-palette";
import type { SessionUser } from "@/lib/authz";

export async function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SessionUser;
}) {
  const services = await prisma.service.findMany({
    where: { status: { not: "archived" } },
    select: { id: true, name: true, vendorUrl: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Wallet className="size-5" />
          <Link href="/" className="text-base font-semibold">
            SubTrack
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <MainNav role={user.role} />
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div className="text-sm text-muted-foreground md:hidden">SubTrack</div>
          <CommandPalette services={services} role={user.role} />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
