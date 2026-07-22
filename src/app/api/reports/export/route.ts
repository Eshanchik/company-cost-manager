import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getMonthlyReport, type ReportView } from "@/lib/report/monthly-report";
import { buildReportCsv } from "@/lib/report/csv";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });
  }

  const url = new URL(req.url);
  const month = url.searchParams.get("month"); // YYYY-MM
  const viewParam = url.searchParams.get("view");
  const view: ReportView = viewParam === "normalized" ? "normalized" : "cashflow";

  const m = month?.match(/^(\d{4})-(\d{2})$/);
  if (!m) {
    return NextResponse.json(
      { error: "Ожидается параметр month=YYYY-MM" },
      { status: 400 }
    );
  }
  const year = Number(m[1]);
  const month0 = Number(m[2]) - 1;
  if (month0 < 0 || month0 > 11) {
    return NextResponse.json({ error: "Некорректный месяц" }, { status: 400 });
  }

  const report = await getMonthlyReport(year, month0, view);
  const csv = buildReportCsv(report);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-${month}-${view}.csv"`,
    },
  });
}
