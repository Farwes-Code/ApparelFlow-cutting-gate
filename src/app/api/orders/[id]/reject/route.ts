import { handle, idOf, parse, readJson } from "@/lib/api";
import { rejectSchema } from "@/lib/domain";
import { rejectOrder } from "@/lib/service";

export const POST = handle<{ id: string }>(["cutting_verifier"], async ({ user, req, params }) => {
  const { note } = parse(rejectSchema, await readJson(req));
  return rejectOrder(idOf(params.id), user.id, note);
});
