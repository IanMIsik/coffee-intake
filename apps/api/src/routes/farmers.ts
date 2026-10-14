import { Router } from "express";
import { createFarmerSchema } from "@coffee/shared";
import { prisma } from "../db";
import { authOrgId, requireAuth, requireFarmer, requireStaff } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { presentReceipts } from "../lib/photos";

// Safety caps so one request can never pull an unbounded table.
const MAX_FARMERS = 5000;
const MAX_RECEIPTS = 200;

export const farmersRouter = Router();

farmersRouter.use(requireAuth);

// Staff: list/search farmers in their organization.
farmersRouter.get("/", requireStaff, asyncHandler(async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const farmers = await prisma.farmer.findMany({
    where: {
      organizationId: authOrgId(req),
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
    return res.status(409).json({ error: "A farmer with this phone number already exists" });
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
  res.json(farmer);
}));

// Farmer: their own receipt history.
farmersRouter.get("/me/receipts", requireFarmer, asyncHandler(async (req, res) => {
  const farmerId = req.auth!.kind === "farmer" ? req.auth!.farmerId : "";
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
  res.json({ ...farmer, receipts: await presentReceipts(farmer.receipts) });
}));
