import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Prisma 7 requires a driver adapter on the PrismaClient. For Supabase
// Postgres we use `@prisma/adapter-pg` with the pooled connection
// (DATABASE_URL — transaction pooler at :6543). Migrations use a
// separate URL (DIRECT_URL) configured in prisma.config.ts.
//
// Two Supabase-specific gotchas the bare connection string handles
// poorly, so we normalise it before handing it to `pg`:
//   1. Supabase URLs often include `?pgbouncer=true` (and sometimes
//      `&connection_limit=1`). Those are Prisma-CLI hints — `pg`
//      silently ignores some and errors on others depending on version.
//      We strip them.
//   2. Vercel serverless functions are short-lived; a large pool will
//      exhaust Supabase's connection limit. We cap at 1 connection per
//      function instance and recycle quickly.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function buildPool(): Pool {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      "DATABASE_URL is not set. Configure your Supabase pooled connection."
    );
  }

  // Strip Prisma-specific query params that confuse the pg driver.
  let connectionString = raw;
  try {
    const url = new URL(raw);
    const drop = ["pgbouncer", "connection_limit", "schema", "pool_timeout"];
    drop.forEach((k) => url.searchParams.delete(k));
    connectionString = url.toString();
  } catch {
    // If URL parsing fails for any reason, fall back to the raw string.
  }

  return new Pool({
    connectionString,
    // Allow a handful of concurrent connections so parallel queries
    // (the home page fires ~10 in parallel) don't serialize behind
    // max=1. Supabase's pgbouncer multiplexes these for us.
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Supabase requires TLS. pg auto-detects most of the time, but
    // making it explicit avoids hosts that disable hostname checks.
    ssl: { rejectUnauthorized: false },
  });
}

function createPrismaClient() {
  const adapter = new PrismaPg(buildPool());
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
