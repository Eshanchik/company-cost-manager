import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-safe часть конфигурации: без Prisma-адаптера и без обращений к БД.
// Используется в middleware (edge runtime) и расширяется в src/auth.ts.
export const authConfig = {
  providers: [Google],
  pages: {
    signIn: "/login",
    error: "/denied",
  },
  callbacks: {
    // Защита маршрутов в middleware: пускаем только на публичные страницы
    // и аутентифицированных пользователей.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const publicPaths = ["/login", "/denied"];
      const isPublic = publicPaths.some(
        (p) => nextUrl.pathname === p || nextUrl.pathname.startsWith(`${p}/`)
      );
      if (isPublic) return true;
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
