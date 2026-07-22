import { withActor } from "@/lib/api/handler";
import { whoami } from "@/lib/api/operations";

export async function GET(req: Request) {
  return withActor(req, async (actor) => whoami(actor));
}
