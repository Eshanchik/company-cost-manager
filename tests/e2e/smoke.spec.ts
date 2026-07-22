import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@example.com";

// Вход через тестовый Credentials-провайдер (E2E_TEST_AUTH=1).
async function login(page: Page) {
  const csrf = await page.request
    .get("/api/auth/csrf")
    .then((r) => r.json() as Promise<{ csrfToken: string }>);
  const res = await page.request.post("/api/auth/callback/e2e", {
    form: {
      csrfToken: csrf.csrfToken,
      email: ADMIN_EMAIL,
      callbackUrl: "/",
      json: "true",
    },
  });
  expect(res.ok()).toBeTruthy();
}

test("вход разрешён только из whitelist", async ({ page }) => {
  const csrf = await page.request
    .get("/api/auth/csrf")
    .then((r) => r.json() as Promise<{ csrfToken: string }>);
  await page.request.post("/api/auth/callback/e2e", {
    form: {
      csrfToken: csrf.csrfToken,
      email: "stranger@nowhere.tld",
      callbackUrl: "/",
      json: "true",
    },
  });
  await page.goto("/");
  // без валидной сессии — редирект на /login
  await expect(page).toHaveURL(/\/login/);
});

test("приёмочный сценарий: сервис → место → снапшот → платёж → отчёт", async ({
  page,
}) => {
  await login(page);

  // 1. Дашборд доступен
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();

  // 2. Создать сервис (per_seat monthly, списание сегодня)
  const stamp = Date.now();
  const svcName = `E2E Сервис ${stamp}`;
  const day = new Date().getUTCDate();
  await page.goto("/services");
  await page.getByRole("button", { name: "Добавить сервис" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[name="name"]').fill(svcName);
  await dialog.locator('input[name="seatPriceDefault"]').fill("10");
  await dialog.locator('input[name="billingDay"]').fill(String(day));
  await dialog.locator('select[name="ownerId"]').selectOption({
    label: "Администратор",
  });
  await dialog.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByText(/Сервис создан/)).toBeVisible();
  await expect(page.getByRole("link", { name: svcName })).toBeVisible();

  // 3. Открыть карточку, добавить место
  await page.getByRole("link", { name: svcName }).click();
  await expect(page.getByRole("heading", { name: svcName })).toBeVisible();
  await page.getByRole("tab", { name: /Места/ }).click();
  const email = `e2e.${stamp}@company.com`;
  await page.locator('input[name="email"]').fill(email);
  await page.getByRole("button", { name: "Добавить место" }).click();
  await expect(page.getByText(/Место добавлено/)).toBeVisible();

  // 4. Пересобрать снапшот текущего месяца (Настройки → Планы)
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Планы" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Пересобрать снапшот/ }).click();
  await expect(page.getByText(/пересобран/)).toBeVisible();

  // 5. Подтвердить ожидаемое списание нового сервиса на дашборде
  await page.goto("/");
  const feedRow = page
    .locator("div.divide-y > div")
    .filter({ hasText: svcName });
  await expect(feedRow).toBeVisible();
  await feedRow.getByRole("button", { name: "Подтвердить" }).click();
  await page
    .getByRole("button", { name: "Подтвердить и создать платёж" })
    .click();
  await expect(page.getByText(/Списание подтверждено/)).toBeVisible();

  // 6. Открыть отчёт текущего месяца — сервис виден
  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: /Отчёт «План \/ Факт»/ })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: svcName })).toBeVisible();
});
