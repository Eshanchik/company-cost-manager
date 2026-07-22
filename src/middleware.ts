import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-middleware защиты маршрутов: использует только edge-safe конфиг.
export const { auth: middleware } = NextAuth(authConfig);

export default middleware((req) => {
  // Логика доступа — в callbacks.authorized (auth.config.ts).
  void req;
});

export const config = {
  // Пропускаем статику, служебные пути Next, а также API/MCP с токен-авторизацией
  // (api/v1 и mcp аутентифицируются Bearer-токеном, не сессией).
  matcher: [
    "/((?!api/auth|api/v1|mcp|_next/static|_next/image|favicon.ico).*)",
  ],
};
