import { withActor, jsonBody } from "@/lib/api/handler";
import { recordPayment } from "@/lib/api/operations";

export async function POST(req: Request) {
  const body = await jsonBody(req);
  return withActor(req, (actor) => recordPayment(actor, body));
}
