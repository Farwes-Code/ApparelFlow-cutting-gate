import { z } from "zod";

export type ItemStatus = "GREEN" | "YELLOW" | "RED";

/** Traffic light: exact match, surplus, or shortage. */
export function itemStatus(actual: number, expected: number): ItemStatus {
  if (actual === expected) return "GREEN";
  return actual > expected ? "YELLOW" : "RED";
}

/** Multiplier engine: 50 garments x 2 cuffs = 100 expected cuffs. */
export const expectedQty = (targetQty: number, piecesPerGarment: number) => targetQty * piecesPerGarment;

export const expectedFabric = (targetQty: number, stdYardsPerPiece: number) => targetQty * stdYardsPerPiece;

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Fabric Wastage % = (actual - expected) / expected x 100 */
export function wastagePct(actualYds: number, expectedYds: number): number {
  if (expectedYds <= 0) return 0;
  return round2(((actualYds - expectedYds) / expectedYds) * 100);
}

export type Gate = { ok: true } | { ok: false; reason: string };

/** Hard stop: approval allowed only if every component is counted and none is short. */
export function gateDecision(items: { expectedQty: number; actualQty: number | null }[]): Gate {
  if (items.length === 0) return { ok: false, reason: "Order has no components to verify" };
  const uncounted = items.filter((i) => i.actualQty === null).length;
  if (uncounted > 0) return { ok: false, reason: `${uncounted} component(s) not counted yet` };
  const short = items.filter((i) => (i.actualQty as number) < i.expectedQty).length;
  if (short > 0) return { ok: false, reason: `Shortage on ${short} component(s) (RED). Approval is blocked; reject with a reason instead` };
  return { ok: true };
}

// ---- Input validation (server-side). Integers only for quantities; no negatives, decimals, strings. ----
export const createOrderSchema = z.object({
  recipeId: z.number().int().positive(),
  targetQty: z.number().int().min(1).max(100000),
  fabricRollId: z.string().trim().min(1).max(40),
  actualFabricYds: z.number().positive().max(1000000),
});

export const countsSchema = z.object({
  counts: z
    .array(z.object({ componentId: z.number().int().positive(), actualQty: z.number().int().min(0).max(10000000) }))
    .min(1),
});

export const rejectSchema = z.object({ note: z.string().trim().min(5).max(500) });

export const resubmitSchema = z.object({ actualFabricYds: z.number().positive().max(1000000).optional() });

export const loginSchema = z.object({ email: z.string().trim().min(1).max(200), password: z.string().min(1).max(200) });
