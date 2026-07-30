import Link from "next/link";
import { Boxes, Upload, Users, Settings, Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Первый экран пустого инстанса: вместо нулевых KPI — что сделать сначала.
 */
export function OnboardingEmpty({ canEdit }: { canEdit: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Rocket className="size-5" />
          <CardTitle>Добро пожаловать в SubTrack</CardTitle>
        </div>
        <CardDescription>
          Пока нет ни одной подписки. Начните с любого шага — дашборд, отчёты и
          прогнозы заполнятся автоматически.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              1
            </span>
            <span>
              <strong>Заведите справочники</strong> — категории и способы оплаты
              в настройках (необязательно, но так отчёты нагляднее).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              2
            </span>
            <span>
              <strong>Добавьте сервисы</strong> — вручную или импортом CSV, если
              список уже ведётся в таблице.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              3
            </span>
            <span>
              <strong>Раздайте места сотрудникам</strong> — стоимость на человека
              посчитается сама.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              4
            </span>
            <span>
              <strong>Пригласите коллег</strong> — Настройки → Доступ. Вход
              только по приглашению через Google.
            </span>
          </li>
        </ol>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild>
            <Link href="/services">
              <Boxes className="size-4" />
              {canEdit ? "Добавить первый сервис" : "К сервисам"}
            </Link>
          </Button>
          {canEdit && (
            <Button asChild variant="outline">
              <Link href="/services">
                <Upload className="size-4" /> Импорт из CSV
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/employees">
              <Users className="size-4" /> Сотрудники
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/settings">
              <Settings className="size-4" /> Настройки
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
