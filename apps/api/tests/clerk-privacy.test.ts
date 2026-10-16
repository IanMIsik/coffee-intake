import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { app, auth, login, makeFarmer, makeOrg, makeStaff, newReceipt } from "./helpers";

describe("money is hidden from clerks", () => {
  let admin: string;
  let clerk: string;
  let farmerId: string;
  let receiptId: string;

  beforeAll(async () => {
    const { resetDb } = await import("./helpers");
    await resetDb();
    const org = await makeOrg("priv");
    await makeStaff(org.id, "+254700500001", "ADMIN");
    await makeStaff(org.id, "+254700500002", "CLERK");
    farmerId = (await makeFarmer(org.id, "+254700500010", "Wanjiru")).id;
    admin = await login("priv", "+254700500001");
    clerk = await login("priv", "+254700500002");

    const req = request(app).post("/receipts").set(auth(admin));
    for (const [k, v] of Object.entries(newReceipt(farmerId, { weightKg: 50, pricePerKg: 80 }))) if (v !== undefined) req.field(k, String(v));
    receiptId = (await req).body.id;
    await request(app).post(`/receipts/${receiptId}/settlements`).set(auth(admin)).send({ weightKg: 20 });
  });

  const hasMoney = (body: unknown) =>
    /"(pricePerKg|amount|amountOwed|amountPaid|unpricedKg|settledKg|unsettledKg|settled|settledAt|settlements)"/.test(JSON.stringify(body));

  it("shows the admin prices and amounts", async () => {
    const farmer = await request(app).get(`/farmers/${farmerId}`).set(auth(admin));
    expect(farmer.body.balance.amountOwed).toBe("2400");
    expect(farmer.body.balance.amountPaid).toBe("1600");
    expect(farmer.body.receipts[0].pricePerKg).toBe("80");
  });

  it("strips money and payment status from a clerk's responses but keeps the kilos", async () => {
    const farmer = await request(app).get(`/farmers/${farmerId}`).set(auth(clerk));
    expect(farmer.status).toBe(200);
    expect(hasMoney(farmer.body)).toBe(false);
    expect(farmer.body.balance.deliveredKg).toBe("50");

    const list = await request(app).get(`/receipts?farmerId=${farmerId}`).set(auth(clerk));
    expect(hasMoney(list.body)).toBe(false);
    const detail = await request(app).get(`/receipts/${receiptId}`).set(auth(clerk));
    expect(hasMoney(detail.body)).toBe(false);
    expect(detail.body.receiptNumber).toBeTruthy();

    const edited = await request(app).patch(`/receipts/${receiptId}`).set(auth(clerk)).send({ weightKg: 55 });
    expect(edited.status).toBe(200);
    expect(hasMoney(edited.body)).toBe(false);
  });

  it("keeps the dashboard and batches admin-only", async () => {
    expect((await request(app).get("/dashboard/summary").set(auth(clerk))).status).toBe(403);
    expect((await request(app).get("/batches").set(auth(clerk))).status).toBe(403);
  });
});
