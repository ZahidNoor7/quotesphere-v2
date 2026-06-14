// Shared helpers for one-off platform/billing migration scripts.
// Pure Node ESM (no @/ alias, no tsx). Uses the raw Mongo driver via mongoose so
// tenant-scoped collections can be written without a tenant AsyncLocalStorage
// context (which would otherwise fail-closed). Collection names are pinned on the
// new models, so these literal names always match what the app reads.
import { readFileSync, existsSync } from "node:fs";
import mongoose from "mongoose";

/** Load MONGO_URI (and friends) from .env.local / .env if not already in env. */
function loadEnv() {
  if (process.env.MONGO_URI) return;
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const txt = readFileSync(file, "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue; // comments (#…) and blanks don't match
      const key = m[1];
      if (process.env[key] !== undefined) continue;
      process.env[key] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

export async function connect() {
  loadEnv();
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("✖ MONGO_URI not set (and no .env.local / .env found in cwd).");
    process.exit(2);
  }
  await mongoose.connect(uri, { family: 4, serverSelectionTimeoutMS: 30000 });
  return mongoose.connection.db;
}

/** Safe-by-default: writes only happen with explicit --yes / CONFIRM=yes. */
export function confirmed() {
  return process.env.CONFIRM === "yes" || process.argv.includes("--yes");
}

export { mongoose };
