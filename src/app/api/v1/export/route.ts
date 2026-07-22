import { NextResponse } from "next/server";

import { authenticateToken } from "@/lib/api/token";
import { exportData } from "@/lib/api/operations";
import { ApiError } from "@/lib/api/authz";

export async function GET(req: Request) {
  const actor = await authenticateToken(req.headers.get("authorization"));
  if (!actor)
    return NextResponse.json(
      { error: "Требуется валидный Bearer-токен" },
      { status: 401 }
    );
  const url = new URL(req.url);
  try {
    const result = await exportData(actor, {
      kind: url.searchParams.get("kind") ?? undefined,
      format: url.searchParams.get("format") ?? undefined,
    });
    if (
      result &&
      typeof result === "object" &&
      "format" in result &&
      result.format === "csv"
    ) {
      return new NextResponse((result as { data: string }).data, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${url.searchParams.get("kind") ?? "export"}.csv"`,
        },
      });
    }
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ApiError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Внутренняя ошибка" }, { status: 500 });
  }
}
