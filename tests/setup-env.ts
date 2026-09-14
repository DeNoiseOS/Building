import path from "node:path";
import { config } from "dotenv";

/**
 * Load `.env.test` before any test module imports the Prisma client.
 *
 * This runs once per Vitest worker before tests execute. `dotenv` sets
 * process.env.DATABASE_URL / DIRECT_URL to point at the local
 * `productionos_test` Postgres, isolating the test suite from the
 * Supabase production DB.
 *
 * If `.env.test` is missing, tests that need Postgres will fail with
 * the standard "DATABASE_URL is not set" message from `lib/prisma`.
 * That's the intended behaviour — never silently fall back to the
 * production credentials.
 */
config({ path: path.resolve(process.cwd(), ".env.test") });
