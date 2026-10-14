import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { hashOtpCode } from "../src/auth/otp";
import { app, auth, login, makeFarmer, makeOrg, makeStaff, newReceipt, prisma, resetDb } from "./helpers";

async function seedCode(organizationId: string, phone: string, code: string, ageMs = 0) {
  return prisma.otpCode.create({
    data: {
      organizationId,
      phone,
      codeHash: await hashOtpCode(code),
      purpose: "FARMER_LOGIN",
      expiresAt: new Date(Date.now() + 5 * 60_000 - ageMs),
      createdAt: new Date(Date.now() - ageMs),
    },
  });
}

describe("farmer login codes", () => {
  let orgId: string;
  const verify = (phone: string, code: string) =>
    request(app).post("/auth/farmer/otp/verify").send({ organizationSlug: "otp", phone, code });

  beforeAll(async () => {
    await resetDb();
    const org = await makeOrg("otp");
    orgId = org.id;
    await makeFarmer(org.id, "+254766000001", "Grace");
    await makeFarmer(org.id, "+254766000002", "Brute Forced");
    await makeFarmer(org.id, "+254766000003", "Late Text");
  });

  it("logs in with a correct code, once", async () => {
    await seedCode(orgId, "+254766000001", "123456");
    const ok = await verify("0766000001", "123456");
    expect(ok.status).toBe(200);
    expect(ok.body.farmer.name).toBe("Grace");
    expect((await verify("0766000001", "123456")).status).toBe(401);
  });

  it("locks a code after five wrong guesses, even if the right one is then tried", async () => {
    await seedCode(orgId, "+254766000002", "654321");
    for (let i = 0; i < 5; i++) {
      expect((await verify("+254766000002", "000000")).status).toBe(401);
    }
    const locked = await verify("+254766000002", "654321");
    expect(locked.status).toBe(429);
  });

  it("still accepts an earlier code that arrives after a second was requested", async () => {
    await seedCode(orgId, "+254766000003", "111111", 60_000);
    await seedCode(orgId, "+254766000003", "222222", 0);
    expect((await verify("+254766000003", "111111")).status).toBe(200);
  });

  it("rejects expired codes and unknown numbers without revealing which", async () => {
    await seedCode(orgId, "+254766000001", "999999", 6 * 60_000);
    expect((await verify("+254766000001", "999999")).status).toBe(401);
    expect((await verify("+254766999999", "123456")).status).toBe(401);
    const unknown = await request(app)
      .post("/auth/farmer/otp/request")
      .send({ organizationSlug: "otp", phone: "+254766999999" });
    expect(unknown.status).toBe(200); // same answer as for a real number
  });

  it("sends a code to a registered farmer", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await request(app)
      .post("/auth/farmer/otp/request")
      .send({ organizationSlug: "otp", phone: "0766000001" });
    expect(res.status).toBe(200);
    expect(log.mock.calls.some((c) => String(c[0]).includes("+254766000001") && /login code is \d{6}/.test(String(c[0])))).toBe(true);
    log.mockRestore();
  });
});

describe("dashboard days follow the organization's time zone", () => {
  let token: string;
  let farmerId: string;

  beforeAll(async () => {
    await resetDb();
    const org = await makeOrg("tz", { timezone: "Africa/Nairobi" });
    await makeStaff(org.id, "+254777000001", "ADMIN");
    await makeStaff(org.id, "+254777000002", "CLERK");
    farmerId = (await makeFarmer(org.id, "+254777000003")).id;
    token = await login("tz", "+254777000001");
    // 23:30 UTC on 14 Oct is 02:30 on 15 Oct in Nairobi (UTC+3).
    for (const [kg, at] of [[10, "2026-10-14T23:30:00Z"], [5, "2026-10-14T20:59:00Z"]] as const) {
      await prisma.receipt.create({
        data: {
          ...newReceipt(farmerId),
          organizationId: org.id,
          receiptNumber: `T-${kg}`,
          weightKg: kg,
          deliveredAt: new Date(at),
          recordedByStaffId: (await prisma.staffUser.findFirstOrThrow({ where: { role: "ADMIN" } })).id,
        },
      });
    }
  });

  it("puts a 02:30 Nairobi delivery on the Nairobi calendar day", async () => {
    const res = await request(app)
      .get("/dashboard/summary?from=2026-10-14&to=2026-10-15")
      .set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe("Africa/Nairobi");
    const byDay = Object.fromEntries(res.body.dailyBreakdown.map((d: { date: string; totalKg: string }) => [d.date, Number(d.totalKg)]));
    expect(byDay).toEqual({ "2026-10-14": 5, "2026-10-15": 10 });

    const day = await request(app).get("/dashboard/day?date=2026-10-15").set(auth(token));
    expect(Number(day.body.totalKg)).toBe(10);
  });

  it("is admin-only and validates dates", async () => {
    const clerk = await login("tz", "+254777000002");
    expect((await request(app).get("/dashboard/summary").set(auth(clerk))).status).toBe(403);
    expect((await request(app).get("/dashboard/day?date=nope").set(auth(token))).status).toBe(400);
  });
});

describe("rate limiting", () => {
  it("stops password guessing on an account, and blocks code flooding of one number", async () => {
    await resetDb();
    const org = await makeOrg("limits");
    await makeStaff(org.id, "+254788000001", "ADMIN");
    await makeFarmer(org.id, "+254788000002");
    const strict = createApp({ rateLimit: true });

    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = await request(strict)
        .post("/auth/staff/login")
        .send({ organizationSlug: "limits", phone: "0788000001", password: "wrong-wrong" });
      statuses.push(r.status);
    }
    expect(statuses.slice(0, 8).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(8).every((s) => s === 429)).toBe(true);

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      codes.push((await request(strict).post("/auth/farmer/otp/request").send({ organizationSlug: "limits", phone: "0788000002" })).status);
    }
    log.mockRestore();
    expect(codes.slice(0, 4).every((s) => s === 200)).toBe(true);
    expect(codes.slice(4).every((s) => s === 429)).toBe(true);
  });
});

describe("production configuration", () => {
  async function loadEnv(overrides: Record<string, string>) {
    vi.resetModules();
    const saved = { ...process.env };
    Object.assign(process.env, { NODE_ENV: "production", ...overrides });
    try {
      return await import("../src/env");
    } finally {
      process.env = saved;
    }
  }
  const good = {
    JWT_SECRET: "a".repeat(20) + "Zq9" + "b".repeat(20),
    ORG_PROVISIONING_SECRET: "c".repeat(20) + "Xy7" + "d".repeat(20),
    CORS_ORIGINS: "https://app.example.com",
  };

  it("starts with strong secrets and an explicit CORS allow-list", async () => {
    const { env } = await loadEnv(good);
    expect(env.isProduction).toBe(true);
    expect(env.corsOrigins).toEqual(["https://app.example.com"]);
  });

  it("refuses placeholder or short secrets", async () => {
    await expect(loadEnv({ ...good, JWT_SECRET: "replace-with-a-long-random-string" })).rejects.toThrow(/JWT_SECRET/);
    await expect(loadEnv({ ...good, ORG_PROVISIONING_SECRET: "short" })).rejects.toThrow(/ORG_PROVISIONING_SECRET/);
  });

  it("refuses to run production without a CORS allow-list", async () => {
    await expect(loadEnv({ ...good, CORS_ORIGINS: "" })).rejects.toThrow(/CORS_ORIGINS/);
  });
});

describe("health", () => {
  it("reports liveness and database readiness", async () => {
    expect((await request(app).get("/health")).body).toEqual({ ok: true });
    const ready = await request(app).get("/health/ready");
    expect(ready.status).toBe(200);
    expect(ready.body.database).toBe("up");
  });
});
