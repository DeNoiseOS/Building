import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 routes ALL connection URLs through this file (the schema.prisma
// `url`/`directUrl` fields were removed in 7.x).
//
// `datasource.url` is used by `prisma migrate` and `prisma db pull`.
// For Supabase we point it at DIRECT_URL (session pooler at :5432) — the
// transaction pooler at :6543 breaks the prepared statements migrate uses.
//
// Runtime queries from the app go through the pg driver adapter wired in
// `lib/prisma.ts` against DATABASE_URL (the transaction pooler at :6543).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"],
  },
});
