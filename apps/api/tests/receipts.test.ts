import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { app, auth, login, makeFarmer, makeOrg, makeStaff, newReceipt, prisma, resetDb } from "./helpers";

// 1x1 transparent PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

function postReceipt(token: string, body: Record<string, unknown>, photo?: Buffer) {
  const req = request(app).post("/receipts").set(auth(token));
  for (const [k, v] of Object.entries(body)) if (v !== undefined) req.field(k, String(v));
  if (photo) req.attach("photo", photo, { filename: "../../evil name.png", contentType: "image/png" });
  return req;
}

describe("receipts", () => {
  let adminToken: string;
  let clerkToken: string;
  let farmerId: string;
  let otherAdminToken: string;

  beforeAll(async () => {
    await resetDb();
    const org = await makeOrg("rcpt");
    const other = await makeOrg("rcpt-other");
    await makeStaff(org.id, "+254733000001", "ADMIN");
    await makeStaff(org.id, "+254733000002", "CLERK");
    await makeStaff(other.id, "+254733000003", "ADMIN");
    farmerId = (await makeFarmer(org.id, "+254744000001", "Wanjiru")).id;
    adminToken = await login("rcpt", "+254733000001");
    clerkToken = await login("rcpt", "+254733000002");
    otherAdminToken = await login("rcpt-other", "+254733000003");
  });

  it("auto-numbers receipts per organization and keeps the farmer's running total", async () => {
    const first = await postReceipt(clerkToken, newReceipt(farmerId, { weightKg: 12.5 }));
    expect(first.status).toBe(201);
    expect(first.body.receiptNumber).toMatch(/^RCPT-000001$/);
    const second = await postReceipt(clerkToken, newReceipt(farmerId, { weightKg: 7.5 }));
    expect(second.body.receiptNumber).toBe("RCPT-000002");
    const farmer = await prisma.farmer.findUniqueOrThrow({ where: { id: farmerId } });
    expect(Number(farmer.cumulativeWeightKg)).toBe(20);
  });

  it("is safe to retry: the same clientId never double-counts", async () => {
    const body = newReceipt(farmerId, { weightKg: 5, receiptNumber: "PAPER-1" });
    const first = await postReceipt(clerkToken, body);
    const retry = await postReceipt(clerkToken, body);
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.id).toBe(first.body.id);
    const farmer = await prisma.farmer.findUniqueOrThrow({ where: { id: farmerId } });
    expect(Number(farmer.cumulativeWeightKg)).toBe(25);
  });

  it("rejects a reused paper receipt number", async () => {
    const res = await postReceipt(clerkToken, newReceipt(farmerId, { receiptNumber: "PAPER-1" }));
    expect(res.status).toBe(409);
  });

  it("validates weight and farmer", async () => {
    expect((await postReceipt(clerkToken, newReceipt(farmerId, { weightKg: -3 }))).status).toBe(400);
    expect((await postReceipt(clerkToken, newReceipt(farmerId, { weightKg: 0 }))).status).toBe(400);
    expect((await postReceipt(clerkToken, newReceipt("nonexistent"))).status).toBe(404);
  });

  it("corrects a weight by adjusting the running total by the difference", async () => {
    const created = await postReceipt(clerkToken, newReceipt(farmerId, { weightKg: 10 }));
    const before = Number((await prisma.farmer.findUniqueOrThrow({ where: { id: farmerId } })).cumulativeWeightKg);
    const res = await request(app).patch(`/receipts/${created.body.id}`).set(auth(clerkToken)).send({ weightKg: 14 });
    expect(res.status).toBe(200);
    expect(res.body.editedAt).toBeTruthy();
    const after = Number((await prisma.farmer.findUniqueOrThrow({ where: { id: farmerId } })).cumulativeWeightKg);
    expect(after - before).toBe(4);
  });

  it("lets only admins mark a receipt settled", async () => {
    const created = await postReceipt(clerkToken, newReceipt(farmerId));
    const asClerk = await request(app).patch(`/receipts/${created.body.id}/settle`).set(auth(clerkToken)).send({ settled: true });
    expect(asClerk.status).toBe(403);
    const asAdmin = await request(app).patch(`/receipts/${created.body.id}/settle`).set(auth(adminToken)).send({ settled: true });
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.settled).toBe(true);
  });

  it("never exposes one organization's data to another", async () => {
    const created = await postReceipt(clerkToken, newReceipt(farmerId));
    const id = created.body.id;
    expect((await request(app).get(`/receipts/${id}`).set(auth(otherAdminToken))).status).toBe(404);
    expect((await request(app).patch(`/receipts/${id}`).set(auth(otherAdminToken)).send({ weightKg: 1 })).status).toBe(404);
    expect((await request(app).patch(`/receipts/${id}/settle`).set(auth(otherAdminToken)).send({ settled: true })).status).toBe(404);
    expect((await request(app).get(`/farmers/${farmerId}`).set(auth(otherAdminToken))).status).toBe(404);
    const list = await request(app).get("/receipts").set(auth(otherAdminToken));
    expect(list.body).toEqual([]);
    const farmers = await request(app).get("/farmers").set(auth(otherAdminToken));
    expect(farmers.body).toEqual([]);
    // Another organization can't record against this organization's farmer either.
    expect((await postReceipt(otherAdminToken, newReceipt(farmerId))).status).toBe(404);
  });
});

describe("receipt photos", () => {
  let token: string;
  let farmerId: string;

  beforeAll(async () => {
    await resetDb();
    const org = await makeOrg("photos");
    await makeStaff(org.id, "+254755000001", "CLERK");
    farmerId = (await makeFarmer(org.id, "+254755000002")).id;
    token = await login("photos", "+254755000001");
  });

  it("stores photos under a generated name and serves them only via signed links", async () => {
    const res = await postReceipt(token, newReceipt(farmerId), PNG);
    expect(res.status).toBe(201);
    const link: string = res.body.photoUrl;
    expect(link).toMatch(/^\/files\/.+\.png\?exp=\d+&sig=[0-9a-f]{64}$/);
    expect(link).not.toContain("evil");
    expect(link).not.toContain("..");

    const ok = await request(app).get(link);
    expect(ok.status).toBe(200);
    expect(ok.headers["content-type"]).toContain("image/png");

    const tampered = await request(app).get(link.replace(/sig=./, "sig=0"));
    expect(tampered.status).toBe(403);
    const noSig = await request(app).get(link.split("?")[0]);
    expect(noSig.status).toBe(403);
    const expired = await request(app).get(link.replace(/exp=\d+/, "exp=1"));
    expect(expired.status).toBe(403);
  });

  it("no longer serves a public /uploads folder, and blocks path tricks", async () => {
    expect((await request(app).get("/uploads/anything.png")).status).toBe(404);
    expect((await request(app).get("/files/..%2F..%2F.env?exp=9999999999&sig=x")).status).toBe(403);
  });

  it("ignores non-image uploads", async () => {
    const res = await request(app)
      .post("/receipts")
      .set(auth(token))
      .field("farmerId", farmerId)
      .field("weightKg", "5")
      .field("clientId", "00000000-0000-4000-8000-0000000000aa")
      .field("deliveredAt", new Date().toISOString())
      .attach("photo", Buffer.from("<script>alert(1)</script>"), { filename: "x.html", contentType: "text/html" });
    expect(res.status).toBe(201);
    expect(res.body.photoUrl).toBeNull();
  });
});
