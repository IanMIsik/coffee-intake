import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { app, auth, login, makeFarmer, makeOrg, makeStaff, newReceipt, prisma, resetDb } from "./helpers";

const recorded = (token: string, body: Record<string, unknown>) => {
  const req = request(app).post("/receipts").set(auth(token));
  for (const [k, v] of Object.entries(body)) if (v !== undefined) req.field(k, String(v));
  return req;
};

describe("prices and payments", () => {
  let admin: string;
  let clerk: string;
  let otherAdmin: string;
  let farmerId: string;
  let farmerPhone: string;

  async function delivery(kg: number, price?: number, at = new Date().toISOString()) {
    const res = await recorded(admin, newReceipt(farmerId, { weightKg: kg, pricePerKg: price, deliveredAt: at }));
    expect(res.status).toBe(201);
    return res.body as { id: string; weightKg: string; pricePerKg: string | null; settledKg: string; settled: boolean };
  }
  const balance = async () =>
    (await request(app).get(`/farmers/${farmerId}`).set(auth(admin))).body.balance as Record<string, string>;

  beforeAll(async () => {
    await resetDb();
    const org = await makeOrg("pay");
    const other = await makeOrg("pay-other");
    await makeStaff(org.id, "+254700100001", "ADMIN");
    await makeStaff(org.id, "+254700100002", "CLERK");
    await makeStaff(other.id, "+254700100003", "ADMIN");
    farmerPhone = "+254700100010";
    farmerId = (await makeFarmer(org.id, farmerPhone, "Wanjiru")).id;
    admin = await login("pay", "+254700100001");
    clerk = await login("pay", "+254700100002");
    otherAdmin = await login("pay-other", "+254700100003");
  });

  it("lets only an admin key in or change a price", async () => {
    const byClerk = await recorded(clerk, newReceipt(farmerId, { pricePerKg: 90 }));
    expect(byClerk.status).toBe(403);
    const withPrice = await delivery(10, 85);
    expect(withPrice.pricePerKg).toBe("85");
    const noPrice = await delivery(10);
    expect(noPrice.pricePerKg).toBeNull();

    expect((await request(app).patch(`/receipts/${noPrice.id}`).set(auth(clerk)).send({ pricePerKg: 80 })).status).toBe(403);
    const set = await request(app).patch(`/receipts/${noPrice.id}`).set(auth(admin)).send({ pricePerKg: 80 });
    expect(set.status).toBe(200);
    expect(set.body.pricePerKg).toBe("80");
    expect((await request(app).patch(`/receipts/${noPrice.id}`).set(auth(admin)).send({ pricePerKg: -5 })).status).toBe(400);
  });

  it("supports paying for part of a delivery, then the rest", async () => {
    const r = await delivery(100, 80);

    const part = await request(app).post(`/receipts/${r.id}/settlements`).set(auth(admin)).send({ weightKg: 40 });
    expect(part.status).toBe(201);
    expect(part.body.settlement.amount).toBe("3200");
    expect(part.body.receipt.settledKg).toBe("40");
    expect(part.body.receipt.settled).toBe(false);

    const tooMuch = await request(app).post(`/receipts/${r.id}/settlements`).set(auth(admin)).send({ weightKg: 61 });
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.body.error).toMatch(/Only 60\.00 kg/);

    // No kilos given = pay everything still unpaid, here at a different price than the delivery's.
    const rest = await request(app).post(`/receipts/${r.id}/settlements`).set(auth(admin)).send({ pricePerKg: 90, note: "Lot 2" });
    expect(rest.status).toBe(201);
    expect(rest.body.settlement.weightKg).toBe("60");
    expect(rest.body.settlement.amount).toBe("5400");
    expect(rest.body.receipt.settled).toBe(true);

    const detail = await request(app).get(`/receipts/${r.id}`).set(auth(admin));
    expect(detail.body.settlements).toHaveLength(2);
    expect((await request(app).post(`/receipts/${r.id}/settlements`).set(auth(admin)).send({ weightKg: 1 })).status).toBe(400);
  });

  it("voids a payment without deleting the record", async () => {
    const r = await delivery(50, 100);
    const paid = await request(app).post(`/receipts/${r.id}/settlements`).set(auth(admin)).send({});
    expect(paid.body.receipt.settled).toBe(true);

    const voided = await request(app).delete(`/receipts/${r.id}/settlements/${paid.body.settlement.id}`).set(auth(admin));
    expect(voided.status).toBe(200);
    expect(voided.body.settled).toBe(false);
    expect(voided.body.settledKg).toBe("0");
    const row = await prisma.settlement.findUniqueOrThrow({ where: { id: paid.body.settlement.id } });
    expect(row.voidedAt).not.toBeNull();
    expect((await request(app).delete(`/receipts/${r.id}/settlements/${paid.body.settlement.id}`).set(auth(admin))).status).toBe(404);
  });

  it("pays a farmer by kilos, oldest deliveries first, across several deliveries", async () => {
    await resetFarmer();
    const a = await delivery(50, 80, "2026-10-01T08:00:00Z");
    const b = await delivery(50, 82, "2026-10-02T08:00:00Z");
    const c = await delivery(50, 84, "2026-10-03T08:00:00Z");

    const res = await request(app).post(`/farmers/${farmerId}/settlements`).set(auth(admin)).send({ weightKg: 120, pricePerKg: 90 });
    expect(res.status).toBe(201);
    expect(res.body.settlements.map((s: { receiptId: string; weightKg: string }) => [s.receiptId, s.weightKg])).toEqual([
      [a.id, "50"],
      [b.id, "50"],
      [c.id, "20"],
    ]);
    // 120 kg at 90, and 30 kg of the last delivery still owed at its own price of 84.
    expect(res.body.balance.amountPaid).toBe("10800");
    expect(res.body.balance.unsettledKg).toBe("30");
    expect(res.body.balance.amountOwed).toBe("2520");

    const receipts = (await request(app).get(`/farmers/${farmerId}`).set(auth(admin))).body.receipts as {
      id: string;
      settledKg: string;
      settled: boolean;
    }[];
    const byId = Object.fromEntries(receipts.map((r) => [r.id, r]));
    expect(byId[a.id].settled).toBe(true);
    expect(byId[c.id].settledKg).toBe("20");
    expect(byId[c.id].settled).toBe(false);
  });

  it("refuses to pay for more kilos than are unpaid, and records nothing", async () => {
    await resetFarmer();
    await delivery(30, 80);
    await delivery(20, 80);
    const before = await prisma.settlement.count();
    const res = await request(app).post(`/farmers/${farmerId}/settlements`).set(auth(admin)).send({ weightKg: 51, pricePerKg: 80 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/only has 50\.00 kg unpaid/);
    expect(await prisma.settlement.count()).toBe(before);
    expect((await balance()).unsettledKg).toBe("50");
  });

  it("works out the amount owed, and flags kilos that have no price yet", async () => {
    await resetFarmer();
    await delivery(100, 80);
    await delivery(40); // no price
    await request(app).post(`/farmers/${farmerId}/settlements`).set(auth(admin)).send({ weightKg: 25, pricePerKg: 80 });
    const b = await balance();
    expect(b.deliveredKg).toBe("140");
    expect(b.settledKg).toBe("25");
    expect(b.amountOwed).toBe("6000"); // 75 kg left of the priced delivery at 80
    expect(b.unpricedKg).toBe("40");

    const bulk = await request(app).post(`/farmers/${farmerId}/price`).set(auth(admin)).send({ pricePerKg: 70 });
    expect(bulk.body.updated).toBe(1); // only the unpriced one by default
    const after = await balance();
    expect(after.unpricedKg).toBe("0");
    expect(after.amountOwed).toBe("8800"); // 75 * 80 + 40 * 70
  });

  it("won't lower a delivery's weight below what has already been paid", async () => {
    await resetFarmer();
    const r = await delivery(100, 80);
    await request(app).post(`/receipts/${r.id}/settlements`).set(auth(admin)).send({ weightKg: 60 });
    const low = await request(app).patch(`/receipts/${r.id}`).set(auth(admin)).send({ weightKg: 50 });
    expect(low.status).toBe(400);
    expect(low.body.error).toMatch(/already been paid/);
    const ok = await request(app).patch(`/receipts/${r.id}`).set(auth(admin)).send({ weightKg: 80 });
    expect(ok.status).toBe(200);
    // Making a fully paid delivery heavier leaves the extra kilos unpaid.
    await request(app).post(`/receipts/${r.id}/settlements`).set(auth(admin)).send({});
    const heavier = await request(app).patch(`/receipts/${r.id}`).set(auth(admin)).send({ weightKg: 90 });
    expect(heavier.body.settled).toBe(false);
    expect(heavier.body.settledKg).toBe("80");
  });

  it("keeps the older settled on/off switch working", async () => {
    await resetFarmer();
    const r = await delivery(40, 50);
    const on = await request(app).patch(`/receipts/${r.id}/settle`).set(auth(admin)).send({ settled: true });
    expect(on.body.settled).toBe(true);
    expect(on.body.settledKg).toBe("40");
    expect((await balance()).amountPaid).toBe("2000");
    const off = await request(app).patch(`/receipts/${r.id}/settle`).set(auth(admin)).send({ settled: false });
    expect(off.body.settled).toBe(false);
    expect((await balance()).amountPaid).toBe("0");
  });

  it("keeps money actions admin-only and inside the organization", async () => {
    await resetFarmer();
    const r = await delivery(10, 80);
    expect((await request(app).post(`/receipts/${r.id}/settlements`).set(auth(clerk)).send({})).status).toBe(403);
    expect((await request(app).post(`/farmers/${farmerId}/settlements`).set(auth(clerk)).send({ weightKg: 1 })).status).toBe(403);
    expect((await request(app).post(`/farmers/${farmerId}/price`).set(auth(clerk)).send({ pricePerKg: 1 })).status).toBe(403);
    expect((await request(app).post(`/receipts/${r.id}/settlements`).set(auth(otherAdmin)).send({})).status).toBe(404);
    expect((await request(app).post(`/farmers/${farmerId}/settlements`).set(auth(otherAdmin)).send({ weightKg: 1 })).status).toBe(404);
    expect((await request(app).post(`/farmers/${farmerId}/price`).set(auth(otherAdmin)).send({ pricePerKg: 1 })).status).toBe(404);
  });

  it("never lets two admins spend the same kilos at once", async () => {
    await resetFarmer();
    const r = await delivery(100, 80);
    const results = await Promise.all(
      Array.from({ length: 4 }, () => request(app).post(`/receipts/${r.id}/settlements`).set(auth(admin)).send({ weightKg: 60 }))
    );
    expect(results.filter((x) => x.status === 201)).toHaveLength(1);
    expect(results.filter((x) => x.status === 400)).toHaveLength(3);
    const row = await prisma.receipt.findUniqueOrThrow({ where: { id: r.id } });
    expect(Number(row.settledKg)).toBe(60);
  });

  it("shows the farmer their own balance, and the admin the money on the dashboard", async () => {
    await resetFarmer();
    await delivery(100, 80);
    await delivery(20); // unpriced
    await request(app).post(`/farmers/${farmerId}/settlements`).set(auth(admin)).send({ weightKg: 30, pricePerKg: 80 });

    const dash = await request(app).get("/dashboard/summary").set(auth(admin));
    // The apps read these as numbers, so compare values, not text formatting.
    expect(Number(dash.body.amountOwed)).toBe(5600); // 70 kg at 80
    expect(Number(dash.body.unpricedKg)).toBe(20);
    expect(Number(dash.body.unsettledKgAllTime)).toBe(90);
    expect(Number(dash.body.rangeTotals.amountPaid)).toBe(2400);
    expect(Number(dash.body.unsettledFarmers[0].amountOwed)).toBe(5600);

    // The farmer signs in with a code and sees the same figures.
    const { hashOtpCode } = await import("../src/auth/otp");
    const org = await prisma.organization.findFirstOrThrow({ where: { slug: "pay" } });
    await prisma.otpCode.create({
      data: { organizationId: org.id, phone: farmerPhone, codeHash: await hashOtpCode("424242"), purpose: "FARMER_LOGIN", expiresAt: new Date(Date.now() + 60_000) },
    });
    const session = await request(app).post("/auth/farmer/otp/verify").send({ organizationSlug: "pay", phone: farmerPhone, code: "424242" });
    const me = await request(app).get("/farmers/me").set(auth(session.body.token));
    expect(Number(me.body.balance.amountOwed)).toBe(5600);
    expect(Number(me.body.balance.amountPaid)).toBe(2400);
  });

  async function resetFarmer() {
    await prisma.settlement.deleteMany({ where: { farmerId } });
    await prisma.receipt.deleteMany({ where: { farmerId } });
    await prisma.farmer.update({ where: { id: farmerId }, data: { cumulativeWeightKg: 0 } });
  }
});
