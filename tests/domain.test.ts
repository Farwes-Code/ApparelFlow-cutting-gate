import { describe, expect, it } from "vitest";
import { createOrderSchema, expectedFabric, expectedQty, gateDecision, itemStatus, rejectSchema, wastagePct } from "@/lib/domain";

describe("traffic light", () => {
  it("GREEN on exact match, YELLOW on excess, RED on shortage", () => {
    expect(itemStatus(100, 100)).toBe("GREEN");
    expect(itemStatus(101, 100)).toBe("YELLOW");
    expect(itemStatus(99, 100)).toBe("RED");
  });
});

describe("multiplier + wastage", () => {
  it("50 garments x 2 cuffs = 100 expected", () => expect(expectedQty(50, 2)).toBe(100));
  it("wastage % = (actual - expected) / expected x 100", () => {
    expect(wastagePct(19, expectedFabric(10, 1.8))).toBeCloseTo(5.56, 2);
    expect(wastagePct(18, 18)).toBe(0);
    expect(wastagePct(17, 18)).toBeLessThan(0);
  });
});

describe("gate decision", () => {
  it("passes only when all counted and none short", () => {
    expect(gateDecision([{ expectedQty: 2, actualQty: 2 }, { expectedQty: 2, actualQty: 3 }]).ok).toBe(true);
    expect(gateDecision([{ expectedQty: 2, actualQty: 1 }]).ok).toBe(false);
    expect(gateDecision([{ expectedQty: 2, actualQty: null }]).ok).toBe(false);
    expect(gateDecision([]).ok).toBe(false);
  });
});

describe("input guards", () => {
  const base = { recipeId: 1, targetQty: 50, fabricRollId: "R1", actualFabricYds: 90 };
  it("accepts a valid payload", () => expect(createOrderSchema.safeParse(base).success).toBe(true));
  it.each([
    ["negative qty", { targetQty: -5 }],
    ["decimal qty", { targetQty: 2.5 }],
    ["string qty", { targetQty: "50" }],
    ["zero qty", { targetQty: 0 }],
    ["empty roll id", { fabricRollId: "   " }],
    ["negative fabric", { actualFabricYds: -1 }],
  ])("rejects %s", (_n, patch) => expect(createOrderSchema.safeParse({ ...base, ...patch }).success).toBe(false));
  it("rejects empty payload", () => expect(createOrderSchema.safeParse({}).success).toBe(false));
  it("reject note must be real text", () => {
    expect(rejectSchema.safeParse({}).success).toBe(false);
    expect(rejectSchema.safeParse({ note: "    " }).success).toBe(false);
    expect(rejectSchema.safeParse({ note: "Fabric defect" }).success).toBe(true);
  });
});
