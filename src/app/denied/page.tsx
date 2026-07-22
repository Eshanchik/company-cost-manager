import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const message =
    error === "AccessDenied"
      ? "Ваш email не в белом списке этого инстанса. Обратитесь к администратору, чтобы вас добавили."
      : "Вход не удался. Проверьте настройки Google OAuth или попробуйте ещё раз.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="size-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">Доступ запрещён</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild variant="outline">
            <Link href="/login">Вернуться ко входу</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
