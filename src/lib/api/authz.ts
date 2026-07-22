import type { Role } from "@prisma/client";

import { hasRole } from "@/lib/roles";
import type { ApiActor } from "@/lib/api/token";

/** Ошибка с HTTP-статусом для REST/MCP-слоя. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Требует роль не ниже `min` у токена. Иначе ApiError(403). */
export function requireApiRole(actor: ApiActor, min: Role): void {
  if (!hasRole(actor.role, min)) {
    throw new ApiError(
      403,
      `Требуется роль «${min}» или выше (у токена «${actor.role}»)`
    );
  }
}
