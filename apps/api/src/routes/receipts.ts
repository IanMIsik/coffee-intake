import { Prisma } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { adjustReceiptSchema, createReceiptSchema, settleReceiptSchema } from "@coffee/shared";
import { prisma } from "../db";
import { authOrgId, requireAuth, requireRole, requireStaff } from "../auth/middleware";
import { getObjectStorage } from "../storage";
import { createNotificationProvider } from "../notifications";
import { asyncHandler } from "../lib/asyncHandler";
import { presentReceipt, presentReceipts } from "../lib/photos";

export const receiptsRouter = Router();

const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype in ALLOWED_PHOTO_TYPES);
  },
});

const MAX_LIST = 500;

receiptsRouter.use(requireAuth, requireStaff);

receiptsRouter.get("/", asyncHandler(async (req, res) => {
  const farmerId = typeof req.query.farmerId === "string" ? req.query.farmerId : undefined;
  const requested = Number(req.query.limit);
  const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_LIST) : 200;
  const receipts = await prisma.receipt.findMany({
    where: { organizationId: authOrgId(req), ...(farmerId ? { farmerId } : {}) },
    orderBy: { deliveredAt: "desc" },
    take: limit,
  });
  res.json(await presentReceipts(receipts));
}));

receiptsRouter.get("/:id", asyncHandler(async (req, res) => {
  const receipt = await prisma.receipt.findFirst({
    where: { id: req.params.id, organizationId: authOrgId(req) },
    include: {
      farmer: true,
      organization: true,
      recordedByStaff: { select: { id: true, name: true } },
    },
  });
  if (!receipt) {
    return res.status(404).json({ error: "Receipt not found" });
  }
  res.json(await presentReceipt(receipt));
}));

receiptsRouter.patch("/:id", asyncHandler(async (req, res) => {
  const parsed = adjustReceiptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { weightKg, receiptNumber } = parsed.data;
  if (weightKg === undefined && receiptNumber === undefined) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  const organizationId = authOrgId(req);
  const staffUserId = req.auth!.kind === "staff" ? req.auth!.staffUserId : "";

  const existing = await prisma.receipt.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) {
    return res.status(404).json({ error: "Receipt not found" });
  }

  if (receiptNumber && receiptNumber !== existing.receiptNumber) {
    const duplicate = await prisma.receipt.findUnique({
      where: { organizationId_receiptNumber: { organizationId, receiptNumber } },
    });
    if (duplicate) {
      return res.status(409).json({ error: `Receipt number ${receiptNumber} has already been recorded` });
    }
  }

  try {
    const [receipt] = await prisma.$transaction(async (tx) => {
      const updated = await tx.receipt.update({
        where: { id: existing.id },
        data: {
          ...(receiptNumber !== undefined ? { receiptNumber } : {}),
          ...(weightKg !== undefined ? { weightKg } : {}),
          editedAt: new Date(),
          editedByStaffId: staffUserId,
        },
      });
      if (weightKg !== undefined) {
        // Correct the farmer's running total by the delta rather than recomputing
        // from scratch, so this stays a cheap single-row update either way.
        const delta = weightKg - Number(existing.weightKg);
        await tx.farmer.update({
          where: { id: existing.farmerId },
          data: { cumulativeWeightKg: { increment: delta } },
        });
      }
      return [updated] as const;
    });
    res.json(await presentReceipt(receipt));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ error: `Receipt number ${receiptNumber ?? ""} has already been recorded` });
    }
    throw err;
  }
}));

receiptsRouter.patch("/:id/settle", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const parsed = settleReceiptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const organizationId = authOrgId(req);
  const staffUserId = req.auth!.kind === "staff" ? req.auth!.staffUserId : "";

  const existing = await prisma.receipt.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) {
    return res.status(404).json({ error: "Receipt not found" });
  }

  const receipt = await prisma.receipt.update({
    where: { id: existing.id },
    data: parsed.data.settled
      ? { settled: true, settledAt: new Date(), settledByStaffId: staffUserId }
      : { settled: false, settledAt: null, settledByStaffId: null },
  });
  res.json(await presentReceipt(receipt));
}));

function formatAutoReceiptNumber(orgSlug: string, sequence: number): string {
  const prefix = orgSlug.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() || "RCT";
  return `${prefix}-${String(sequence).padStart(6, "0")}`;
}

receiptsRouter.post("/", upload.single("photo"), asyncHandler(async (req, res) => {
  const parsed = createReceiptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const organizationId = authOrgId(req);
  const staffUserId = req.auth!.kind === "staff" ? req.auth!.staffUserId : "";
  const { farmerId, receiptNumber, weightKg, clientId, deliveredAt } = parsed.data;

  // Idempotency: if this client-generated receipt already synced, return it as-is
  // instead of erroring, so a retried offline sync is always safe.
  const existing = await prisma.receipt.findUnique({
    where: { organizationId_clientId: { organizationId, clientId } },
  });
  if (existing) {
    return res.status(200).json(await presentReceipt(existing));
  }

  const farmer = await prisma.farmer.findFirst({ where: { id: farmerId, organizationId } });
  if (!farmer) {
    return res.status(404).json({ error: "Farmer not found" });
  }

  if (receiptNumber) {
    const duplicateNumber = await prisma.receipt.findUnique({
      where: { organizationId_receiptNumber: { organizationId, receiptNumber } },
    });
    if (duplicateNumber) {
      return res.status(409).json({ error: `Receipt number ${receiptNumber} has already been recorded` });
    }
  }

  let photoUrl: string | null = null;
  if (req.file) {
    photoUrl = await getObjectStorage().save(
      `${organizationId}/receipts/${clientId}${ALLOWED_PHOTO_TYPES[req.file.mimetype]}`,
      {
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
      }
    );
  }

  let receipt, updatedFarmer;
  try {
    [receipt, updatedFarmer] = await prisma.$transaction(async (tx) => {
      let finalReceiptNumber = receiptNumber;
      if (!finalReceiptNumber) {
        // Atomically claim the next sequence number for this organization so two
        // concurrent auto-generated receipts can never collide.
        const org = await tx.organization.update({
          where: { id: organizationId },
          data: { receiptSequence: { increment: 1 } },
        });
        finalReceiptNumber = formatAutoReceiptNumber(org.slug, org.receiptSequence);
      }

      const createdReceipt = await tx.receipt.create({
        data: {
          organizationId,
          farmerId,
          receiptNumber: finalReceiptNumber,
          weightKg,
          photoUrl,
          recordedByStaffId: staffUserId,
          clientId,
          deliveredAt,
        },
      });
      const farmerAfter = await tx.farmer.update({
        where: { id: farmerId },
        data: { cumulativeWeightKg: { increment: weightKg } },
      });
      return [createdReceipt, farmerAfter] as const;
    });
  } catch (err) {
    // Guards against a race where two requests pass the earlier duplicate checks
    // concurrently -- the unique constraints on (organizationId, receiptNumber) and
    // (organizationId, clientId) are the real source of truth.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ error: `Receipt number ${receiptNumber ?? ""} has already been recorded` });
    }
    throw err;
  }

  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const sms = createNotificationProvider(organization.smsSenderName);
  await sms
    .sendSms(
      farmer.phone,
      `Receipt ${receipt.receiptNumber}: ${weightKg}kg cherry received. Your cumulative total is now ${updatedFarmer.cumulativeWeightKg}kg. - ${organization.name}`
    )
    .catch((err) => console.error("Failed to send receipt SMS:", err));

  res.status(201).json(await presentReceipt(receipt));
}));
