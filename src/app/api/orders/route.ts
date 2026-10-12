import { handle, parse, readJson } from "@/lib/api";
import { createOrderSchema } from "@/lib/domain";
import { createOrder, listOrders } from "@/lib/service";

// Sewing supervisors are deliberately excluded: they only ever see /api/sewing/queue.
export const GET = handle(["cutting_supervisor", "cutting_verifier"], async () => listOrders());

export const POST = handle(["cutting_supervisor"], async ({ user, req }) => {
  const input = parse(createOrderSchema, await readJson(req));
  return createOrder(user.id, input);
});
