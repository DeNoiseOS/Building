# tests/

Vitest suite for the backend. Node environment by default.

## Layout

```
tests/
  smoke.test.ts          Runner sanity + alias resolution
  unit/                  Pure logic, no I/O
  integration/           Hits a real (test) Postgres via Prisma
```

## Running

```bash
npm test              # single run
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
```

## Rules

- Unit tests must not hit the network, database, or filesystem.
- Integration tests get a dedicated test DB (see Phase 0.2b).
  They must never touch the Supabase production DB.
- One characterization test per critical flow (see audit Section J).
