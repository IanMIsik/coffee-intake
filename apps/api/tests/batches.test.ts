import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { app, auth, login, makeFarmer, makeOrg, makeStaff, newReceipt } from "./helpers";

const record = (token: string, farmerId: string, kg: number) => {
  const req = request(app).post("/receipts").set(auth(token));
  for (const [k, v] of Object.entries(newReceipt(farmerId, { weightKg: kg }))) if (v !== undefined) req.field(k, String(v));
  return req;
};

describe("batches", () => {
  let admin: string;
  let clerk: string;
  let otherAdmin: string;
  let a: string;
  let b: string;
  let c: string;
  let ra: { id: string };
  let batch1: { id: string };

  const balanceOf = async (id: string) =>
    (await request(app).get(`/farmers/${id}`).set(auth(admin))).body.balance as Record<string, string>;

  beforeAll(async () => {
    const { resetDb } = await import("./helpers");
    await resetDb();
    const org = await makeOrg("bat");
    const other = await makeOrg("bat-other");
    await makeStaff(org.id, "+254700200001", "ADMIN");
    await makeStaff(org.id, "+254700200002", "CLERK");
    await makeStaff(other.id, "+254700200003", "ADMIN");
    a = (await makeFarmer(org.id, "+254700200010", "Alice")).id;
    b = (await makeFarmer(org.id, "+254700200011", "Bob")).id;
    c = (await makeFarmer(org.id, "+254700200012", "Cara")).id;
    admin = await login("bat", "+254700200001");
    clerk = await login("bat", "+254700200002");
    otherAdmin = await login("bat-other", "+254700200003");
    ra = (await record(admin, a, 100)).body;
    await record(admin, b, 50);
    await record(admin, c, 30);
  });

  it("is admin only", async () => {
    expect((await request(app).get("/batches").set(auth(clerk))).status).toBe(403);
    expect((await request(app).post("/batches").set(auth(clerk)).send({ pricePerKg: 80 })).status).toBe(403);
  });

  it("prices everyone's unpaid kilos, except farmers who wait", async () => {
    const res = await request(app).post("/batches").set(auth(admin)).send({ pricePerKg: 80, heldFarmerIds: [c] });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Batch 1");
    expect(res.body.pricedReceipts).toBe(2);
    batch1 = res.body;
    expect((await balanceOf(a)).amountOwed).toBe("8000");
    expect((await balanceOf(b)).amountOwed).toBe("4000");
    const waiting = await balanceOf(c);
    expect(waiting.amountOwed).toBe("0");
    expect(waiting.unpricedKg).toBe("30");
  });

  it("pays part of the batch, and lets the rest take a new market price", async () => {
    const pay = await request(app)
      .post(`/batches/${batch1.id}/pay`)
      .set(auth(admin))
      .send({ payments: [{ farmerId: a, weightKg: 40 }] });
    expect(pay.status).toBe(201);
    const row = pay.body.farmers.find((f: any) => f.farmerId === a);
    expect(row.paidKg).toBe("40");
    expect(row.amountPaid).toBe("3200");
    expect(row.unpaidKg).toBe("60");

    const over = await request(app).post(`/batches/${batch1.id}/pay`).set(auth(admin)).send({ payments: [{ farmerId: a, weightKg: 61 }] });
    expect(over.status).toBe(400);

    // The market moves: batch 2 re-prices what is still unpaid, including the unpaid part of Alice's delivery.
    const second = await request(app).post("/batches").set(auth(admin)).send({ pricePerKg: 95, name: "March lot" });
    expect(second.status).toBe(201);
    expect(second.body.name).toBe("March lot");
    expect((await balanceOf(a)).amountOwed).toBe("5700");
    expect((await balanceOf(c)).amountOwed).toBe("2850");
    // What was already paid keeps the earlier price.
    expect((await balanceOf(a)).amountPaid).toBe("3200");
    const paidAtOld = await request(app).get(`/batches/${batch1.id}`).set(auth(admin));
    expect(paidAtOld.body.farmers.find((f: any) => f.farmerId === a).unpaidKg).toBe("0");
  });

  it("pays everyone in full when no list is given, and lets a farmer wait or rejoin", async () => {
    const third = (await request(app).post("/batches").set(auth(admin)).send({ pricePerKg: 100 })).body;
    const held = await request(app).post(`/batches/${third.id}/hold`).set(auth(admin)).send({ farmerId: b, hold: true });
    expect(held.status).toBe(200);
    expect((await balanceOf(b)).unpricedKg).toBe("50");

    const all = await request(app).post(`/batches/${third.id}/pay`).set(auth(admin)).send({});
    expect(all.status).toBe(201);
    expect((await balanceOf(a)).unsettledKg).toBe("0");
    expect((await balanceOf(c)).unsettledKg).toBe("0");
    expect((await balanceOf(c)).amountPaid).toBe("3000");
    expect((await balanceOf(b)).unsettledKg).toBe("50");

    const rejoin = await request(app).post(`/batches/${third.id}/hold`).set(auth(admin)).send({ farmerId: b, hold: false });
    expect(rejoin.status).toBe(200);
    expect((await balanceOf(b)).amountOwed).toBe("5000");

    expect((await request(app).post(`/batches/${third.id}/pay`).set(auth(admin)).send({ payments: [{ farmerId: a }] })).status).toBe(400);
  });

  it("prices late deliveries on request and keeps tenants apart", async () => {
    const late = (await record(admin, a, 20)).body;
    expect(late.pricePerKg).toBeNull();
    const latest = (await request(app).get("/batches").set(auth(admin))).body[0];
    const applied = await request(app).post(`/batches/${latest.id}/apply`).set(auth(admin));
    expect(applied.body.pricedReceipts).toBe(1);
    expect((await balanceOf(a)).amountOwed).toBe("2000");

    expect((await request(app).get(`/batches/${latest.id}`).set(auth(otherAdmin))).status).toBe(404);
    expect((await request(app).get("/batches").set(auth(otherAdmin))).body).toEqual([]);
    expect(ra.id).toBeTruthy();
  });
});
