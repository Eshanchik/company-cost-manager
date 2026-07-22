import { withActor, jsonBody } from "@/lib/api/handler";
import { listServices, createService } from "@/lib/api/operations";

export async function GET(req: Request) {
  const url = new URL(req.url);
  return withActor(req, (actor) =>
    listServices(actor, {
      status: url.searchParams.get("status") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      owner: url.searchParams.get("owner") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
    })
  );
}

export async function POST(req: Request) {
  const body = await jsonBody(req);
  return withActor(req, (actor) => createService(actor, body));
}
