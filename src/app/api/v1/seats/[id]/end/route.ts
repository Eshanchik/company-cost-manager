import { withActor } from "@/lib/api/handler";
import { endSeat } from "@/lib/api/operations";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withActor(req, (actor) => endSeat(actor, id));
}
