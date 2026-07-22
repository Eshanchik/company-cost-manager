import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Дашборд</h1>
        <p className="text-sm text-muted-foreground">
          Обзор расходов на подписки появится на следующих этапах.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Run-rate / мес</CardTitle>
            <CardDescription>Нормализованная стоимость</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold text-muted-foreground">
              —
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Факт vs план</CardTitle>
            <CardDescription>Текущий месяц</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold text-muted-foreground">
              —
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Прогноз</CardTitle>
            <CardDescription>До конца месяца</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold text-muted-foreground">
              —
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Активные</CardTitle>
            <CardDescription>Сервисы / места</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold text-muted-foreground">
              —
            </span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
