import bcrypt from "bcryptjs";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";

export const app = createApp({ rateLimit: false });
export { prisma };

export const PASSWORD = "testpass123";

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Settlement","OtpCode","Receipt","Farmer","StaffUser","Organization" RESTART IDENTITY CASCADE'
  );
}

export function makeOrg(slug: string, extra: { timezone?: string } = {}) {
  return prisma.organization.create({
    data: { name: `Org ${slug}`, slug, smsSenderName: "Test", ...extra },
  });
}

export async function makeStaff(
  organizationId: string,
  phone: string,
  role: "ADMIN" | "CLERK",
  name = `${role} ${phone}`
) {
  return prisma.staffUser.create({
    data: { organizationId, phone, role, name, passwordHash: await bcrypt.hash(PASSWORD, 4) },
  });
}

export function makeFarmer(organizationId: string, phone: string, name = `Farmer ${phone}`) {
  return prisma.farmer.create({ data: { organizationId, phone, name } });
}

export async function login(slug: string, phone: string, password = PASSWORD): Promise<string> {
  const res = await request(app).post("/auth/staff/login").send({ organizationSlug: slug, phone, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let counter = 0;
export function newReceipt(farmerId: string, over: Record<string, unknown> = {}) {
  counter += 1;
  return {
    farmerId,
    weightKg: 10,
    clientId: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    deliveredAt: new Date().toISOString(),
    ...over,
  };
}
