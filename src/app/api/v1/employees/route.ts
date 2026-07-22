import { withActor } from "@/lib/api/handler";
import { listEmployees } from "@/lib/api/operations";

export async function GET(req: Request) {
  return withActor(req, (actor) => listEmployees(actor));
}
