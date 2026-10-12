import { handle } from "@/lib/api";

export const GET = handle(["cutting_supervisor", "cutting_verifier", "sewing_supervisor"], async ({ user }) => ({ user }));
