// Empty stub used only under Vitest. `server-only` throws when imported
// outside a Next.js Server Component / Server Action. Our tests import
// server modules (lib/access.ts, lib/permissions.ts, ...) directly, so
// we alias the real `server-only` package to this no-op in
// vitest.config.ts.
export {};
