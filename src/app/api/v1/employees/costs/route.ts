import { withActor } from "@/lib/api/handler";
import { getEmployeeCosts } from "@/lib/api/operations";

export async function GET(req: Request) {
  const url = new URL(req.url);
  return withActor(req, (actor) =>
    getEmployeeCosts(actor, {
      id: url.searchParams.get("id") ?? undefined,
      email: url.searchParams.get("email") ?? undefined,
    })
  );
}
