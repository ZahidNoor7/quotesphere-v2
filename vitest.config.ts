import { defineConfig } from "vitest/config";

export default defineConfig({
  // Native tsconfig `@/*` path resolution (replaces the vite-tsconfig-paths plugin).
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    // Run files sequentially; each file gets its own in-memory Mongo, wiped per test.
    pool: "forks",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000, // first run downloads the mongod binary
  },
});
