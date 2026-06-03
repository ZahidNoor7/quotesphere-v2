import { describe, it, expect } from "vitest";
import { buildPendingAction } from "@/lib/assistant/executor";
import { enabledToolSet } from "@/lib/assistant/features";
import type { ToolContext } from "@/lib/assistant/types";

const ALL = enabledToolSet(undefined); // undefined → every feature default-on
const ctx = (enabledTools: Set<string>): ToolContext => ({
  cookie: "", baseUrl: "http://localhost:3000", role: "admin", defaultCurrency: "PKR", attachments: [], enabledTools,
});

describe("assistant write tools — new update_* tools", () => {
  it("update_project builds a PUT with only the changed fields", async () => {
    const r = await buildPendingAction("c1", "update_project", { id: "P1", status: "complete", budget: 5000 }, ctx(ALL));
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.method).toBe("PUT");
    expect(r.endpoint).toBe("/api/projects/P1");
    expect(r.payload).toMatchObject({ status: "complete", budget: 5000 });
    expect(r.payload).not.toHaveProperty("id");
  });

  it("update_customer builds a customer PUT", async () => {
    const r = await buildPendingAction("c2", "update_customer", { id: "C1", phone_no: "999", company: "Acme" }, ctx(ALL));
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.endpoint).toBe("/api/customers/C1");
    expect(r.payload).toMatchObject({ phone_no: "999", company: "Acme" });
  });

  it("update_expense builds an expense PUT", async () => {
    const r = await buildPendingAction("c3", "update_expense", { id: "E1", status: "verified" }, ctx(ALL));
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.endpoint).toBe("/api/expenses/E1");
    expect(r.payload).toMatchObject({ status: "verified" });
  });

  it("rejects a tool whose feature is disabled (gating works)", async () => {
    const noProjects = enabledToolSet({ projects: false });
    expect(noProjects.has("update_project")).toBe(false); // not even offered to the model
    const r = await buildPendingAction("c4", "update_project", { id: "P1", status: "complete" }, ctx(noProjects));
    expect("error" in r).toBe(true); // and the executor refuses it
  });

  it("validates input — missing id is rejected", async () => {
    const r = await buildPendingAction("c5", "update_project", { status: "complete" }, ctx(ALL));
    expect("error" in r).toBe(true);
  });
});
