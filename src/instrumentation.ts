// Next.js instrumentation — выполняется один раз при старте сервера.
// Здесь сидим начальных администраторов из ADMIN_EMAILS в whitelist (§1).
// (cron-задачи croner будут добавлены в Блоках 6–7.)
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { prisma } = await import("@/lib/prisma");

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length === 0) return;

  for (const email of adminEmails) {
    await prisma.allowedEmail.upsert({
      where: { email },
      update: {},
      create: { email, role: "admin", addedBy: "system:ADMIN_EMAILS" },
    });
  }
  console.log(
    `[instrumentation] whitelist: обеспечены admin-email'ы (${adminEmails.length})`
  );
}
