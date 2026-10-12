import { handle, idOf } from "@/lib/api";
import { approveOrder } from "@/lib/service";

// The request body is ignored on purpose: verifier id + timestamp come from the session / server clock.
export const POST = handle<{ id: string }>(["cutting_verifier"], async ({ user, params }) =>
  approveOrder(idOf(params.id), user.id),
);
