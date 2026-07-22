import { getCurrentUser, hasRole } from "@/lib/authz";
import { getExpectedCharges } from "@/lib/plan/expected-charges";
import { ExpectedChargesFeed } from "@/components/expected-charges-feed";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const canEdit = user ? hasRole(user.role, "manager") : false;
  const { charges, baseCurrency } = await getExpectedCharges();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Дашборд</h1>
        <p className="text-sm text-muted-foreground">
          KPI, графики и блок «Требует внимания» появятся в Блоке 9.
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Ожидаемые списания</h2>
          <p className="text-sm text-muted-foreground">
            Подтвердите списание в один клик или пометьте «списания не было».
          </p>
        </div>
        <ExpectedChargesFeed
          charges={charges}
          baseCurrency={baseCurrency}
          canEdit={canEdit}
        />
      </section>
    </div>
  );
}
