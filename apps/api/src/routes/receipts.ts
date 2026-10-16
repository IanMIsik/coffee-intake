import { Prisma } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import {
  adjustReceiptSchema,
  createReceiptSchema,
  deleteReceiptSchema,
  recordSettlementSchema,
  settleReceiptSchema,
} from "@coffee/shared";
import { prisma } from "../db";
import { authOrgId, requireAuth, requireRole, requireStaff } from "../auth/middleware";
import { getObjectStorage } from "../storage";
import { createNotificationProvider } from "../notifications";
import { asyncHandler } from "../lib/asyncHandler";
import { hideMoneyFromClerks } from "../lib/redact";
import { presentReceipt, presentReceipts } from "../lib/photos";
import { SettlementError, lockReceipts, payForReceipt, recomputeReceipt } from "../lib/settlements";

const isAdmin = (req: { auth?: { kind: string; role?: string } }) =>
  req.auth?.kind === "staff" && req.auth.role === "ADMIN";

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

receiptsRouter.use(requireAuth, requireStaff, hideMoneyFromClerks);

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

// Admin: the audit trail of deleted delivery records.
receiptsRouter.get("/deleted", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const farmerId = typeof req.query.farmerId === "string" ? req.query.farmerId : undefined;
  const rows = await prisma.receiptDeletion.findMany({
    where: { organizationId: authOrgId(req), ...(farmerId ? { farmerId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(
    rows.map((r) => ({
      id: r.id,
      receiptNumber: r.receiptNumber,
      farmerId: r.farmerId,
      farmerName: r.farmerName,
      weightKg: r.weightKg.toString(),
      deliveredAt: r.deliveredAt.toISOString(),
      recordedByName: r.recordedByName,
      deletedByName: r.deletedByName,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    }))
  );
}));

receiptsRouter.get("/:id", asyncHandler(async (req, res) => {
  const receipt = await prisma.receipt.findFirst({
    where: { id: req.params.id, organizationId: authOrgId(req) },
    include: {
      settlements: { orderBy: { createdAt: "asc" } },
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
  const { weightKg, receiptNumber, pricePerKg } = parsed.data;
  if (weightKg === undefined && receiptNumber === undefined && pricePerKg === undefined) {
    return res.status(400).json({ error: "Nothing to update" });
  }
  if (pricePerKg !== undefined && !isAdmin(req)) {
    return res.status(403).json({ error: "Only an admin can set or change prices" });
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
      await lockReceipts(tx, [existing.id]);
      const current = await tx.receipt.findUniqueOrThrow({ where: { id: existing.id } });
      if (weightKg !== undefined && current.settledKg.gt(weightKg)) {
        throw new SettlementError(
          isAdmin(req)
            ? `${current.settledKg.toFixed(2)} kg of this delivery has already been paid, so the weight can't be set below that`
            : "This delivery has already been partly settled, so the weight can't be lowered. Ask an admin."
        );
      }
      let updated = await tx.receipt.update({
        where: { id: existing.id },
        data: {
          ...(receiptNumber !== undefined ? { receiptNumber } : {}),
          ...(weightKg !== undefined ? { weightKg } : {}),
          ...(pricePerKg !== undefined ? { pricePerKg, batchId: null } : {}),
          editedAt: new Date(),
          editedByStaffId: staffUserId,
        },
      });
      if (weightKg !== undefined) {
        // Correct the farmer's running total by the delta rather than recomputing
        // from scratch, so this stays a cheap single-row update either way.
        const delta = weightKg - Number(current.weightKg);
        await tx.farmer.update({
          where: { id: existing.farmerId },
          data: { cumulativeWeightKg: { increment: delta } },
        });
        // A longer delivery that was fully paid is now partly unpaid, and the reverse.
        updated = await recomputeReceipt(tx, existing.id);
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

// Admin: delete a delivery that was entered by mistake. Clerks can only edit. A delivery with
// payments on it can't be deleted until those payments are voided, so money is never orphaned.
// The record leaves every total, and a snapshot is kept in the deletion log.
receiptsRouter.delete("/:id", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const parsed = deleteReceiptSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const organizationId = authOrgId(req);
  const staffUserId = req.auth!.kind === "staff" ? req.auth!.staffUserId : "";

  const existing = await prisma.receipt.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) {
    return res.status(404).json({ error: "Receipt not found" });
  }

  await prisma.$transaction(async (tx) => {
    await lockReceipts(tx, [existing.id]);
    const receipt = await tx.receipt.findUniqueOrThrow({
      where: { id: existing.id },
      include: { farmer: true, recordedByStaff: true, settlements: true },
    });
    if (receipt.settlements.some((s) => !s.voidedAt)) {
      throw new SettlementError(
        "This delivery has payments recorded against it. Void those payments first, then delete it."
      );
    }
    const admin = await tx.staffUser.findUniqueOrThrow({ where: { id: staffUserId } });
    const { farmer, recordedByStaff, settlements, ...fields } = receipt;
    await tx.receiptDeletion.create({
      data: {
        organizationId,
        receiptNumber: receipt.receiptNumber,
        farmerId: receipt.farmerId,
        farmerName: farmer.name,
        weightKg: receipt.weightKg,
        deliveredAt: receipt.deliveredAt,
        recordedByName: recordedByStaff.name,
        deletedByStaffId: staffUserId,
        deletedByName: admin.name,
        reason: parsed.data.reason,
        snapshot: JSON.parse(JSON.stringify({ receipt: fields, voidedSettlements: settlements })),
      },
    });
    await tx.settlement.deleteMany({ where: { receiptId: receipt.id } });
    await tx.receipt.delete({ where: { id: receipt.id } });
    await tx.farmer.update({
      where: { id: receipt.farmerId },
      data: { cumulativeWeightKg: { decrement: receipt.weightKg } },
    });
  });

  res.json({ ok: true });
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

  // Older app versions use this on/off switch. "Settled" pays whatever is still unpaid (at the
  // delivery's price, if it has one); "not settled" voids every payment on the delivery.
  const receipt = await prisma.$transaction(async (tx) => {
    await lockReceipts(tx, [existing.id]);
    if (parsed.data.settled) {
      const current = await tx.receipt.findUniqueOrThrow({ where: { id: existing.id } });
      const remaining = current.weightKg.minus(current.settledKg);
      if (remaining.gt(0)) {
        await payForReceipt(tx, { receiptId: existing.id, weightKg: remaining, pricePerKg: null, staffId: staffUserId });
      }
    } else {
      await tx.settlement.updateMany({
        where: { receiptId: existing.id, voidedAt: null },
        data: { voidedAt: new Date(), voidedByStaffId: staffUserId },
      });
    }
    return recomputeReceipt(tx, existing.id);
  });
  res.json(await presentReceipt(receipt));
}));

// Record a payment for some (or all) of one delivery.
receiptsRouter.post("/:id/settlements", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const parsed = recordSettlementSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const organizationId = authOrgId(req);
  const staffUserId = req.auth!.kind === "staff" ? req.auth!.staffUserId : "";
  const existing = await prisma.receipt.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) {
    return res.status(404).json({ error: "Receipt not found" });
  }

  const result = await prisma.$transaction(async (tx) => {
    await lockReceipts(tx, [existing.id]);
    const current = await tx.receipt.findUniqueOrThrow({ where: { id: existing.id } });
    const weight =
      parsed.data.weightKg !== undefined
        ? new Prisma.Decimal(parsed.data.weightKg)
        : current.weightKg.minus(current.settledKg);
    const settlement = await payForReceipt(tx, {
      receiptId: existing.id,
      weightKg: weight,
      pricePerKg: parsed.data.pricePerKg !== undefined ? new Prisma.Decimal(parsed.data.pricePerKg) : null,
      note: parsed.data.note,
      staffId: staffUserId,
    });
    return { settlement, receipt: await tx.receipt.findUniqueOrThrow({ where: { id: existing.id } }) };
  });
  res.status(201).json({ settlement: result.settlement, receipt: await presentReceipt(result.receipt) });
}));

// Void a payment: it stays in the record but stops counting.
receiptsRouter.delete("/:id/settlements/:settlementId", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const organizationId = authOrgId(req);
  const staffUserId = req.auth!.kind === "staff" ? req.auth!.staffUserId : "";
  const settlement = await prisma.settlement.findFirst({
    where: { id: req.params.settlementId, receiptId: req.params.id, organizationId, voidedAt: null },
  });
  if (!settlement) {
    return res.status(404).json({ error: "Payment not found" });
  }
  const receipt = await prisma.$transaction(async (tx) => {
    await lockReceipts(tx, [settlement.receiptId]);
    await tx.settlement.update({
      where: { id: settlement.id },
      data: { voidedAt: new Date(), voidedByStaffId: staffUserId },
    });
    return recomputeReceipt(tx, settlement.receiptId);
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
  const { farmerId, receiptNumber, weightKg, clientId, deliveredAt, pricePerKg } = parsed.data;
  if (pricePerKg !== undefined && !isAdmin(req)) {
    return res.status(403).json({ error: "Only an admin can set prices" });
  }

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
  if (farmer.archivedAt) {
    return res.status(409).json({ error: `${farmer.name} has been removed from the list. Restore them to record new deliveries.` });
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
          ...(pricePerKg !== undefined ? { pricePerKg } : {}),
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
      `Receipt ${receipt.receiptNumber}: ${weightKg}kg cherry received. Your cumulative total is now ${updatedFarmer.cumulativeWeightKg}kg.`
    )
    .catch((err) => console.error("Failed to send receipt SMS:", err));

  res.status(201).json(await presentReceipt(receipt));
}));
