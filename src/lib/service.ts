import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { HttpError } from "./errors";
import { expectedFabric, expectedQty, gateDecision, itemStatus, round2, wastagePct } from "./domain";

const orderInclude = {
  recipe: true,
  creator: { select: { fullName: true } },
  items: { include: { component: true }, orderBy: { id: "asc" } },
  logs: { include: { verifier: { select: { fullName: true } } }, orderBy: { timestamp: "desc" } },
} satisfies Prisma.CuttingOrderInclude;

type OrderFull = Prisma.CuttingOrderGetPayload<{ include: typeof orderInclude }>;

function present(o: OrderFull) {
  const expFabric = expectedFabric(o.targetQty, o.recipe.stdFabricYards);
  const w = wastagePct(o.actualFabricYds, expFabric);
  return { ...o, expectedFabricYds: round2(expFabric), wastagePct: w, overCap: w > o.recipe.wastageCap };
}

export async function listRecipes() {
  return prisma.recipe.findMany({ include: { components: { orderBy: { id: "asc" } } }, orderBy: { id: "asc" } });
}

export async function listOrders() {
  const rows = await prisma.cuttingOrder.findMany({ include: orderInclude, orderBy: { createdAt: "desc" } });
  return rows.map(present);
}

export async function getOrder(id: number) {
  const o = await prisma.cuttingOrder.findUnique({ where: { id }, include: orderInclude });
  if (!o) throw new HttpError(404, "Order not found");
  return present(o);
}

export async function createOrder(
  userId: number,
  input: { recipeId: number; targetQty: number; fabricRollId: string; actualFabricYds: number },
) {
  const recipe = await prisma.recipe.findUnique({ where: { id: input.recipeId }, include: { components: true } });
  if (!recipe) throw new HttpError(404, "Recipe not found");
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const orderNo = `CUT-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const created = await prisma.cuttingOrder.create({
    data: {
      orderNo,
      recipeId: recipe.id,
      targetQty: input.targetQty,
      fabricRollId: input.fabricRollId,
      actualFabricYds: input.actualFabricYds,
      status: "PENDING_VERIFICATION",
      createdBy: userId, // from the session, never from the client
      items: {
        create: recipe.components.map((c) => ({
          componentId: c.id,
          expectedQty: expectedQty(input.targetQty, c.piecesPerGarment),
        })),
      },
    },
  });
  return getOrder(created.id);
}

/** Verifier records physical counts. Status colour is always computed here, never trusted from the client. */
export async function saveCounts(orderId: number, counts: { componentId: number; actualQty: number }[]) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.cuttingOrder.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new HttpError(404, "Order not found");
    if (order.status !== "PENDING_VERIFICATION") throw new HttpError(409, "Order is not awaiting verification");
    const byComponent = new Map(order.items.map((i) => [i.componentId, i]));
    for (const c of counts) {
      if (!byComponent.has(c.componentId)) throw new HttpError(422, `Component ${c.componentId} does not belong to this order`);
    }
    for (const c of counts) {
      const item = byComponent.get(c.componentId)!;
      await tx.verificationItem.update({
        where: { id: item.id },
        data: { actualQty: c.actualQty, status: itemStatus(c.actualQty, item.expectedQty) },
      });
    }
  });
  return getOrder(orderId);
}

/** HARD STOP: any RED / missing / uncounted component => 422. Verifier identity comes from the session. */
export async function approveOrder(orderId: number, verifierId: number) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.cuttingOrder.findUnique({ where: { id: orderId }, include: { items: true, recipe: true } });
    if (!order) throw new HttpError(404, "Order not found");
    if (order.status !== "PENDING_VERIFICATION") throw new HttpError(409, "Order is not awaiting verification");

    const gate = gateDecision(order.items); // re-derived from raw numbers, not from stored colour
    if (!gate.ok) throw new HttpError(422, gate.reason);

    const moved = await tx.cuttingOrder.updateMany({
      where: { id: orderId, status: "PENDING_VERIFICATION" }, // compare-and-set: no double transitions
      data: { status: "VERIFIED" },
    });
    if (moved.count !== 1) throw new HttpError(409, "Order state changed, please reload");

    await tx.verificationLog.create({
      data: {
        orderId,
        verifierId,
        decision: "APPROVED",
        wastagePct: wastagePct(order.actualFabricYds, expectedFabric(order.targetQty, order.recipe.stdFabricYards)),
      },
    });
  });
  return getOrder(orderId);
}

export async function rejectOrder(orderId: number, verifierId: number, note: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.cuttingOrder.findUnique({ where: { id: orderId }, include: { recipe: true } });
    if (!order) throw new HttpError(404, "Order not found");
    if (order.status !== "PENDING_VERIFICATION") throw new HttpError(409, "Order is not awaiting verification");

    const moved = await tx.cuttingOrder.updateMany({
      where: { id: orderId, status: "PENDING_VERIFICATION" },
      data: { status: "REJECTED" },
    });
    if (moved.count !== 1) throw new HttpError(409, "Order state changed, please reload");

    await tx.verificationLog.create({
      data: {
        orderId,
        verifierId,
        decision: "REJECTED",
        rejectionNote: note,
        wastagePct: wastagePct(order.actualFabricYds, expectedFabric(order.targetQty, order.recipe.stdFabricYards)),
      },
    });
  });
  return getOrder(orderId);
}

/** Supervisor re-cuts a rejected batch and sends it back to QC. Old logs are kept. */
export async function resubmitOrder(orderId: number, actualFabricYds?: number) {
  await prisma.$transaction(async (tx) => {
    const moved = await tx.cuttingOrder.updateMany({
      where: { id: orderId, status: "REJECTED" },
      data: { status: "PENDING_VERIFICATION", ...(actualFabricYds ? { actualFabricYds } : {}) },
    });
    if (moved.count !== 1) throw new HttpError(409, "Only rejected orders can be resubmitted");
    await tx.verificationItem.updateMany({ where: { orderId }, data: { actualQty: null, status: null } });
  });
  return getOrder(orderId);
}

/** Query isolation: the sewing view is filtered at the database level. */
export async function getSewingQueue() {
  const [queue, inAssembly] = await Promise.all([
    prisma.cuttingOrder.findMany({ where: { status: "VERIFIED" }, include: orderInclude, orderBy: { updatedAt: "asc" } }),
    prisma.cuttingOrder.findMany({ where: { status: "SEWING_STARTED" }, include: orderInclude, orderBy: { updatedAt: "desc" } }),
  ]);
  return { queue: queue.map(present), inAssembly: inAssembly.map(present) };
}

export async function startSewing(orderId: number) {
  const moved = await prisma.cuttingOrder.updateMany({
    where: { id: orderId, status: "VERIFIED" },
    data: { status: "SEWING_STARTED" },
  });
  if (moved.count !== 1) throw new HttpError(404, "Order not found in the sewing queue");
  return { ok: true };
}
