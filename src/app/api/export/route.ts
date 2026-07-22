import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  exportServicesCsv,
  exportEmployeesCsv,
  exportPaymentsCsv,
} from "@/lib/csv/table-export";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });
  }

  const kind = new URL(req.url).searchParams.get("kind");
  let csv: string;
  switch (kind) {
    case "services":
      csv = await exportServicesCsv();
      break;
    case "employees":
      csv = await exportEmployeesCsv();
      break;
    case "payments":
      csv = await exportPaymentsCsv();
      break;
    default:
      return NextResponse.json(
        { error: "kind: services | employees | payments" },
        { status: 400 }
      );
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}.csv"`,
    },
  });
}
