import { beforeAll, beforeEach, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { setTestDefaultOrg } from "@/lib/tenant-context";

/** Fixed org every test runs under, unless a test explicitly switches via runWithOrg. */
export const TEST_ORG_ID = "0000000000000000000000ce";

// ─── Global mocks (apply to every test file) ──────────────────────────────────
// auth()        → controllable session (default admin, see beforeEach / setSession)
// withLog       → pass-through, no console spam
// recordAudit   → no-op so the fire-and-forget side effect can't race teardown
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/logger", () => ({ withLog: (_name: string, h: unknown) => h }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn().mockResolvedValue(undefined) }));

export const ADMIN_SESSION = {
  user: { id: "0000000000000000000000a1", email: "test-admin@example.com", name: "Test Admin", role: "admin", org_id: TEST_ORG_ID },
};

let replset: MongoMemoryReplSet | undefined;

beforeAll(async () => {
  if (!replset) {
    // 1-node replica set so routes that use Mongo transactions (quotation → invoice
    // convert) work; a standalone mongod rejects transactions.
    replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGO_URI = replset.getUri();
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI, { dbName: "qs_test" });
    }
  }
}, 120_000);

beforeEach(async () => {
  // Default every test to an admin session; RBAC tests override via setSession().
  const { auth } = await import("@/auth");
  (auth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(ADMIN_SESSION);
  // Direct model operations in tests (outside withTenant) fall back to this org.
  setTestDefaultOrg(TEST_ORG_ID);
});

afterEach(async () => {
  // Wipe all collections so each test starts from a clean slate.
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});
