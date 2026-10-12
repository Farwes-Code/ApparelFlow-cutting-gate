// Integration tests against the real database (needs DATABASE_URL, JWT_SECRET and the seed data).
// They call the actual route handlers, so status codes (401/403/422...) are the real API behaviour.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Role } from "@prisma/client";

const state = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "af_session" && state.token ? { name, value: state.token } : undefined) }),
}));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("redirect"); } }));

import { prisma } from "@/lib/db";
import { signSession } from "@/lib/auth";
import { POST as createOrderRoute } from "@/app/api/orders/route";
import { POST as countsRoute } from "@/app/api/orders/[id]/counts/route";
import { POST as approveRoute } from "@/app/api/orders/[id]/approve/route";
import { POST as rejectRoute } from "@/app/api/orders/[id]/reject/route";
import { GET as sewingQueueRoute } from "@/app/api/sewing/queue/route";
import { GET as listOrdersRoute } from "@/app/api/orders/route";

process.env.JWT_SECRET ||= "test-secret-test-secret-123456";

type U = { id: number; role: Role; fullName: string; email: string };
const users = {} as Record<"supervisor" | "verifier" | "sewing", U>;
let recipeId = 0;
const created: number[] = [];

const asUser = async (u: U | null) => {
  state.token = u ? await signSession({ id: u.id, role: u.role, name: u.fullName, email: u.email }) : null;
};
const post = (body?: unknown) =>
  new Request("http://test.local/api", { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const get = () => new Request("http://test.local/api");
const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });
const noCtx = { params: Promise.resolve({}) } as { params: Promise<Record<string, never>> };

type OrderJson = { id: number; items: { componentId: number; expectedQty: number }[] };

async function newOrder(): Promise<OrderJson> {
  await asUser(users.supervisor);
  const res = await createOrderRoute(post({ recipeId, targetQty: 10, fabricRollId: "TEST-ROLL", actualFabricYds: 19 }), noCtx);
  expect(res.status).toBe(200);
  const o = (await res.json()) as OrderJson;
  created.push(o.id);
  return o;
}

async function count(o: OrderJson, shortFirst = false) {
  await asUser(users.verifier);
  const counts = o.items.map((i, idx) => ({ componentId: i.componentId, actualQty: shortFirst && idx === 0 ? i.expectedQty - 1 : i.expectedQty }));
  const res = await countsRoute(post({ counts }), ctx(o.id));
  expect(res.status).toBe(200);
}

beforeAll(async () => {
  const find = async (email: string) => {
    const u = await prisma.user.findUnique({ where: { email } });
    if (!u) throw new Error(`Seed data missing (${email}). Run: npm run seed`);
    return u as U;
  };
  users.supervisor = await find("supervisor@apparelflow.test");
  users.verifier = await find("verifier@apparelflow.test");
  users.sewing = await find("sewing@apparelflow.test");
  const r = await prisma.recipe.findUnique({ where: { recipeCode: "REC-BL01" } });
  if (!r) throw new Error("Recipe REC-BL01 missing. Run: npm run seed");
  recipeId = r.id;
});

afterAll(async () => {
  await prisma.verificationLog.deleteMany({ where: { orderId: { in: created } } });
  await prisma.verificationItem.deleteMany({ where: { orderId: { in: created } } });
  await prisma.cuttingOrder.deleteMany({ where: { id: { in: created } } });
  await prisma.$disconnect();
});

describe("Test 1: all-GREEN order can be approved by a Verifier", () => {
  it("approves, records verifier + wastage from the server", async () => {
    const o = await newOrder();
    await count(o);
    await asUser(users.verifier);
    const res = await approveRoute(post({ verifierId: users.supervisor.id }), ctx(o.id)); // spoof attempt in body
    expect(res.status).toBe(200);

    const db = await prisma.cuttingOrder.findUnique({ where: { id: o.id }, include: { logs: true } });
    expect(db?.status).toBe("VERIFIED");
    expect(db?.logs).toHaveLength(1);
    expect(db?.logs[0].decision).toBe("APPROVED");
    expect(db?.logs[0].verifierId).toBe(users.verifier.id); // from the session, not the body
    expect(db?.logs[0].wastagePct).toBeCloseTo(5.56, 1); // (19 - 18) / 18 x 100
  });
});

describe("Test 2: a RED (shortage) component blocks approval", () => {
  it("returns 422 and leaves the order PENDING", async () => {
    const o = await newOrder();
    await count(o, true);
    await asUser(users.verifier);
    const res = await approveRoute(post({}), ctx(o.id));
    expect(res.status).toBe(422);
    const db = await prisma.cuttingOrder.findUnique({ where: { id: o.id } });
    expect(db?.status).toBe("PENDING_VERIFICATION");
  });

  it("also returns 422 when components are uncounted", async () => {
    const o = await newOrder();
    await asUser(users.verifier);
    const res = await approveRoute(post({}), ctx(o.id));
    expect(res.status).toBe(422);
  });
});

describe("Test 3: rejection requires a reason note", () => {
  it("rejects missing / blank notes with 422, accepts a real note", async () => {
    const o = await newOrder();
    await asUser(users.verifier);
    expect((await rejectRoute(post({}), ctx(o.id))).status).toBe(422);
    expect((await rejectRoute(post({ note: "     " }), ctx(o.id))).status).toBe(422);
    expect((await prisma.cuttingOrder.findUnique({ where: { id: o.id } }))?.status).toBe("PENDING_VERIFICATION");

    const ok = await rejectRoute(post({ note: "Left sleeve short by 4 pieces" }), ctx(o.id));
    expect(ok.status).toBe(200);
    const db = await prisma.cuttingOrder.findUnique({ where: { id: o.id }, include: { logs: true } });
    expect(db?.status).toBe("REJECTED");
    expect(db?.logs[0].rejectionNote).toBe("Left sleeve short by 4 pieces");
  });
});

describe("Test 4: non-verifier roles get 403 on verification actions", () => {
  it("supervisor and sewing supervisor are forbidden; anonymous gets 401", async () => {
    const o = await newOrder();
    await count(o);
    for (const u of [users.supervisor, users.sewing]) {
      await asUser(u);
      expect((await approveRoute(post({}), ctx(o.id))).status).toBe(403);
      expect((await rejectRoute(post({ note: "trying to reject" }), ctx(o.id))).status).toBe(403);
      expect((await countsRoute(post({ counts: [{ componentId: 1, actualQty: 1 }] }), ctx(o.id))).status).toBe(403);
    }
    await asUser(null);
    expect((await approveRoute(post({}), ctx(o.id))).status).toBe(401);
    expect((await prisma.cuttingOrder.findUnique({ where: { id: o.id } }))?.status).toBe("PENDING_VERIFICATION");
  });

  it("verifier cannot create orders; sewing cannot list cutting orders", async () => {
    await asUser(users.verifier);
    expect((await createOrderRoute(post({ recipeId, targetQty: 5, fabricRollId: "X", actualFabricYds: 5 }), noCtx)).status).toBe(403);
    await asUser(users.sewing);
    expect((await listOrdersRoute(get(), noCtx)).status).toBe(403);
  });
});

describe("Test 5: unapproved orders never appear in the Sewing Queue", () => {
  it("queue contains only VERIFIED orders", async () => {
    const pending = await newOrder();
    const rejected = await newOrder();
    const verified = await newOrder();

    await asUser(users.verifier);
    await rejectRoute(post({ note: "Fabric defect on collar" }), ctx(rejected.id));
    await count(verified);
    await asUser(users.verifier);
    expect((await approveRoute(post({}), ctx(verified.id))).status).toBe(200);

    await asUser(users.sewing);
    const res = await sewingQueueRoute(get(), noCtx);
    expect(res.status).toBe(200);
    const { queue } = (await res.json()) as { queue: { id: number; status: string }[] };
    const ids = queue.map((q) => q.id);
    expect(ids).toContain(verified.id);
    expect(ids).not.toContain(pending.id);
    expect(ids).not.toContain(rejected.id);
    expect(queue.every((q) => q.status === "VERIFIED")).toBe(true);

    await asUser(users.supervisor);
    expect((await sewingQueueRoute(get(), noCtx)).status).toBe(403);
  });
});

describe("Defensive input guards on the API", () => {
  it("rejects negative, decimal, string and empty payloads", async () => {
    await asUser(users.supervisor);
    const bad = [{}, { recipeId, targetQty: -1, fabricRollId: "A", actualFabricYds: 5 }, { recipeId, targetQty: 2.5, fabricRollId: "A", actualFabricYds: 5 },
      { recipeId, targetQty: "10", fabricRollId: "A", actualFabricYds: 5 }];
    for (const b of bad) expect((await createOrderRoute(post(b), noCtx)).status).toBe(422);
    expect((await createOrderRoute(post(), noCtx)).status).toBe(400);
  });
});
