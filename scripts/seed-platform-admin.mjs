#!/usr/bin/env node
/**
 * Bootstrap the FIRST platform super-admin. This is the only safe way to create a
 * super-admin (there is no public route — chicken-and-egg). Idempotent.
 *
 * Usage:
 *   PLATFORM_ADMIN_EMAIL=owner@example.com \
 *   PLATFORM_ADMIN_PASSWORD='a-long-strong-password' \
 *   PLATFORM_ADMIN_NAME='Platform Owner' \
 *   node scripts/seed-platform-admin.mjs --yes
 *
 * Without --yes (or CONFIRM=yes) it prints a DRY RUN and writes nothing.
 * Add --reset-password to rotate an existing admin's password.
 * The password is read from the environment and never logged.
 */
import bcrypt from "bcryptjs";
import { connect, mongoose, confirmed } from "./_db.mjs";

const email = (process.env.PLATFORM_ADMIN_EMAIL || "").toLowerCase().trim();
const password = process.env.PLATFORM_ADMIN_PASSWORD || "";
const name = process.env.PLATFORM_ADMIN_NAME || "Platform Admin";
const reset = process.argv.includes("--reset-password");

if (!email || !password) {
  console.error("✖ Set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD.");
  process.exit(2);
}
if (password.length < 12) {
  console.error("✖ PLATFORM_ADMIN_PASSWORD must be at least 12 characters.");
  process.exit(2);
}

const db = await connect();
const col = db.collection("platformadmins");
const existing = await col.findOne({ email });

const action = existing ? (reset ? "reset password for" : "ensure active (no password change)") : "create";

if (!confirmed()) {
  console.log(`DRY RUN — would ${action} platform admin: ${email}`);
  console.log("Re-run with --yes (or CONFIRM=yes) to apply.");
  await mongoose.disconnect();
  process.exit(0);
}

const now = new Date();
if (!existing) {
  const hash = await bcrypt.hash(password, 12);
  await col.insertOne({
    email, password: hash, name, is_active: true, last_login_at: null,
    createdAt: now, updatedAt: now,
  });
  console.log(`✓ Created platform admin: ${email}`);
} else if (reset) {
  const hash = await bcrypt.hash(password, 12);
  await col.updateOne({ email }, { $set: { password: hash, name, is_active: true, updatedAt: now } });
  console.log(`✓ Reset password for platform admin: ${email}`);
} else {
  await col.updateOne({ email }, { $set: { name, is_active: true, updatedAt: now } });
  console.log(`✓ Platform admin already exists: ${email} (ensured active; password unchanged).`);
  console.log("  Use --reset-password to rotate the password.");
}

await mongoose.disconnect();
