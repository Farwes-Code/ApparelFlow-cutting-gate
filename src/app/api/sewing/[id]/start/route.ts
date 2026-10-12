import { handle, idOf } from "@/lib/api";
import { startSewing } from "@/lib/service";

export const POST = handle<{ id: string }>(["sewing_supervisor"], async ({ params }) => startSewing(idOf(params.id)));
