import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { PASSWORD, app, auth, login, makeOrg, makeStaff, prisma, resetDb } from "./helpers";

describe("staff sign-in", () => {
  beforeAll(async () => {
    await resetDb();
    const a = await makeOrg("org-a");
    const b = await makeOrg("org-b");
    await makeStaff(a.id, "+254700000001", "ADMIN", "Admin A");
    // Same phone number in a different organization is a different account.
    await makeStaff(b.id, "+254700000001", "CLERK", "Clerk B");
  });

  it("accepts the number typed any common way", async () => {
    for (const phone of ["+254700000001", "254700000001", "0700000001", "0700 000 001"]) {
      const res = await request(app)
        .post("/auth/staff/login")
        .send({ organizationSlug: "org-a", phone, password: PASSWORD });
      expect(res.status, phone).toBe(200);
      expect(res.body.staff.name).toBe("Admin A");
    }
  });

  it("scopes accounts to their organization", async () => {
    const res = await request(app)
      .post("/auth/staff/login")
      .send({ organizationSlug: "org-b", phone: "0700000001", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.staff.name).toBe("Clerk B");
    expect(res.body.organization.slug).toBe("org-b");
  });

  it("rejects a wrong password and an unknown organization", async () => {
    const bad = await request(app)
      .post("/auth/staff/login")
      .send({ organizationSlug: "org-a", phone: "0700000001", password: "nope" });
    expect(bad.status).toBe(401);
    const unknown = await request(app)
      .post("/auth/staff/login")
      .send({ organizationSlug: "nope", phone: "0700000001", password: PASSWORD });
    expect(unknown.status).toBe(404);
  });

  it("rejects requests with no token or a garbage token", async () => {
    expect((await request(app).get("/farmers")).status).toBe(401);
    expect((await request(app).get("/farmers").set(auth("garbage"))).status).toBe(401);
  });
});

describe("password change", () => {
  beforeAll(async () => {
    await resetDb();
    const org = await makeOrg("org-pw");
    await makeStaff(org.id, "+254711000001", "CLERK");
  });

  it("checks the current password and signs out old sessions", async () => {
    const oldToken = await login("org-pw", "+254711000001");

    const wrong = await request(app)
      .post("/auth/staff/change-password")
      .set(auth(oldToken))
      .send({ currentPassword: "wrong-one", newPassword: "brandnewpass1" });
    expect(wrong.status).toBe(400);

    const same = await request(app)
      .post("/auth/staff/change-password")
      .set(auth(oldToken))
      .send({ currentPassword: PASSWORD, newPassword: PASSWORD });
    expect(same.status).toBe(400);

    await new Promise((r) => setTimeout(r, 1100)); // tokens are timestamped to the second
    const ok = await request(app)
      .post("/auth/staff/change-password")
      .set(auth(oldToken))
      .send({ currentPassword: PASSWORD, newPassword: "brandnewpass1" });
    expect(ok.status).toBe(200);

    expect((await request(app).get("/farmers").set(auth(oldToken))).status).toBe(401);
    expect((await request(app).get("/farmers").set(auth(ok.body.token))).status).toBe(200);
    await login("org-pw", "+254711000001", "brandnewpass1");
  });
});

describe("staff management", () => {
  let adminToken: string;
  let clerkToken: string;
  let adminId: string;
  let clerkId: string;

  beforeAll(async () => {
    await resetDb();
    const org = await makeOrg("org-s");
    const other = await makeOrg("org-other");
    adminId = (await makeStaff(org.id, "+254722000001", "ADMIN", "Boss")).id;
    clerkId = (await makeStaff(org.id, "+254722000002", "CLERK", "Helper")).id;
    await makeStaff(other.id, "+254722000009", "ADMIN", "Other Admin");
    adminToken = await login("org-s", "+254722000001");
    clerkToken = await login("org-s", "+254722000002");
  });

  it("keeps staff management admin-only", async () => {
    expect((await request(app).get("/staff").set(auth(clerkToken))).status).toBe(403);
    expect((await request(app).get("/staff").set(auth(adminToken))).status).toBe(200);
  });

  it("applies a role change immediately, without a new login", async () => {
    const promote = await request(app).patch(`/staff/${clerkId}`).set(auth(adminToken)).send({ role: "ADMIN" });
    expect(promote.status).toBe(200);
    expect((await request(app).get("/staff").set(auth(clerkToken))).status).toBe(200);
    await request(app).patch(`/staff/${clerkId}`).set(auth(adminToken)).send({ role: "CLERK" });
    expect((await request(app).get("/staff").set(auth(clerkToken))).status).toBe(403);
  });

  it("stops an admin removing or demoting themselves", async () => {
    expect((await request(app).patch(`/staff/${adminId}`).set(auth(adminToken)).send({ role: "CLERK" })).status).toBe(400);
    expect((await request(app).delete(`/staff/${adminId}`).set(auth(adminToken))).status).toBe(400);
  });

  it("cannot reach another organization's staff", async () => {
    const other = await prisma.staffUser.findFirstOrThrow({ where: { name: "Other Admin" } });
    expect((await request(app).patch(`/staff/${other.id}`).set(auth(adminToken)).send({ role: "CLERK" })).status).toBe(404);
    expect((await request(app).delete(`/staff/${other.id}`).set(auth(adminToken))).status).toBe(404);
    expect((await request(app).post(`/staff/${other.id}/password`).set(auth(adminToken)).send({})).status).toBe(404);
  });

  it("resets a password, signing the person out of old sessions", async () => {
    await new Promise((r) => setTimeout(r, 1100));
    const reset = await request(app).post(`/staff/${clerkId}/password`).set(auth(adminToken)).send({});
    expect(reset.status).toBe(200);
    expect(reset.body.password).toHaveLength(10);
    expect((await request(app).get("/farmers").set(auth(clerkToken))).status).toBe(401);
    await login("org-s", "+254722000002", reset.body.password);
  });

  it("rejects a too-short chosen password", async () => {
    const res = await request(app).post(`/staff/${clerkId}/password`).set(auth(adminToken)).send({ password: "short" });
    expect(res.status).toBe(400);
  });

  it("deletes an account: instant lockout, number reusable, receipts keep the name", async () => {
    const org = await prisma.organization.findFirstOrThrow({ where: { slug: "org-s" } });
    const victim = await makeStaff(org.id, "+254722000003", "CLERK", "Leaver");
    const token = await login("org-s", "+254722000003");

    expect((await request(app).delete(`/staff/${victim.id}`).set(auth(adminToken))).status).toBe(200);
    expect((await request(app).get("/farmers").set(auth(token))).status).toBe(401);
    const relogin = await request(app)
      .post("/auth/staff/login")
      .send({ organizationSlug: "org-s", phone: "+254722000003", password: PASSWORD });
    expect(relogin.status).toBe(401);
    const list = await request(app).get("/staff").set(auth(adminToken));
    expect(list.body.map((s: { name: string }) => s.name)).not.toContain("Leaver");
    expect((await makeStaff(org.id, "+254722000003", "CLERK", "Replacement")).name).toBe("Replacement");
  });
});
