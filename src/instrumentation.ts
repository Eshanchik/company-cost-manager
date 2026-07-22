// Next.js instrumentation — выполняется один раз при старте сервера.
// Здесь: сид администраторов из ADMIN_EMAILS в whitelist (§1) и запуск
// cron-задач (croner) для курсов валют (Блок 6) и план-снапшотов (Блок 7).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { prisma } = await import("@/lib/prisma");

  // 1. Whitelist администраторов из ADMIN_EMAILS.
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const email of adminEmails) {
    await prisma.allowedEmail.upsert({
      where: { email },
      update: {},
      create: { email, role: "admin", addedBy: "system:ADMIN_EMAILS" },
    });
  }
  if (adminEmails.length > 0) {
    console.log(
      `[instrumentation] whitelist: обеспечены admin-email'ы (${adminEmails.length})`
    );
  }

  // 2. Cron-задачи. Гард от повторного планирования при hot-reload в dev.
  const g = globalThis as unknown as { __subtrackCron?: boolean };
  if (g.__subtrackCron) return;
  g.__subtrackCron = true;

  const tz = process.env.APP_TZ || "Europe/Kyiv";
  const { Cron } = await import("croner");

  // Курсы валют — ежедневно в 07:00 APP_TZ.
  new Cron("0 7 * * *", { timezone: tz, name: "fx-update" }, async () => {
    const { updateFxRates } = await import("@/lib/fx/update-rates");
    const res = await updateFxRates();
    console.log("[cron:fx-update]", res.ok ? `обновлено ${res.updated} на ${res.date}` : `ошибка: ${res.error}`);
  });

  // План-снапшот — 1-го числа в 00:05 APP_TZ (создаёт снапшот нового месяца).
  new Cron("5 0 1 * *", { timezone: tz, name: "plan-snapshot" }, async () => {
    const { generateSnapshot } = await import("@/lib/plan/generate-snapshot");
    const now = new Date();
    const res = await generateSnapshot({
      year: now.getUTCFullYear(),
      month0: now.getUTCMonth(),
    });
    console.log(
      "[cron:plan-snapshot]",
      res.created ? `создан ${res.month}: ${res.lines} строк` : `пропущен (${res.reason})`
    );
  });

  console.log(`[instrumentation] cron-задачи запланированы (TZ=${tz})`);
}
