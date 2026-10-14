import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { createStaffUserSchema, resetStaffPasswordSchema, updateStaffRoleSchema } from "@coffee/shared";
import { prisma } from "../db";
import { authOrgId, requireAuth, requireRole } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";

export const staffRouter = Router();

staffRouter.use(requireAuth, requireRole("ADMIN"));

const publicStaffFields = {
  id: true,
  organizationId: true,
  name: true,
  phone: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

staffRouter.get("/", asyncHandler(async (req, res) => {
  const staff = await prisma.staffUser.findMany({
    where: { organizationId: authOrgId(req), deletedAt: null },
    orderBy: { name: "asc" },
    select: publicStaffFields,
  });
  res.json(staff);
}));

staffRouter.post("/", asyncHandler(async (req, res) => {
  const parsed = createStaffUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const organizationId = authOrgId(req);

  const existing = await prisma.staffUser.findUnique({
    where: { organizationId_phone: { organizationId, phone: parsed.data.phone } },
  });
  if (existing) {
    return res.status(409).json({ error: "A staff account with this phone number already exists" });
  }

  const staff = await prisma.staffUser.create({
    data: {
      organizationId,
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email ?? null,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: parsed.data.role,
    },
    select: publicStaffFields,
  });

  res.status(201).json(staff);
}));

staffRouter.patch("/:id", asyncHandler(async (req, res) => {
  const parsed = updateStaffRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const organizationId = authOrgId(req);
  const actorId = req.auth!.kind === "staff" ? req.auth!.staffUserId : "";

  const target = await prisma.staffUser.findFirst({
    where: { id: req.params.id, organizationId, deletedAt: null },
  });
  if (!target) {
    return res.status(404).json({ error: "Staff account not found" });
  }
  // Another admin always remains if the actor is demoting someone else, so the only
  // way to end up with no admin is demoting yourself.
  if (target.id === actorId) {
    return res.status(400).json({ error: "You can't change your own role" });
  }

  const updated = await prisma.staffUser.update({
    where: { id: target.id },
    data: { role: parsed.data.role },
    select: publicStaffFields,
  });
  res.json(updated);
}));

// No 0/O/1/l/I so a temporary password can be read out or typed without mistakes.
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generateTemporaryPassword(length = 10): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PASSWORD_ALPHABET[crypto.randomInt(PASSWORD_ALPHABET.length)];
  }
  return out;
}

staffRouter.post("/:id/password", asyncHandler(async (req, res) => {
  const parsed = resetStaffPasswordSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const organizationId = authOrgId(req);

  const target = await prisma.staffUser.findFirst({
    where: { id: req.params.id, organizationId, deletedAt: null },
  });
  if (!target) {
    return res.status(404).json({ error: "Staff account not found" });
  }

  const password = parsed.data.password ?? generateTemporaryPassword();
  await prisma.staffUser.update({
    where: { id: target.id },
    data: {
      passwordHash: await bcrypt.hash(password, 10),
      // Signs the person out of every device still using the old password.
      passwordChangedAt: new Date(),
    },
  });
  res.json({ ok: true, password });
}));

staffRouter.delete("/:id", asyncHandler(async (req, res) => {
  const organizationId = authOrgId(req);
  const actorId = req.auth!.kind === "staff" ? req.auth!.staffUserId : "";

  const target = await prisma.staffUser.findFirst({
    where: { id: req.params.id, organizationId, deletedAt: null },
  });
  if (!target) {
    return res.status(404).json({ error: "Staff account not found" });
  }
  if (target.id === actorId) {
    return res.status(400).json({ error: "You can't delete your own account" });
  }

  // Soft delete: receipts they recorded keep showing who recorded them. The phone is
  // suffixed so the number can be used for a new account later, and the account can
  // no longer log in (login looks accounts up by phone).
  await prisma.staffUser.update({
    where: { id: target.id },
    data: {
      deletedAt: new Date(),
      phone: `${target.phone}#deleted-${target.id.slice(0, 8)}`,
    },
  });
  res.json({ ok: true });
}));
