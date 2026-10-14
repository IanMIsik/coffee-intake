import bcrypt from "bcryptjs";
import { Router } from "express";
import {
  changePasswordSchema,
  otpRequestSchema,
  otpVerifySchema,
  staffLoginSchema,
} from "@coffee/shared";
import { prisma } from "../db";
import { signToken } from "../auth/jwt";
import { requireAuth, requireStaff } from "../auth/middleware";
import { compareOtpCode, generateOtpCode, hashOtpCode, OTP_TTL_MS } from "../auth/otp";
import { createNotificationProvider } from "../notifications";
import { asyncHandler } from "../lib/asyncHandler";

export const authRouter = Router();

authRouter.post("/staff/login", asyncHandler(async (req, res) => {
  const parsed = staffLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { organizationSlug, phone, password } = parsed.data;

  const organization = await prisma.organization.findUnique({
    where: { slug: organizationSlug },
  });
  if (!organization) {
    return res.status(404).json({ error: "Unknown organization" });
  }

  const staff = await prisma.staffUser.findUnique({
    where: { organizationId_phone: { organizationId: organization.id, phone } },
  });
  if (!staff || !(await bcrypt.compare(password, staff.passwordHash))) {
    return res.status(401).json({ error: "Invalid phone number or password" });
  }

  const token = signToken({
    kind: "staff",
    staffUserId: staff.id,
    organizationId: staff.organizationId,
    role: staff.role,
  });

  res.json({
    token,
    staff: {
      id: staff.id,
      organizationId: staff.organizationId,
      name: staff.name,
      phone: staff.phone,
      email: staff.email,
      role: staff.role,
      createdAt: staff.createdAt,
    },
    organization,
  });
}));

authRouter.post("/staff/change-password", requireAuth, requireStaff, asyncHandler(async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const staffUserId = req.auth!.kind === "staff" ? req.auth!.staffUserId : "";

  const staff = await prisma.staffUser.findUnique({ where: { id: staffUserId } });
  if (!staff || !(await bcrypt.compare(parsed.data.currentPassword, staff.passwordHash))) {
    return res.status(400).json({ error: "Your current password is incorrect" });
  }

  await prisma.staffUser.update({
    where: { id: staff.id },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.newPassword, 10),
      // Signs every other device out; this device gets the fresh token below.
      passwordChangedAt: new Date(),
    },
  });

  const token = signToken({
    kind: "staff",
    staffUserId: staff.id,
    organizationId: staff.organizationId,
    role: staff.role,
  });
  res.json({ token });
}));

authRouter.post("/farmer/otp/request", asyncHandler(async (req, res) => {
  const parsed = otpRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { phone, organizationSlug } = parsed.data;

  const organization = await prisma.organization.findUnique({
    where: { slug: organizationSlug },
  });
  if (!organization) {
    return res.status(404).json({ error: "Unknown organization" });
  }

  const farmer = await prisma.farmer.findUnique({
    where: { organizationId_phone: { organizationId: organization.id, phone } },
  });
  if (!farmer) {
    // Don't reveal whether the phone number is registered.
    return res.json({ ok: true });
  }

  const code = generateOtpCode();
  await prisma.otpCode.create({
    data: {
      organizationId: organization.id,
      phone,
      codeHash: await hashOtpCode(code),
      purpose: "FARMER_LOGIN",
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  const sms = createNotificationProvider(organization.smsSenderName);
  await sms.sendSms(phone, `Your ${organization.name} login code is ${code}. It expires in 5 minutes.`);

  res.json({ ok: true });
}));

authRouter.post("/farmer/otp/verify", asyncHandler(async (req, res) => {
  const parsed = otpVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { phone, organizationSlug, code } = parsed.data;

  const organization = await prisma.organization.findUnique({
    where: { slug: organizationSlug },
  });
  if (!organization) {
    return res.status(404).json({ error: "Unknown organization" });
  }

  const farmer = await prisma.farmer.findUnique({
    where: { organizationId_phone: { organizationId: organization.id, phone } },
  });
  if (!farmer) {
    return res.status(401).json({ error: "Invalid code" });
  }

  // The few most recent live codes are all accepted, so a code that arrives late (after
  // the farmer asked for a second one) still works. Each code allows only a handful of
  // wrong guesses, which makes guessing a 6-digit code impractical.
  const MAX_WRONG_GUESSES = 5;
  const liveCodes = await prisma.otpCode.findMany({
    where: {
      organizationId: organization.id,
      phone,
      purpose: "FARMER_LOGIN",
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  const usable = liveCodes.filter((c) => c.attempts < MAX_WRONG_GUESSES);
  if (liveCodes.length > 0 && usable.length === 0) {
    return res.status(429).json({ error: "Too many wrong codes. Request a new code." });
  }

  let matched: (typeof usable)[number] | undefined;
  for (const candidate of usable) {
    if (await compareOtpCode(code, candidate.codeHash)) {
      matched = candidate;
      break;
    }
  }
  if (!matched) {
    if (usable.length > 0) {
      await prisma.otpCode.updateMany({
        where: { id: { in: usable.map((c) => c.id) } },
        data: { attempts: { increment: 1 } },
      });
    }
    return res.status(401).json({ error: "Invalid or expired code" });
  }

  // One successful login uses up every live code for this number.
  await prisma.otpCode.updateMany({
    where: { id: { in: liveCodes.map((c) => c.id) } },
    data: { consumedAt: new Date() },
  });

  const token = signToken({
    kind: "farmer",
    farmerId: farmer.id,
    organizationId: organization.id,
  });

  res.json({ token, farmer, organization });
}));
