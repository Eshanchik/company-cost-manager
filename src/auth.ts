import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import type { Role } from "@prisma/client";

// Полная конфигурация (Node runtime): адаптер Prisma + JWT-сессии.
// JWT-стратегия выбрана, чтобы middleware не ходил в БД на edge.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
