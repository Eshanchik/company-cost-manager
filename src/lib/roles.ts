import type { Role } from "@prisma/client";

// Иерархия ролей: viewer < manager < admin.
export const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  manager: 1,
  admin: 2,
};

export const ROLE_LABEL: Record<Role, string> = {
  viewer: "Наблюдатель",
  manager: "Менеджер",
  admin: "Администратор",
};

/** true, если `role` не ниже `min` в иерархии. */
export function hasRole(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
