#!/usr/bin/env node
/**
 * Live end-to-end smoke test against a RUNNING QuoteSphere server.
 * Logs in with real credentials (NextAuth), then exercises every resource
 * (create → read → update → … → delete) and cleans up the test data it created.
 *
 * Usage:
 *   QS_BASE_URL=http://localhost:3002 \
 *   QS_TEST_EMAIL=you@example.com \
 *   QS_TEST_PASSWORD='your-password' \
 *   node scripts/live-smoke.mjs
 *
 * Your password is read from the environment and never written anywhere.
 * Every record it creates is prefixed "ZZ_LIVETEST_" and deleted at the end.
 */

const BASE = (process.env.QS_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.QS_TEST_EMAIL;
const PASSWORD = process.env.QS_TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("✖ Set QS_TEST_EMAIL and QS_TEST_PASSWORD (and optionally QS_BASE_URL).");
  process.exit(2);
}

// ─── tiny cookie jar ──────────────────────────────────────────────────────────
const jar = new Map();
function store(res) {
  for (const sc of res.headers.getSetCookie?.() ?? []) {
    const pair = sc.split(";")[0];
    const i = pair.indexOf("=");
    if (i < 0) continue;
    const name = pair.slice(0, i).trim();
    const value = pair.slice(i + 1).trim();
    if (value === "") jar.delete(name);
    else jar.set(name, value);
  }
}
const cookie = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

// ─── http helpers ─────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", cookie: cookie() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  store(res);
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

async function login() {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: cookie() } });
  store(csrfRes);
  const { csrfToken } = await csrfRes.json();
  const form = new URLSearchParams({ csrfToken, email: EMAIL, password: PASSWORD, callbackUrl: BASE, json: "true" });
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookie() },
    body: form.toString(),
    redirect: "manual",
  });
  store(res);
  const hasSession = [...jar.keys()].some((k) => k.includes("session-token"));
  if (!hasSession) throw new Error(`login failed (HTTP ${res.status}) — check email/password and QS_BASE_URL`);
  // confirm the session resolves
  const sess = await fetch(`${BASE}/api/auth/session`, { headers: { cookie: cookie() } }).then((r) => r.json());
  if (!sess?.user) throw new Error("login produced no session user");
  return sess.user;
}

// ─── result tracking ──────────────────────────────────────────────────────────
let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? `  — ${detail}` : ""}`); }
}
const TAG = "ZZ_LIVETEST_";
const created = { invoices: [], quotations: [], projects: [], expenses: [], products: [], services: [], customers: [] };

async function run() {
  console.log(`\n▶ Live smoke test against ${BASE}\n`);
  const user = await login();
  console.log(`  ✅ logged in as ${user.email} (role: ${user.role ?? "?"})\n`);

  // shared customer for documents
  console.log("• customers");
  let r = await api("POST", "/api/customers", { name: `${TAG}Acme`, phone_no: "923001234567" });
  check("create customer (201)", r.status === 201, JSON.stringify(r.json));
  const cust = r.json?.data;
  if (cust?._id) created.customers.push(cust._id);
  r = await api("GET", `/api/customers/${cust._id}`);
  check("read customer (200)", r.status === 200);
  r = await api("PUT", `/api/customers/${cust._id}`, { company: "Acme Inc" });
  check("update customer (200)", r.status === 200);

  console.log("• products");
  r = await api("POST", "/api/products", { name: `${TAG}Widget`, default_price: 250, stock_qty: 10 });
  check("create product (201)", r.status === 201);
  const prod = r.json?.data; if (prod?._id) created.products.push(prod._id);
  r = await api("PUT", `/api/products/${prod._id}`, { default_price: 300 });
  check("update product (200)", r.status === 200 && r.json?.data?.default_price === 300);

  console.log("• services");
  r = await api("POST", "/api/services", { name: `${TAG}Consulting`, default_price: 5000 });
  check("create service (201)", r.status === 201);
  const svc = r.json?.data; if (svc?._id) created.services.push(svc._id);

  console.log("• quotations");
  r = await api("POST", "/api/quotations", {
    customer_id: cust._id, customer_name: cust.name, customer_phone: "923001234567",
    issue_date: null, items: [{ id: 1, name: "Design", quantity: 2, price: 5000 }],
    sub_total: 10000, total_amount: 10000,
  });
  check("create quotation (201) + QT number", r.status === 201 && /^QT-/.test(r.json?.data?.quotation_no ?? ""), JSON.stringify(r.json));
  const quot = r.json?.data; if (quot?._id) created.quotations.push(quot._id);

  console.log("• invoices + payments");
  r = await api("POST", "/api/invoices", {
    customer_id: cust._id, customer_name: cust.name, customer_phone: "923001234567",
    issue_date: null, items: [{ id: 1, name: "Item", quantity: 1, price: 1000 }],
    sub_total: 1000, total_amount: 1000,
  });
  check("create invoice (201) + INV number", r.status === 201 && /^INV-/.test(r.json?.data?.invoice_no ?? ""), JSON.stringify(r.json));
  const inv = r.json?.data; if (inv?._id) created.invoices.push(inv._id);
  r = await api("POST", `/api/invoices/${inv._id}/payments`, { amount: 400, method: "cash" });
  check("record payment (200) → partial", r.status === 200 && r.json?.data?.payment_status === "partial", JSON.stringify(r.json));

  console.log("• convert quotation → invoice");
  r = await api("POST", `/api/quotations/${quot._id}/convert`, {});
  check("convert (200)", r.status === 200 && /^INV-/.test(r.json?.data?.invoice?.invoice_no ?? ""), JSON.stringify(r.json));
  if (r.json?.data?.invoice?._id) created.invoices.push(r.json.data.invoice._id);

  console.log("• projects");
  r = await api("POST", "/api/projects", {
    name: `${TAG}Website`, customer_id: cust._id, customer_name: cust.name, customer_phone: "923001234567", budget: 50000,
  });
  check("create project (201) + PRJ number", r.status === 201 && /^PRJ-/.test(r.json?.data?.project_no ?? ""), JSON.stringify(r.json));
  if (r.json?.data?._id) created.projects.push(r.json.data._id);

  console.log("• expenses");
  r = await api("POST", "/api/expenses", {
    bill_date: "2026-06-02", vendor_name: `${TAG}Fuel`,
    items: [{ id: 1, name: "Diesel", quantity: 10, unit_price: 300, total: 3000 }],
  });
  check("create expense (201) + computed total", r.status === 201 && r.json?.data?.total_amount === 3000, JSON.stringify(r.json));
  if (r.json?.data?._id) created.expenses.push(r.json.data._id);
}

async function cleanup() {
  console.log("\n• cleanup (deleting test data)");
  const del = async (path) => { try { await api("DELETE", path); } catch { /* ignore */ } };
  for (const id of created.invoices) await del(`/api/invoices/${id}`);
  for (const id of created.quotations) await del(`/api/quotations/${id}`);
  for (const id of created.projects) await del(`/api/projects/${id}?force=true`);
  for (const id of created.expenses) await del(`/api/expenses/${id}`);
  for (const id of created.products) await del(`/api/products/${id}`);
  for (const id of created.services) await del(`/api/services/${id}`);
  for (const id of created.customers) await del(`/api/customers/${id}?force=true`);
  console.log("  ✅ done");
}

try {
  await run();
} catch (e) {
  fail++;
  console.error(`\n✖ ${e.message}`);
} finally {
  await cleanup().catch(() => {});
  console.log(`\n── ${pass} passed, ${fail} failed ──`);
  process.exit(fail === 0 ? 0 : 1);
}
