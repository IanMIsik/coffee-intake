import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { app, auth, login, makeFarmer, makeOrg, makeStaff, newReceipt } from "./helpers";

const record = (token: string, farmerId: string, kg: number) => {
  const req = request(app).post("/receipts").set(auth(token));
  for (const [k, v] of Object.entries(newReceipt(farmerId, { weightKg: kg }))) if (v !== undefined) req.field(k, String(v));
  return req;
};

describe("removing a farmer from the list", () => {
  let admin: string;
  let clerk: string;
  let otherAdmin: string;
  let farmerId: string;
  const phone = "+254700300010";

  beforeAll(async () => {
    const { resetDb } = await import("./helpers");
    await resetDb();
    const org = await makeOrg("arc");
    const other = await makeOrg("arc-other");
    await makeStaff(org.id, "+254700300001", "ADMIN");
    await makeStaff(org.id, "+254700300002", "CLERK");
    await makeStaff(other.id, "+254700300003", "ADMIN");
    farmerId = (await makeFarmer(org.id, phone, "Wanjiru")).id;
    admin = await login("arc", "+254700300001");
    clerk = await login("arc", "+254700300002");
    otherAdmin = await login("arc-other", "+254700300003");
    expect((await record(admin, farmerId, 40)).status).toBe(201);
  });

  it("is admin only and stays inside the organization", async () => {
    expect((await request(app).post(`/farmers/${farmerId}/archive`).set(auth(clerk))).status).toBe(403);
    expect((await request(app).post(`/farmers/${farmerId}/archive`).set(auth(otherAdmin))).status).toBe(404);
  });

  it("hides the farmer from the list but keeps every record", async () => {
    const res = await request(app).post(`/farmers/${farmerId}/archive`).set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.body.archivedAt).toBeTruthy();
    expect((await request(app).post(`/farmers/${farmerId}/archive`).set(auth(admin))).status).toBe(409);

    const list = await request(app).get("/farmers").set(auth(clerk));
    expect(list.body.map((f: any) => f.id)).not.toContain(farmerId);
    const archived = await request(app).get("/farmers?archived=true").set(auth(admin));
    expect(archived.body.map((f: any) => f.id)).toContain(farmerId);

    const detail = await request(app).get(`/farmers/${farmerId}`).set(auth(admin));
    expect(detail.status).toBe(200);
    expect(detail.body.receipts).toHaveLength(1);
    expect(detail.body.balance.deliveredKg).toBe("40");

    const day = await request(app).get("/dashboard/summary").set(auth(admin));
    expect(day.body.totalFarmers).toBe(0);
    expect(Number(day.body.totalKgAllTime)).toBe(40);
  });

  it("blocks new deliveries and farmer logins, and won't reuse the phone number", async () => {
    const blocked = await record(admin, farmerId, 10);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatch(/removed from the list/);

    const dupe = await request(app).post("/farmers").set(auth(admin)).send({ name: "Someone else", phone });
    expect(dupe.status).toBe(409);
    expect(dupe.body.error).toMatch(/Restore/);

    await request(app).post("/auth/farmer/otp/request").send({ organizationSlug: "arc", phone });
    const verify = await request(app).post("/auth/farmer/otp/verify").send({ organizationSlug: "arc", phone, code: "123456" });
    expect(verify.status).toBe(401);
  });

  it("can still be paid, and can be restored", async () => {
    const pay = await request(app).post(`/farmers/${farmerId}/settlements`).set(auth(admin)).send({ weightKg: 15, pricePerKg: 80 });
    expect(pay.status).toBe(201);
    expect(pay.body.balance.amountPaid).toBe("1200");

    const back = await request(app).post(`/farmers/${farmerId}/restore`).set(auth(admin));
    expect(back.status).toBe(200);
    expect(back.body.archivedAt).toBeNull();
    expect((await request(app).get("/farmers").set(auth(clerk))).body.map((f: any) => f.id)).toContain(farmerId);
    expect((await record(admin, farmerId, 5)).status).toBe(201);
  });
});
