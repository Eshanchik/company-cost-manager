import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/authz";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Защита на уровне сервера (в дополнение к middleware).
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <AppShell user={user}>{children}</AppShell>;
}
