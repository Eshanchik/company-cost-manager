import { withActor, jsonBody } from "@/lib/api/handler";
import { listSeats, addSeat } from "@/lib/api/operations";

export async function GET(req: Request) {
  const url = new URL(req.url);
  return withActor(req, (actor) =>
    listSeats(actor, {
      service_id: url.searchParams.get("service_id") ?? undefined,
      email: url.searchParams.get("email") ?? undefined,
    })
  );
}

export async function POST(req: Request) {
  const body = await jsonBody(req);
  return withActor(req, (actor) => addSeat(actor, body));
}
