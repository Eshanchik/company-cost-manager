import { withActor, jsonBody } from "@/lib/api/handler";
import { setServiceArchived } from "@/lib/api/operations";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await jsonBody(req)) as { archived?: boolean };
  return withActor(req, (actor) =>
    setServiceArchived(actor, id, body.archived !== false)
  );
}
