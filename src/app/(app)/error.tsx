"use client";

import * as React from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[app] Необработанная ошибка страницы:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <CardTitle>Что-то пошло не так</CardTitle>
          <CardDescription>
            Страницу не удалось загрузить. Попробуйте ещё раз — если ошибка
            повторяется, сообщите администратору.
            {error.digest && (
              <span className="mt-2 block font-mono text-xs">
                код: {error.digest}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={reset}>
            <RotateCw className="size-4" /> Повторить
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
