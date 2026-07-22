import { withActor } from "@/lib/api/handler";
import { needsAttention } from "@/lib/api/operations";

export async function GET(req: Request) {
  return withActor(req, (actor) => needsAttention(actor));
}
