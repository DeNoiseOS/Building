import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Vitest baseline.
 *
 * Node environment (no jsdom needed today; frontend components will
 * gain their own tests later with their own environment override).
 * Path alias mirrors tsconfig so tests import the same "@/lib/…"
 * paths as production code.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    reporters: ["default"],
    passWithNoTests: false,
    clearMocks: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
