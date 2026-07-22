import { withActor, jsonBody } from "@/lib/api/handler";
import { getService, updateService } from "@/lib/api/operations";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withActor(req, (actor) => getService(actor, id));
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await jsonBody(req);
  return withActor(req, (actor) => updateService(actor, id, body));
}
