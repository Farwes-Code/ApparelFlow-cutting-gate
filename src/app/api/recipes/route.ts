import { handle } from "@/lib/api";
import { listRecipes } from "@/lib/service";

export const GET = handle(["cutting_supervisor", "cutting_verifier"], async () => listRecipes());
