import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-middleware защиты маршрутов: использует только edge-safe конфиг.
export const { auth: middleware } = NextAuth(authConfig);

export default middleware((req) => {
  // Логика доступа — в callbacks.authorized (auth.config.ts).
  void req;
});

export const config = {
  // Пропускаем статику, изображения и служебные пути Next.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
