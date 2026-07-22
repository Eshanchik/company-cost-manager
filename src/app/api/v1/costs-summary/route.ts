import { withActor } from "@/lib/api/handler";
import { costsSummary } from "@/lib/api/operations";

export async function GET(req: Request) {
  const url = new URL(req.url);
  return withActor(req, (actor) =>
    costsSummary(actor, {
      group_by: url.searchParams.get("group_by") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    })
  );
}
