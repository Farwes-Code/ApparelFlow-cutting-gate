import { handle, idOf, parse, readJson } from "@/lib/api";
import { countsSchema } from "@/lib/domain";
import { saveCounts } from "@/lib/service";

export const POST = handle<{ id: string }>(["cutting_verifier"], async ({ req, params }) => {
  const { counts } = parse(countsSchema, await readJson(req));
  return saveCounts(idOf(params.id), counts);
});
