import { ShieldAlert } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/authz";
import { getSettings } from "@/lib/actions/settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CategoriesManager } from "./categories-manager";
import { PaymentMethodsManager } from "./payment-methods-manager";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const isAdmin = user ? hasRole(user.role, "admin") : false;

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-destructive" />
              <CardTitle>Раздел только для администраторов</CardTitle>
            </div>
            <CardDescription>
              Справочники и параметры инстанса доступны только роли
              «Администратор».
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const [categories, methods, settings] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.paymentMethod.findMany({
      orderBy: [{ isArchived: "asc" }, { name: "asc" }],
    }),
    getSettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
        <p className="text-sm text-muted-foreground">
          Справочники и параметры инстанса.
        </p>
      </div>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Категории</TabsTrigger>
          <TabsTrigger value="methods">Способы оплаты</TabsTrigger>
          <TabsTrigger value="params">Параметры</TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <Card>
            <CardContent className="pt-6">
              <CategoriesManager categories={categories} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="methods">
          <Card>
            <CardContent className="pt-6">
              <PaymentMethodsManager methods={methods} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="params">
          <Card>
            <CardHeader>
              <CardTitle>Параметры инстанса</CardTitle>
              <CardDescription>
                Базовая валюта и срок подтверждения списаний.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsForm settings={settings} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
