import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { app, auth, login, makeFarmer, makeOrg, makeStaff, newReceipt } from "./helpers";

const record = (token: string, farmerId: string, kg: number, extra: Record<string, unknown> = {}) => {
  const req = request(app).post("/receipts").set(auth(token));
  for (const [k, v] of Object.entries(newReceipt(farmerId, { weightKg: kg, ...extra }))) if (v !== undefined) req.field(k, String(v));
  return req;
};

describe("deleting a delivery record", () => {
  let admin: string;
  let clerk: string;
  let otherAdmin: string;
  let farmerId: string;

  const balance = async () =>
    (await request(app).get(`/farmers/${farmerId}`).set(auth(admin))).body.balance as Record<string, string>;

  beforeAll(async () => {
    const { resetDb } = await import("./helpers");
    await resetDb();
    const org = await makeOrg("del");
    const other = await makeOrg("del-other");
    await makeStaff(org.id, "+254700400001", "ADMIN");
    await makeStaff(org.id, "+254700400002", "CLERK");
    await makeStaff(other.id, "+254700400003", "ADMIN");
    farmerId = (await makeFarmer(org.id, "+254700400010", "Wanjiru")).id;
    admin = await login("del", "+254700400001");
    clerk = await login("del", "+254700400002");
    otherAdmin = await login("del-other", "+254700400003");
  });

  it("lets a clerk edit but not delete", async () => {
    const r = (await record(clerk, farmerId, 20)).body;
    const edit = await request(app).patch(`/receipts/${r.id}`).set(auth(clerk)).send({ weightKg: 25 });
    expect(edit.status).toBe(200);
    const del = await request(app).delete(`/receipts/${r.id}`).set(auth(clerk)).send({ reason: "Typo" });
    expect(del.status).toBe(403);
    expect((await balance()).deliveredKg).toBe("25");
  });

  it("needs a reason and stays inside the organization", async () => {
    const r = (await record(admin, farmerId, 10)).body;
    expect((await request(app).delete(`/receipts/${r.id}`).set(auth(admin)).send({})).status).toBe(400);
    expect((await request(app).delete(`/receipts/${r.id}`).set(auth(otherAdmin)).send({ reason: "Not mine" })).status).toBe(404);
  });

  it("refuses to delete while payments are live, then deletes once they are voided", async () => {
    const r = (await record(admin, farmerId, 40, { pricePerKg: 80 })).body;
    const pay = await request(app).post(`/receipts/${r.id}/settlements`).set(auth(admin)).send({ weightKg: 10 });
    expect(pay.status).toBe(201);

    const blocked = await request(app).delete(`/receipts/${r.id}`).set(auth(admin)).send({ reason: "Wrong farmer" });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error).toMatch(/Void those payments/);

    const voided = await request(app).delete(`/receipts/${r.id}/settlements/${pay.body.settlement.id}`).set(auth(admin));
    expect(voided.status).toBe(200);
    const before = Number((await balance()).deliveredKg);
    const ok = await request(app).delete(`/receipts/${r.id}`).set(auth(admin)).send({ reason: "Wrong farmer" });
    expect(ok.status).toBe(200);
    expect(Number((await balance()).deliveredKg)).toBe(before - 40);
    expect((await request(app).get(`/receipts/${r.id}`).set(auth(admin))).status).toBe(404);
  });

  it("keeps an audit trail and frees the receipt number", async () => {
    const r = (await record(admin, farmerId, 12, { receiptNumber: "MISTAKE-1" })).body;
    expect((await request(app).delete(`/receipts/${r.id}`).set(auth(admin)).send({ reason: "Entered twice" })).status).toBe(200);

    const log = await request(app).get(`/receipts/deleted?farmerId=${farmerId}`).set(auth(admin));
    expect(log.status).toBe(200);
    const row = log.body.find((d: any) => d.receiptNumber === "MISTAKE-1");
    expect(row).toMatchObject({ farmerName: "Wanjiru", weightKg: "12", reason: "Entered twice" });
    expect(row.deletedByName).toBeTruthy();

    expect((await request(app).get("/receipts/deleted").set(auth(clerk))).status).toBe(403);
    expect((await request(app).get("/receipts/deleted").set(auth(otherAdmin))).body).toEqual([]);

    // The number can be used again for the corrected entry.
    expect((await record(admin, farmerId, 12, { receiptNumber: "MISTAKE-1" })).status).toBe(201);
  });
});
