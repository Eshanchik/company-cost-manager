import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import type { Role } from "@prisma/client";

// Тестовый провайдер входа — ТОЛЬКО при E2E_TEST_AUTH=1 (для Playwright e2e).
// В проде переменная не задаётся → провайдер отсутствует. Пускает лишь email
// из whitelist (та же проверка signIn), пароль не участвует.
const e2eProviders =
  process.env.E2E_TEST_AUTH === "1"
    ? [
        Credentials({
          id: "e2e",
          name: "E2E",
          credentials: { email: {} },
          authorize: async (creds) => {
            const email = String(creds?.email ?? "").toLowerCase();
            const allowed = await prisma.allowedEmail.findUnique({
              where: { email },
            });
            if (!allowed) return null;
            const user = await prisma.user.findUnique({ where: { email } });
            return user ?? { id: `e2e-${email}`, email };
          },
        }),
      ]
    : [];

// Полная конфигурация (Node runtime): адаптер Prisma + JWT-сессии.
// JWT-стратегия выбрана, чтобы middleware не ходил в БД на edge.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [...authConfig.providers, ...e2eProviders],
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    // Вход только для email из белого списка (§1). Проверяется на каждый вход,
    // поэтому добавление в whitelist открывает доступ без перезапуска.
    async signIn({ user }) {
      if (!user.email) return false;
      const allowed = await prisma.allowedEmail.findUnique({
        where: { email: user.email },
      });
      return Boolean(allowed);
    },
    async jwt({ token, user }) {
      // При входе прокидываем id и актуальную роль из БД в токен.
      if (user?.id) {
        token.uid = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        token.role = dbUser?.role ?? "viewer";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? session.user.id;
        session.user.role = (token.role as Role) ?? "viewer";
      }
      return session;
    },
  },
  events: {
    // Первый вход: копируем роль из whitelist в User (§3.1).
    // Далее роль управляется Admin'ом и здесь не перезаписывается.
    async createUser({ user }) {
      if (!user.email || !user.id) return;
      const allowed = await prisma.allowedEmail.findUnique({
        where: { email: user.email },
      });
      if (allowed) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: allowed.role },
        });
      }
    },
  },
});
