import { withActor } from "@/lib/api/handler";
import { getMonthlyReport } from "@/lib/api/operations";
import { ApiError } from "@/lib/api/authz";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  return withActor(req, (actor) => {
    if (!month) throw new ApiError(400, "Параметр month=YYYY-MM обязателен");
    return getMonthlyReport(actor, {
      month,
      view: url.searchParams.get("view") ?? undefined,
    });
  });
}
