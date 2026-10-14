import bcrypt from "bcryptjs";
import { Router } from "express";
import { createOrganizationSchema } from "@coffee/shared";
import { prisma } from "../db";
import { env } from "../env";
import { asyncHandler } from "../lib/asyncHandler";
import { safeEqual } from "../lib/safeEqual";

export const orgsRouter = Router();

/**
 * Provisions a new organization (factory/cooperative) plus its first admin account.
 * Not exposed to any client app -- only whoever is onboarding a new tenant should
 * hold ORG_PROVISIONING_SECRET, e.g. to run this via curl/Postman once per new customer.
 */
orgsRouter.post("/", asyncHandler(async (req, res) => {
  if (!safeEqual(req.headers["x-provisioning-secret"], env.orgProvisioningSecret)) {
    return res.status(403).json({ error: "Invalid provisioning secret" });
  }

  const parsed = createOrganizationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, slug, smsSenderName, adminName, adminPhone, adminPassword } = parsed.data;

  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) {
    return res.status(409).json({ error: `Slug "${slug}" is already taken` });
  }

  const organization = await prisma.organization.create({
    data: {
      name,
      slug,
      smsSenderName,
      staffUsers: {
        create: {
          name: adminName,
          phone: adminPhone,
          passwordHash: await bcrypt.hash(adminPassword, 10),
          role: "ADMIN",
        },
      },
    },
    include: { staffUsers: true },
  });

  res.status(201).json(organization);
}));
