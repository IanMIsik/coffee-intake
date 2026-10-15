import { Prisma } from "@prisma/client";
import { Router } from "express";
import { createBatchSchema, holdFarmerSchema, payBatchSchema } from "@coffee/shared";
import { prisma } from "../db";
import { authOrgId, requireAuth, requireRole } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { SettlementError, lockReceipts, payForReceipt } from "../lib/settlements";

export const batchesRouter = Router();

batchesRouter.use(requireAuth, requireRole("ADMIN"));

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

type Tx = Prisma.TransactionClient;

/** Prices the unpaid kilos of every non-held farmer's deliveries at the batch price. */
async function applyBatchPrice(
  tx: Tx,
  batch: { id: string; organizationId: string; pricePerKg: Prisma.Decimal },
  held: string[],
  onlyUnpriced: boolean
) {
  const result = await tx.receipt.updateMany({
    where: {
      organizationId: batch.organizationId,
      settled: false,
      ...(held.length ? { farmerId: { notIn: held } } : {}),
      ...(onlyUnpriced ? { pricePerKg: null } : {}),
    },
    data: { pricePerKg: batch.pricePerKg, batchId: batch.id },
  });
  return result.count;
}

/** Per-farmer position inside one batch: what is still unpaid at its price and what was paid under it. */
async function batchFarmers(organizationId: string, batch: { id: string; heldFarmerIds: string[] }) {
  const unpaid = await prisma.$queryRaw<
    { farmerId: string; unpaidKg: Prisma.Decimal; amountOwed: Prisma.Decimal }[]
  >`
    SELECT "farmerId",
           SUM("weightKg" - "settledKg") AS "unpaidKg",
           SUM(("weightKg" - "settledKg") * "pricePerKg") AS "amountOwed"
    FROM "Receipt"
    WHERE "organizationId" = ${organizationId} AND "batchId" = ${batch.id} AND "settledKg" < "weightKg"
    GROUP BY "farmerId"`;
  const paid = await prisma.settlement.groupBy({
    by: ["farmerId"],
    where: { organizationId, batchId: batch.id, voidedAt: null },
    _sum: { weightKg: true, amount: true },
  });
  const ids = new Set<string>([...unpaid.map((u) => u.farmerId), ...paid.map((p) => p.farmerId), ...batch.heldFarmerIds]);
  const farmers = await prisma.farmer.findMany({
    where: { organizationId, id: { in: [...ids] } },
    select: { id: true, name: true, phone: true },
    orderBy: { name: "asc" },
  });
  return farmers.map((f) => {
    const u = unpaid.find((x) => x.farmerId === f.id);
    const p = paid.find((x) => x.farmerId === f.id);
    return {
      farmerId: f.id,
      name: f.name,
      phone: f.phone,
      held: batch.heldFarmerIds.includes(f.id),
      unpaidKg: u ? u.unpaidKg.toString() : "0",
      amountOwed: u ? D(u.amountOwed).toDecimalPlaces(2).toString() : "0",
      paidKg: p?._sum.weightKg ? p._sum.weightKg.toString() : "0",
      amountPaid: p?._sum.amount ? p._sum.amount.toString() : "0",
    };
  });
}

function presentBatch(b: {
  id: string;
  name: string;
  pricePerKg: Prisma.Decimal;
  note: string | null;
  heldFarmerIds: string[];
  createdAt: Date;
}) {
  return {
    id: b.id,
    name: b.name,
    pricePerKg: b.pricePerKg.toString(),
    note: b.note,
    heldFarmerIds: b.heldFarmerIds,
    createdAt: b.createdAt.toISOString(),
  };
}

batchesRouter.get("/", asyncHandler(async (req, res) => {
  const organizationId = authOrgId(req);
  const batches = await prisma.batch.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const ids = batches.map((b) => b.id);
  const unpaid = ids.length
    ? await prisma.$queryRaw<{ batchId: string; unpaidKg: Prisma.Decimal; farmers: bigint }[]>`
        SELECT "batchId", SUM("weightKg" - "settledKg") AS "unpaidKg", COUNT(DISTINCT "farmerId") AS farmers
        FROM "Receipt"
        WHERE "organizationId" = ${organizationId} AND "batchId" IN (${Prisma.join(ids)}) AND "settledKg" < "weightKg"
        GROUP BY "batchId"`
    : [];
  const paid = await prisma.settlement.groupBy({
    by: ["batchId"],
    where: { organizationId, batchId: { in: ids }, voidedAt: null },
    _sum: { weightKg: true, amount: true },
  });
  res.json(
    batches.map((b) => {
      const u = unpaid.find((x) => x.batchId === b.id);
      const p = paid.find((x) => x.batchId === b.id);
      return {
        ...presentBatch(b),
        unpaidKg: u ? u.unpaidKg.toString() : "0",
        farmersOwed: u ? Number(u.farmers) : 0,
        heldCount: b.heldFarmerIds.length,
        paidKg: p?._sum.weightKg ? p._sum.weightKg.toString() : "0",
        amountPaid: p?._sum.amount ? p._sum.amount.toString() : "0",
      };
    })
  );
}));

batchesRouter.get("/:id", asyncHandler(async (req, res) => {
  const organizationId = authOrgId(req);
  const batch = await prisma.batch.findFirst({ where: { id: req.params.id, organizationId } });
  if (!batch) return res.status(404).json({ error: "Batch not found" });
  res.json({ ...presentBatch(batch), farmers: await batchFarmers(organizationId, batch) });
}));

// Publish a price: it takes effect on everyone's unpaid kilos immediately, except farmers who wait.
batchesRouter.post("/", asyncHandler(async (req, res) => {
  const parsed = createBatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const organizationId = authOrgId(req);
  const staffUserId = req.auth!.kind === "staff" ? req.auth!.staffUserId : "";
  const held = [...new Set(parsed.data.heldFarmerIds ?? [])];
  if (held.length) {
    const found = await prisma.farmer.count({ where: { organizationId, id: { in: held } } });
    if (found !== held.length) return res.status(400).json({ error: "Unknown farmer in the waiting list" });
  }

  const { batch, priced } = await prisma.$transaction(async (tx) => {
    const count = await tx.batch.count({ where: { organizationId } });
    const created = await tx.batch.create({
      data: {
        organizationId,
        name: parsed.data.name ?? `Batch ${count + 1}`,
        pricePerKg: D(parsed.data.pricePerKg),
        note: parsed.data.note ?? null,
        heldFarmerIds: held,
        createdByStaffId: staffUserId,
      },
    });
    return { batch: created, priced: await applyBatchPrice(tx, created, held, false) };
  });

  res.status(201).json({ ...presentBatch(batch), pricedReceipts: priced, farmers: await batchFarmers(organizationId, batch) });
}));

// Late deliveries: bring unpriced deliveries (from non-waiting farmers) under this batch's price.
batchesRouter.post("/:id/apply", asyncHandler(async (req, res) => {
  const organizationId = authOrgId(req);
  const batch = await prisma.batch.findFirst({ where: { id: req.params.id, organizationId } });
  if (!batch) return res.status(404).json({ error: "Batch not found" });
  const priced = await prisma.$transaction((tx) => applyBatchPrice(tx, batch, batch.heldFarmerIds, true));
  res.json({ pricedReceipts: priced, farmers: await batchFarmers(organizationId, batch) });
}));

// A farmer decides to wait (their unpaid kilos go back to unpriced) or to join this batch after all.
batchesRouter.post("/:id/hold", asyncHandler(async (req, res) => {
  const parsed = holdFarmerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const organizationId = authOrgId(req);
  const batch = await prisma.batch.findFirst({ where: { id: req.params.id, organizationId } });
  if (!batch) return res.status(404).json({ error: "Batch not found" });
  const farmer = await prisma.farmer.findFirst({ where: { id: parsed.data.farmerId, organizationId } });
  if (!farmer) return res.status(404).json({ error: "Farmer not found" });

  await prisma.$transaction(async (tx) => {
    const held = new Set(batch.heldFarmerIds);
    if (parsed.data.hold) {
      held.add(farmer.id);
      await tx.receipt.updateMany({
        where: { organizationId, farmerId: farmer.id, batchId: batch.id, settled: false },
        data: { pricePerKg: null, batchId: null },
      });
    } else {
      held.delete(farmer.id);
      await tx.receipt.updateMany({
        where: { organizationId, farmerId: farmer.id, settled: false },
        data: { pricePerKg: batch.pricePerKg, batchId: batch.id },
      });
    }
    await tx.batch.update({ where: { id: batch.id }, data: { heldFarmerIds: [...held] } });
  });

  const fresh = await prisma.batch.findUniqueOrThrow({ where: { id: batch.id } });
  res.json({ ...presentBatch(fresh), farmers: await batchFarmers(organizationId, fresh) });
}));

// Record payments for the kilos priced under this batch. All-or-nothing.
batchesRouter.post("/:id/pay", asyncHandler(async (req, res) => {
  const parsed = payBatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const organizationId = authOrgId(req);
  const staffUserId = req.auth!.kind === "staff" ? req.auth!.staffUserId : "";
  const batch = await prisma.batch.findFirst({ where: { id: req.params.id, organizationId } });
  if (!batch) return res.status(404).json({ error: "Batch not found" });

  const created = await prisma.$transaction(async (tx) => {
    const open = await tx.$queryRaw<{ id: string; farmerId: string }[]>`
      SELECT id, "farmerId" FROM "Receipt"
      WHERE "organizationId" = ${organizationId} AND "batchId" = ${batch.id} AND "settledKg" < "weightKg"
      ORDER BY "deliveredAt" ASC, "createdAt" ASC
      FOR UPDATE`;
    await lockReceipts(tx, open.map((r) => r.id));

    const farmerIds = [...new Set(open.map((r) => r.farmerId))];
    const wanted = parsed.data.payments
      ? parsed.data.payments.map((p) => ({ farmerId: p.farmerId, weightKg: p.weightKg !== undefined ? D(p.weightKg) : null }))
      : farmerIds.map((farmerId) => ({ farmerId, weightKg: null }));

    const made = [];
    for (const item of wanted) {
      const receipts = open.filter((r) => r.farmerId === item.farmerId);
      let remaining: Prisma.Decimal | null = item.weightKg;
      let paidAny = false;
      for (const { id } of receipts) {
        const receipt = await tx.receipt.findUniqueOrThrow({ where: { id } });
        const left = receipt.weightKg.minus(receipt.settledKg);
        const take = remaining === null ? left : Prisma.Decimal.min(remaining, left);
        if (take.lte(0)) break;
        made.push(
          await payForReceipt(tx, {
            receiptId: id,
            weightKg: take,
            pricePerKg: batch.pricePerKg,
            note: parsed.data.note,
            staffId: staffUserId,
            batchId: batch.id,
          })
        );
        paidAny = true;
        if (remaining !== null) remaining = remaining.minus(take);
      }
      if (remaining !== null && remaining.gt(0)) {
        const farmer = await tx.farmer.findUnique({ where: { id: item.farmerId } });
        throw new SettlementError(
          `${farmer?.name ?? "That farmer"} has less unpaid in this batch than the ${item.weightKg!.toString()} kg entered`
        );
      }
      if (!paidAny && item.weightKg === null && parsed.data.payments) {
        throw new SettlementError("A farmer in the list has nothing unpaid in this batch");
      }
    }
    if (made.length === 0) throw new SettlementError("Nothing is unpaid in this batch");
    return made;
  });

  res.status(201).json({
    settlements: created.length,
    farmers: await batchFarmers(organizationId, batch),
  });
}));
