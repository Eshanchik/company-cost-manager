import { withActor } from "@/lib/api/handler";
import { upcomingPayments } from "@/lib/api/operations";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const daysParam = url.searchParams.get("days");
  return withActor(req, (actor) =>
    upcomingPayments(actor, { days: daysParam ? Number(daysParam) : undefined })
  );
}
