import { withActor } from "@/lib/api/handler";
import { overview } from "@/lib/api/operations";

export async function GET(req: Request) {
  return withActor(req, (actor) => overview(actor));
}
