import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Vitest baseline.
 *
 * Node environment (no jsdom needed today; frontend components will
 * gain their own tests later with their own environment override).
 * Path alias mirrors tsconfig so tests import the same "@/lib/…"
 * paths as production code.
 *
 * Integration tests (`tests/integration/*.integration.test.ts`) hit
 * a real Postgres via Prisma. `tests/setup-env.ts` loads `.env.test`
 * so `@/lib/prisma` connects to the local `productionos_test` DB, not
 * the Supabase production one. Do not remove that setup file.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["./tests/setup-env.ts"],
    reporters: ["default"],
    passWithNoTests: false,
    clearMocks: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // `server-only` throws when imported outside a Next.js Server
      // Component. Our tests import server modules directly, so we
      // alias it to a harmless empty module.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
