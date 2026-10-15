import { Prisma } from "@prisma/client";
import { Router } from "express";
import { createFarmerSchema, farmerPriceSchema, farmerSettlementSchema } from "@coffee/shared";
import { prisma } from "../db";
import { authOrgId, requireAuth, requireFarmer, requireRole, requireStaff } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { presentReceipts } from "../lib/photos";
import { SettlementError, farmerBalance, lockReceipts, payForReceipt } from "../lib/settlements";

// Safety caps so one request can never pull an unbounded table.
const MAX_FARMERS = 5000;
const MAX_RECEIPTS = 200;

export const farmersRouter = Router();

farmersRouter.use(requireAuth);

// Staff: list/search farmers in their organization.
farmersRouter.get("/", requireStaff, asyncHandler(async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const archived = req.query.archived === "true";
  const farmers = await prisma.farmer.findMany({
    where: {
      organizationId: authOrgId(req),
      archivedAt: archived ? { not: null } : null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: MAX_FARMERS,
  });
  res.json(farmers);
}));

// Staff: create a new farmer.
farmersRouter.post("/", requireStaff, asyncHandler(async (req, res) => {
  const parsed = createFarmerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const organizationId = authOrgId(req);

  const existing = await prisma.farmer.findUnique({
    where: { organizationId_phone: { organizationId, phone: parsed.data.phone } },
  });
  if (existing) {
    return res.status(409).json({
      error: existing.archivedAt
        ? `${existing.name} (this phone number) was removed from the list. Restore them from the archive instead.`
        : "A farmer with this phone number already exists",
    });
  }

  const farmer = await prisma.farmer.create({
    data: {
      organizationId,
      name: parsed.data.name,
      phone: parsed.data.phone,
      nationalId: parsed.data.nationalId ?? null,
    },
  });
  res.status(201).json(farmer);
}));

// Farmer: their own profile.
farmersRouter.get("/me", requireFarmer, asyncHandler(async (req, res) => {
  const farmer = await prisma.farmer.findUniqueOrThrow({
    where: { id: req.auth!.kind === "farmer" ? req.auth!.farmerId : "" },
  });
  if (farmer.archivedAt) {
    return res.status(401).json({ error: "This account is no longer active. Please contact the factory." });
  }
  res.json({ ...farmer, balance: await farmerBalance(farmer.organizationId, farmer.id) });
}));

// Farmer: their own receipt history.
farmersRouter.get("/me/receipts", requireFarmer, asyncHandler(async (req, res) => {
  const farmerId = req.auth!.kind === "farmer" ? req.auth!.farmerId : "";
  const self = await prisma.farmer.findFirst({ where: { id: farmerId, archivedAt: null } });
  if (!self) {
    return res.status(401).json({ error: "This account is no longer active. Please contact the factory." });
  }
  const receipts = await prisma.receipt.findMany({
    where: { farmerId, organizationId: authOrgId(req) },
    orderBy: { deliveredAt: "desc" },
    take: MAX_RECEIPTS,
  });
  res.json(await presentReceipts(receipts));
}));

// Staff: a specific farmer's detail + receipt history.
farmersRouter.get("/:id", requireStaff, asyncHandler(async (req, res) => {
  const farmer = await prisma.farmer.findFirst({
    where: { id: req.params.id, organizationId: authOrgId(req) },
    include: { receipts: { orderBy: { deliveredAt: "desc" }, take: MAX_RECEIPTS } },
  });
  if (!farmer) {
    return res.status(404).json({ error: "Farmer not found" });
  }
  res.json({
    ...farmer,
    receipts: await presentReceipts(farmer.receipts),
    balance: await farmerBalance(farmer.organizationId, farmer.id),
  });
}));

// Admin: remove a farmer from the list without deleting anything. Deliveries, payments and
// balances stay on record; they just can't log in or get new deliveries until restored.
farmersRouter.post("/:id/archive", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const organizationId = authOrgId(req);
  const staffUserId = req.auth!.kind === "staff" ? req.auth!.staffUserId : "";
  const farmer = await prisma.farmer.findFirst({ where: { id: req.params.id, organizationId } });
  if (!farmer) return res.status(404).json({ error: "Farmer not found" });
  if (farmer.archivedAt) return res.status(409).json({ error: "This farmer is already removed from the list" });
  const updated = await prisma.farmer.update({
    where: { id: farmer.id },
    data: { archivedAt: new Date(), archivedByStaffId: staffUserId },
  });
  res.json({ ...updated, balance: await farmerBalance(organizationId, farmer.id) });
}));

farmersRouter.post("/:id/restore", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const organizationId = authOrgId(req);
  const farmer = await prisma.farmer.findFirst({ where: { id: req.params.id, organizationId } });
  if (!farmer) return res.status(404).json({ error: "Farmer not found" });
  if (!farmer.archivedAt) return res.status(409).json({ error: "This farmer is not removed" });
  const updated = await prisma.farmer.update({
    where: { id: farmer.id },
    data: { archivedAt: null, archivedByStaffId: null },
  });
  res.json({ ...updated, balance: await farmerBalance(organizationId, farmer.id) });
}));

// Admin: pay a farmer for some kilos. Applied to their oldest unpaid deliveries first, so
// "I sold 120 kg of Wanjiru's coffee at 85" works without picking deliveries by hand.
farmersRouter.post("/:id/settlements", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const parsed = farmerSettlementSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const organizationId = authOrgId(req);
  const staffUserId = req.auth!.kind === "staff" ? req.auth!.staffUserId : "";
  const farmer = await prisma.farmer.findFirst({ where: { id: req.params.id, organizationId } });
  if (!farmer) {
    return res.status(404).json({ error: "Farmer not found" });
  }

  const price = parsed.data.pricePerKg !== undefined ? new Prisma.Decimal(parsed.data.pricePerKg) : null;
  const created = await prisma.$transaction(async (tx) => {
    const open = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Receipt"
      WHERE "organizationId" = ${organizationId} AND "farmerId" = ${farmer.id} AND "settledKg" < "weightKg"
      ORDER BY "deliveredAt" ASC, "createdAt" ASC
      FOR UPDATE`;
    await lockReceipts(tx, open.map((r) => r.id));

    let toPay = new Prisma.Decimal(parsed.data.weightKg);
    const made = [];
    for (const { id } of open) {
      if (toPay.lte(0)) break;
      const receipt = await tx.receipt.findUniqueOrThrow({ where: { id } });
      const take = Prisma.Decimal.min(toPay, receipt.weightKg.minus(receipt.settledKg));
      made.push(
        await payForReceipt(tx, { receiptId: id, weightKg: take, pricePerKg: price, note: parsed.data.note, staffId: staffUserId })
      );
      toPay = toPay.minus(take);
    }
    if (toPay.gt(0)) {
      const unpaid = new Prisma.Decimal(parsed.data.weightKg).minus(toPay);
      throw new SettlementError(`${farmer.name} only has ${unpaid.toFixed(2)} kg unpaid, which is less than the ${parsed.data.weightKg} kg entered`);
    }
    return made;
  });

  res.status(201).json({ settlements: created, balance: await farmerBalance(organizationId, farmer.id) });
}));

// Admin: set the agreed price on a farmer's deliveries in one go.
farmersRouter.post("/:id/price", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const parsed = farmerPriceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const organizationId = authOrgId(req);
  const farmer = await prisma.farmer.findFirst({ where: { id: req.params.id, organizationId } });
  if (!farmer) {
    return res.status(404).json({ error: "Farmer not found" });
  }
  const result = await prisma.receipt.updateMany({
    where: {
      organizationId,
      farmerId: farmer.id,
      ...(parsed.data.scope === "unpriced" ? { pricePerKg: null } : { settled: false }),
    },
    data: { pricePerKg: parsed.data.pricePerKg, batchId: null },
  });
  res.json({ updated: result.count, balance: await farmerBalance(organizationId, farmer.id) });
}));
