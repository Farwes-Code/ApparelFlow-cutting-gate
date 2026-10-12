import { handle, idOf } from "@/lib/api";
import { getOrder } from "@/lib/service";

export const GET = handle<{ id: string }>(["cutting_supervisor", "cutting_verifier"], async ({ params }) =>
  getOrder(idOf(params.id)),
);
