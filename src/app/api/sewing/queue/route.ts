import { handle } from "@/lib/api";
import { getSewingQueue } from "@/lib/service";

export const GET = handle(["sewing_supervisor"], async () => getSewingQueue());
