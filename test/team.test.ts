import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { GET, POST } from "@/app/api/team/route";
import { PATCH, DELETE } from "@/app/api/team/[id]/route";
import User from "@/models/User";
import { req, ctx, setSession } from "./helpers";
import { TEST_ORG_ID } from "./setup";

const ADMIN_ID = "0000000000000000000000a1"; // matches ADMIN_SESSION in setup
const OTHER_ORG = "0000000000000000000000ff";

const add = (body: Record<string, unknown>) => POST(req("/api/team", "POST", body));

describe("team — add member directly with credentials", () => {
  it("admin adds a member who can sign in to the same org", async () => {
    const res = await add({ name: "Jane", email: "jane@co.com", password: "s3cretpw!", role: "manager" });
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.role).toBe("manager");

    // The user is persisted in the admin's org with a hashed password →
    // login-ready (the credentials provider does exactly this compare).
    const user = (await User.findOne({ email: "jane@co.com" }).select("+password").lean()) as any;
    expect(String(user.org_id)).toBe(TEST_ORG_ID);
    expect(user.role).toBe("manager");
    expect(await bcrypt.compare("s3cretpw!", user.password)).toBe(true);
  });

  it("admin can add another admin", async () => {
    const res = await add({ name: "Boss", email: "boss@co.com", password: "longenough1", role: "admin" });
    expect(res.status).toBe(201);
    expect((await res.json()).data.role).toBe("admin");
  });

  it("new member shows up in the org's team list", async () => {
    await add({ name: "Sam", email: "sam@co.com", password: "longenough1", role: "staff" });
    const list = (await (await GET(req("/api/team"))).json()).data as Array<{ email: string }>;
    expect(list.some((m) => m.email === "sam@co.com")).toBe(true);
  });

  it("non-admin cannot add members (403)", async () => {
    await setSession({ user: { id: "0000000000000000000000a2", role: "manager" } });
    const res = await add({ name: "X", email: "x@co.com", password: "longenough1", role: "staff" });
    expect(res.status).toBe(403);
  });

  it("rejects a weak password (400)", async () => {
    const res = await add({ name: "X", email: "weak@co.com", password: "short", role: "staff" });
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate email (409)", async () => {
    await add({ name: "Dup", email: "dup@co.com", password: "longenough1", role: "staff" });
    const res = await add({ name: "Dup2", email: "dup@co.com", password: "longenough1", role: "viewer" });
    expect(res.status).toBe(409);
  });
});

describe("team — change role & remove member", () => {
  const addMember = async (email: string, role = "staff") =>
    (await (await add({ name: "M", email, password: "longenough1", role })).json()).data.id as string;

  it("admin changes a member's role", async () => {
    const id = await addMember("r1@co.com", "staff");
    const res = await PATCH(req(`/api/team/${id}`, "PATCH", { role: "manager" }), ctx(id));
    expect(res.status).toBe(200);
    expect((await res.json()).data.role).toBe("manager");
  });

  it("admin cannot change their own role (no lock-out)", async () => {
    const res = await PATCH(req(`/api/team/${ADMIN_ID}`, "PATCH", { role: "viewer" }), ctx(ADMIN_ID));
    expect(res.status).toBe(400);
  });

  it("cannot change the role of a user in another org (404)", async () => {
    const other = await User.create({ name: "O", email: "o@x.com", password: "x", role: "staff", org_id: OTHER_ORG });
    const res = await PATCH(req(`/api/team/${other._id}`, "PATCH", { role: "admin" }), ctx(String(other._id)));
    expect(res.status).toBe(404);
  });

  it("non-admin cannot change roles (403)", async () => {
    const id = await addMember("r2@co.com");
    await setSession({ user: { id: "0000000000000000000000a2", role: "manager" } });
    const res = await PATCH(req(`/api/team/${id}`, "PATCH", { role: "admin" }), ctx(id));
    expect(res.status).toBe(403);
  });

  it("admin removes a member", async () => {
    const id = await addMember("del@co.com");
    const res = await DELETE(req(`/api/team/${id}`, "DELETE"), ctx(id));
    expect(res.status).toBe(200);
    expect(await User.findById(id).lean()).toBeNull();
  });

  it("admin cannot remove themselves", async () => {
    const res = await DELETE(req(`/api/team/${ADMIN_ID}`, "DELETE"), ctx(ADMIN_ID));
    expect(res.status).toBe(400);
  });

  it("cannot remove a user in another org (404, untouched)", async () => {
    const other = await User.create({ name: "O2", email: "o2@x.com", password: "x", role: "staff", org_id: OTHER_ORG });
    const res = await DELETE(req(`/api/team/${other._id}`, "DELETE"), ctx(String(other._id)));
    expect(res.status).toBe(404);
    expect(await User.findById(other._id).lean()).not.toBeNull();
  });
});
