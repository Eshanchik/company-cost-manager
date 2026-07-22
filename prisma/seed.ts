import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const D = (n: number | string) => new Prisma.Decimal(n);

// Курсы к базовой USD для демо-данных (фиксированные, вставляются в FxRate).
const FX: Record<string, number> = { USD: 1, EUR: 1.08, GBP: 1.27 };

function clampDay(year: number, monthIndex0: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex0, Math.min(day, lastDay)));
}

async function main() {
  // ── Настройки инстанса ────────────────────────────────────────────────────
  await prisma.setting.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      baseCurrency: process.env.BASE_CURRENCY ?? "USD",
      confirmationOverdueDays: 5,
    },
  });

  // ── Пользователи-владельцы + whitelist ─────────────────────────────────────
  const adminEmails = (process.env.ADMIN_EMAILS ?? "admin@example.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const adminEmail = adminEmails[0] ?? "admin@example.com";

  const owners = [
    { id: "user_admin", email: adminEmail, name: "Администратор", role: "admin" as const },
    { id: "user_ivan", email: "ivan.petrov@example.com", name: "Иван Петров", role: "manager" as const },
    { id: "user_olga", email: "olga.kravets@example.com", name: "Ольга Кравец", role: "manager" as const },
  ];
  for (const o of owners) {
    await prisma.user.upsert({
      where: { id: o.id },
      update: { email: o.email, name: o.name, role: o.role },
      create: { id: o.id, email: o.email, name: o.name, role: o.role },
    });
    await prisma.allowedEmail.upsert({
      where: { email: o.email },
      update: { role: o.role },
      create: { email: o.email, role: o.role, addedBy: "seed" },
    });
  }
  // Остальные admin-email'ы из env — в whitelist.
  for (const email of adminEmails.slice(1)) {
    await prisma.allowedEmail.upsert({
      where: { email },
      update: { role: "admin" },
      create: { email, role: "admin", addedBy: "seed" },
    });
  }

  // ── Категории ──────────────────────────────────────────────────────────────
  const categories = [
    { id: "cat_dev", name: "Dev tools", color: "#3b82f6" },
    { id: "cat_design", name: "Design", color: "#a855f7" },
    { id: "cat_marketing", name: "Marketing", color: "#f59e0b" },
    { id: "cat_infra", name: "Infra", color: "#10b981" },
    { id: "cat_ai", name: "AI", color: "#ec4899" },
    { id: "cat_office", name: "Office", color: "#64748b" },
  ];
  for (const c of categories) {
    await prisma.category.upsert({
      where: { id: c.id },
      update: { name: c.name, color: c.color },
      create: c,
    });
  }

  // ── Способы оплаты ─────────────────────────────────────────────────────────
  const methods = [
    { id: "pm_card", name: "Карта ****1234 (Иван)", note: "Основная корп. карта" },
    { id: "pm_fop", name: "Счёт ФОП", note: "Оплата по счёту" },
    { id: "pm_paypal", name: "PayPal team@company.com", note: null as string | null },
  ];
  for (const m of methods) {
    await prisma.paymentMethod.upsert({
      where: { id: m.id },
      update: { name: m.name, note: m.note },
      create: m,
    });
  }

  // ── Сотрудники ─────────────────────────────────────────────────────────────
  const employees = [
    { id: "emp_01", email: "a.sokolov@company.com", fullName: "Алексей Соколов", department: "Engineering" },
    { id: "emp_02", email: "m.volkova@company.com", fullName: "Мария Волкова", department: "Design" },
    { id: "emp_03", email: "d.morozov@company.com", fullName: "Дмитрий Морозов", department: "Engineering" },
    { id: "emp_04", email: "e.novak@company.com", fullName: "Елена Новак", department: "Marketing" },
    { id: "emp_05", email: "s.orlov@company.com", fullName: "Сергей Орлов", department: "Engineering" },
    { id: "emp_06", email: "n.belova@company.com", fullName: "Наталья Белова", department: "Design" },
    { id: "emp_07", email: "p.kozlov@company.com", fullName: "Павел Козлов", department: "Ops" },
    { id: "emp_08", email: "i.smirnova@company.com", fullName: "Ирина Смирнова", department: "Sales" },
    { id: "emp_09", email: "r.gordon@company.com", fullName: "Роман Гордон", department: "Engineering" },
    { id: "emp_10", email: "t.lebedeva@company.com", fullName: "Татьяна Лебедева", department: "Marketing" },
    { id: "emp_11", email: "k.zaytsev@company.com", fullName: "Кирилл Зайцев", department: "Engineering" },
    { id: "emp_12", email: "a.melnik@company.com", fullName: "Анна Мельник", department: "Ops" },
    { id: "emp_13", email: "v.popov@company.com", fullName: "Виктор Попов", department: "Sales" },
    { id: "emp_14", email: "y.frolova@company.com", fullName: "Юлия Фролова", department: "Design" },
    { id: "emp_15", email: "g.tkachenko@company.com", fullName: "Глеб Ткаченко", department: "Engineering" },
  ];
  for (const e of employees) {
    await prisma.employee.upsert({
      where: { id: e.id },
      update: { email: e.email, fullName: e.fullName, department: e.department },
      create: e,
    });
  }

  // ── Сервисы ────────────────────────────────────────────────────────────────
  type Svc = {
    id: string;
    name: string;
    vendorUrl: string;
    categoryId: string;
    billingModel: "fixed" | "per_seat" | "hybrid";
    billingCycle: "monthly" | "yearly";
    price: number;
    seatPriceDefault: number | null;
    currency: string;
    billingDay: number | null;
    renewalMonth0: number | null; // месяц продления для yearly (0–11)
    renewalDay: number | null;
    paymentMethodId: string;
    ownerId: string;
    seatCount: number;
  };

  const now = new Date();
  const year = now.getUTCFullYear();

  const services: Svc[] = [
    { id: "svc_figma", name: "Figma", vendorUrl: "https://figma.com", categoryId: "cat_design", billingModel: "per_seat", billingCycle: "monthly", price: 0, seatPriceDefault: 15, currency: "USD", billingDay: 5, renewalMonth0: null, renewalDay: null, paymentMethodId: "pm_card", ownerId: "user_olga", seatCount: 4 },
    { id: "svc_adobe", name: "Adobe Creative Cloud", vendorUrl: "https://adobe.com", categoryId: "cat_design", billingModel: "per_seat", billingCycle: "yearly", price: 0, seatPriceDefault: 660, currency: "USD", billingDay: null, renewalMonth0: 8, renewalDay: 15, paymentMethodId: "pm_fop", ownerId: "user_olga", seatCount: 2 },
    { id: "svc_github", name: "GitHub Team", vendorUrl: "https://github.com", categoryId: "cat_dev", billingModel: "per_seat", billingCycle: "monthly", price: 0, seatPriceDefault: 4, currency: "USD", billingDay: 1, renewalMonth0: null, renewalDay: null, paymentMethodId: "pm_card", ownerId: "user_ivan", seatCount: 5 },
    { id: "svc_slack", name: "Slack", vendorUrl: "https://slack.com", categoryId: "cat_office", billingModel: "per_seat", billingCycle: "monthly", price: 0, seatPriceDefault: 8.75, currency: "USD", billingDay: 12, renewalMonth0: null, renewalDay: null, paymentMethodId: "pm_card", ownerId: "user_ivan", seatCount: 3 },
    { id: "svc_notion", name: "Notion", vendorUrl: "https://notion.so", categoryId: "cat_office", billingModel: "per_seat", billingCycle: "monthly", price: 0, seatPriceDefault: 8, currency: "EUR", billingDay: 20, renewalMonth0: null, renewalDay: null, paymentMethodId: "pm_paypal", ownerId: "user_ivan", seatCount: 2 },
    { id: "svc_vercel", name: "Vercel", vendorUrl: "https://vercel.com", categoryId: "cat_infra", billingModel: "hybrid", billingCycle: "monthly", price: 20, seatPriceDefault: 20, currency: "USD", billingDay: 3, renewalMonth0: null, renewalDay: null, paymentMethodId: "pm_card", ownerId: "user_admin", seatCount: 2 },
    { id: "svc_aws", name: "Amazon Web Services", vendorUrl: "https://aws.amazon.com", categoryId: "cat_infra", billingModel: "fixed", billingCycle: "monthly", price: 1200, seatPriceDefault: null, currency: "USD", billingDay: 3, renewalMonth0: null, renewalDay: null, paymentMethodId: "pm_fop", ownerId: "user_admin", seatCount: 0 },
    { id: "svc_openai", name: "OpenAI Team", vendorUrl: "https://openai.com", categoryId: "cat_ai", billingModel: "per_seat", billingCycle: "monthly", price: 0, seatPriceDefault: 30, currency: "USD", billingDay: 8, renewalMonth0: null, renewalDay: null, paymentMethodId: "pm_card", ownerId: "user_ivan", seatCount: 3 },
    { id: "svc_linear", name: "Linear", vendorUrl: "https://linear.app", categoryId: "cat_dev", billingModel: "per_seat", billingCycle: "monthly", price: 0, seatPriceDefault: 8, currency: "USD", billingDay: 10, renewalMonth0: null, renewalDay: null, paymentMethodId: "pm_card", ownerId: "user_ivan", seatCount: 3 },
    { id: "svc_gworkspace", name: "Google Workspace", vendorUrl: "https://workspace.google.com", categoryId: "cat_office", billingModel: "per_seat", billingCycle: "monthly", price: 0, seatPriceDefault: 10.4, currency: "EUR", billingDay: 1, renewalMonth0: null, renewalDay: null, paymentMethodId: "pm_fop", ownerId: "user_admin", seatCount: 4 },
    { id: "svc_ahrefs", name: "Ahrefs", vendorUrl: "https://ahrefs.com", categoryId: "cat_marketing", billingModel: "fixed", billingCycle: "yearly", price: 1990, seatPriceDefault: null, currency: "USD", billingDay: null, renewalMonth0: 10, renewalDay: 20, paymentMethodId: "pm_card", ownerId: "user_olga", seatCount: 0 },
    { id: "svc_sentry", name: "Sentry", vendorUrl: "https://sentry.io", categoryId: "cat_infra", billingModel: "hybrid", billingCycle: "monthly", price: 26, seatPriceDefault: 15, currency: "GBP", billingDay: 15, renewalMonth0: null, renewalDay: null, paymentMethodId: "pm_card", ownerId: "user_admin", seatCount: 2 },
  ];

  for (const s of services) {
    const renewalDate =
      s.renewalMonth0 !== null && s.renewalDay !== null
        ? clampDay(year, s.renewalMonth0, s.renewalDay)
        : null;
    // Ближайшая оплата (грубая оценка для демо).
    let nextPaymentDate: Date | null = null;
    if (s.billingCycle === "monthly" && s.billingDay !== null) {
      const thisMonth = clampDay(now.getUTCFullYear(), now.getUTCMonth(), s.billingDay);
      nextPaymentDate =
        thisMonth >= now
          ? thisMonth
          : clampDay(now.getUTCFullYear(), now.getUTCMonth() + 1, s.billingDay);
    } else if (renewalDate) {
      nextPaymentDate = renewalDate >= now ? renewalDate : clampDay(year + 1, s.renewalMonth0!, s.renewalDay!);
    }

    const data = {
      name: s.name,
      vendorUrl: s.vendorUrl,
      categoryId: s.categoryId,
      billingModel: s.billingModel,
      billingCycle: s.billingCycle,
      price: D(s.price),
      seatPriceDefault: s.seatPriceDefault === null ? null : D(s.seatPriceDefault),
      currency: s.currency,
      billingDay: s.billingDay,
      renewalDate,
      nextPaymentDate,
      paymentMethodId: s.paymentMethodId,
      ownerId: s.ownerId,
      status: "active" as const,
      cancellationNoticeDays: s.billingCycle === "yearly" ? 30 : 30,
    };
    await prisma.service.upsert({
      where: { id: s.id },
      update: data,
      create: { id: s.id, ...data },
    });
  }

  // ── Места ────────────────────────────────────────────────────────────────
  // Раскидываем сотрудников по сервисам циклически; для Figma первое место —
  // с переопределённой ценой (демо override).
  let empCursor = 0;
  for (const s of services) {
    if (s.seatCount <= 0) continue;
    for (let i = 0; i < s.seatCount; i++) {
      const emp = employees[empCursor % employees.length]!;
      empCursor++;
      const override = s.id === "svc_figma" && i === 0 ? 20 : null;
      const seatPrice = D(override ?? s.seatPriceDefault ?? s.price);
      const seatId = `seat_${s.id}_${i}`;
      await prisma.seat.upsert({
        where: { id: seatId },
        update: { seatPrice, employeeId: emp.id, serviceId: s.id, endedAt: null },
        create: { id: seatId, serviceId: s.id, employeeId: emp.id, seatPrice },
      });
    }
  }

  // ── Курсы валют (FxRate) ────────────────────────────────────────────────────
  // 1-е число каждого из последних 6 месяцев + сегодня, EUR/GBP → USD.
  for (let back = 6; back >= 0; back--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    for (const from of ["EUR", "GBP"]) {
      await prisma.fxRate.upsert({
        where: { date_from_to: { date: d, from, to: "USD" } },
        update: { rate: D(FX[from]!) },
        create: { date: d, from, to: "USD", rate: D(FX[from]!) },
      });
    }
  }

  // ── Платежи за 3 прошедших месяца (только monthly-сервисы) ──────────────────
  const monthlyServiceCost = (s: Svc): number => {
    const seatsTotal = (s.seatPriceDefault ?? 0) * s.seatCount;
    if (s.billingModel === "fixed") return s.price;
    if (s.billingModel === "per_seat") return seatsTotal;
    return s.price + seatsTotal; // hybrid
  };

  for (const s of services) {
    if (s.billingCycle !== "monthly" || s.billingDay === null) continue;
    const amount = monthlyServiceCost(s);
    if (amount <= 0) continue;
    for (let back = 3; back >= 1; back--) {
      const m = now.getUTCMonth() - back;
      const paidAt = clampDay(now.getUTCFullYear(), m, s.billingDay);
      const rate = FX[s.currency] ?? 1;
      const amountBase = amount * rate;
      const payId = `pay_${s.id}_${back}`;
      const payData = {
        serviceId: s.id,
        paidAt,
        amount: D(amount),
        currency: s.currency,
        amountBase: D(amountBase.toFixed(6)),
        source: "confirmed_expected" as const,
        comment: null,
      };
      await prisma.payment.upsert({
        where: { id: payId },
        update: payData,
        create: { id: payId, ...payData },
      });
    }
  }

  console.log("✓ Сид завершён:");
  console.log(`  ${categories.length} категорий, ${methods.length} способов оплаты`);
  console.log(`  ${owners.length} пользователей, ${employees.length} сотрудников`);
  console.log(`  ${services.length} сервисов, места и платежи за 3 месяца`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
