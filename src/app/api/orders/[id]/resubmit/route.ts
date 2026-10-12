import { handle, idOf, parse } from "@/lib/api";
import { resubmitSchema } from "@/lib/domain";
import { resubmitOrder } from "@/lib/service";

export const POST = handle<{ id: string }>(["cutting_supervisor"], async ({ req, params }) => {
  const body = await req.json().catch(() => ({}));
  const { actualFabricYds } = parse(resubmitSchema, body);
  return resubmitOrder(idOf(params.id), actualFabricYds);
});
