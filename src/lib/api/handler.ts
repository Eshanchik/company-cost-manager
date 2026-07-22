import { NextResponse } from "next/server";

import { authenticateToken, type ApiActor } from "@/lib/api/token";
import { ApiError } from "@/lib/api/authz";

/**
 * Обёртка REST-роутов /api/v1/*: аутентификация по Bearer-токену и маппинг
 * ApiError → HTTP-статус. Ответы — компактный JSON.
 */
export async function withActor(
  req: Request,
  fn: (actor: ApiActor) => Promise<unknown>
): Promise<NextResponse> {
  const actor = await authenticateToken(req.headers.get("authorization"));
  if (!actor) {
    return NextResponse.json(
      { error: "Требуется валидный Bearer-токен" },
      { status: 401 }
    );
  }
  try {
    const data = await fn(actor);
    return NextResponse.json(data ?? { ok: true });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[api/v1]", e);
    return NextResponse.json({ error: "Внутренняя ошибка" }, { status: 500 });
  }
}

export async function jsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
