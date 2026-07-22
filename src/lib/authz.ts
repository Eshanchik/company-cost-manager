import { auth } from "@/auth";
import type { Role } from "@prisma/client";
import { hasRole } from "@/lib/roles";

export { hasRole };

export type SessionUser = {
  id: string;
  role: Role;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export class AuthorizationError extends Error {
  constructor(message = "Недостаточно прав") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Текущий пользователь сессии или null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as SessionUser;
}

/** Требует аутентификации. Бросает AuthorizationError, если гостя. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Требуется вход");
  return user;
}

/** Требует роль не ниже `min`. Для серверных мутаций. */
export async function requireRole(min: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasRole(user.role, min)) {
    throw new AuthorizationError(
      `Действие требует роль «${min}» или выше (у вас «${user.role}»)`
    );
  }
  return user;
}

/** Manager или Admin — для операций записи (§1 «Manager+»). */
export function requireManager(): Promise<SessionUser> {
  return requireRole("manager");
}

/** Только Admin — whitelist, токены, справочники, настройки. */
export function requireAdmin(): Promise<SessionUser> {
  return requireRole("admin");
}
