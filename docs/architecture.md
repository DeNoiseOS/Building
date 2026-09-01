# DeNoise OS — Backend Architecture

The one-page map of how this backend is organised, what goes where,
and what the recurring shapes look like. **New features MUST follow
these conventions.** Legacy code that doesn't yet is not a licence
to add more of the same — migrate the file you touch.

---

## Directory map

```
app/
  (app)/                    # Server-rendered pages behind auth
    <feature>/page.tsx      # Import from lib/queries/*, render.
    <feature>/layout.tsx    # Nav shell. No data logic.

  api/<feature>/route.ts    # REST routes. Import from lib/api,
                            # lib/access, lib/permissions. Use the
                            # response helpers, never NextResponse
                            # directly.

lib/
  auth.ts                   # NextAuth config. Never edit casually.
  prisma.ts                 # Prisma client singleton. Never edit
                            # casually. Has an SSL host-switch that
                            # local Postgres relies on.
  access.ts                 # projectAccessFilter + the two boolean
                            # helpers. Every 176 call-site of the
                            # filter reaches this file.
  permissions.ts            # 22 can* functions. Consolidation is a
                            # future phase — do not add a 23rd here
                            # without a very clear justification.
  api.ts                    # Response helpers (ok, created, badRequest,
                            # notFound, forbidden, unauthorized,
                            # conflict, serverError) + requireUser.
  logger.ts                 # log.debug/info/warn/error. Never call
                            # `console.*` directly in new code — the
                            # transport switch is one file away and
                            # every consumer benefits.
  env-check.ts              # Startup guards invoked from
                            # instrumentation.ts.
  queries/                  # Direct DB readers used by server
                            # components. One file per domain.
    projects.ts / dashboard.ts / tasks.ts / filters.ts /
    activity.ts / calendar.ts
  scheduling/               # V0.29 feature module.
    actions.ts              # Server Actions (`"use server"`).
    data.ts                 # Prisma queries.
    asset-types.ts          # Per-dept vocabulary.
  widgets/                  # V0.28 feature module (Home Command
                            # Center). Same shape as scheduling/.

tests/
  unit/                     # Pure logic. Mock prisma + server-only.
  integration/              # Real Postgres. See tests/setup-env.ts +
                            # tests/stubs/server-only.ts.
```

---

## New feature — where does each piece go?

For a new feature called `myFeature`, land these files:

| Piece                            | Path                                        |
| -------------------------------- | ------------------------------------------- |
| Prisma queries (read)            | `lib/queries/myFeature.ts` OR `lib/myFeature/data.ts` |
| Server Actions (write)           | `lib/myFeature/actions.ts` (`"use server"`) |
| Zod schemas                      | `lib/myFeature/schema.ts`                   |
| Constants / vocabularies         | `lib/myFeature/types.ts`                    |
| REST endpoints (only if needed)  | `app/api/<scope>/myFeature/route.ts`        |
| Pages                            | `app/(app)/<scope>/myFeature/page.tsx`      |
| UI components                    | `components/myFeature/*.tsx`                |

**Prefer Server Actions over REST routes for new mutations.** REST
routes exist for legacy reasons + for the few endpoints that need
to be hit from outside the Next.js app (webhooks, one-off scripts).
For everything driven from a form, a button, or a modal in the same
app, Server Actions are shorter, typed end-to-end, and don't need
a JSON transport.

---

## The response-shape convention (REST routes only)

Every REST route returns via `lib/api.ts` helpers, never
`NextResponse.json(...)` inline. This keeps error shapes uniform.

```ts
// Success
return ok({ ...data });          // 200
return created({ id });          // 201
return noContent();              // 204

// Errors — every one is { error: string, ...meta }
return badRequest("msg", fieldErrors);   // 400
return unauthorized();                    // 401
return forbidden();                       // 403
return notFound();                        // 404
return conflict();                        // 409
return serverError();                     // 500
```

Auth guard:

```ts
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId, userName } = auth;
  // ...
}
```

---

## Access + permission surface

Two files own security. Every read/mutation goes through them.

- **`lib/access.ts`** answers *"which projects can this user see?"* via
  `projectAccessFilter(userId)`. Compose it into every project-scoped
  Prisma `where` — never write `{ userId }` alone, or non-owners lose
  visibility they should have.
- **`lib/permissions.ts`** answers *"can this user do X on project Y?"*.
  22 named `can*` functions. Every route / page calls the specific one
  that matches its verb; nothing should ever compare role strings
  directly.

Both are covered by `tests/unit/access.test.ts` + `tests/unit/permissions.test.ts`
(mocked prisma) and `tests/integration/access.integration.test.ts`
(real DB).

---

## Testing rules

- **Unit tests** (`tests/unit/*.test.ts`) — pure logic, `vi.mock`
  `server-only` and `@/lib/prisma`.
- **Integration tests** (`tests/integration/*.integration.test.ts`) —
  hit the local `productionos_test` Postgres via `.env.test`. Every
  test creates + cleans its own rows with unique-suffix emails so
  parallel runs never collide.
- **Coverage is a floor, not a target.** New code that touches the
  access filter, permissions, custody / purchase / equipment state
  machines, or the reset flow MUST land with a test.
- `npm test` runs everything. `npm run test:watch` for TDD.
  `npm run test:db:migrate` applies pending migrations to the test DB.

---

## Formatting + commits

- **Prettier + ESLint run in `.husky/pre-commit`.** No manual style
  discipline required — the hook rejects unformatted commits and the
  `lint-staged` pass runs `--fix` first.
- **Commits explain WHY, not just WHAT.** See recent `refactor:` commits
  for the pattern. Multi-line bodies via heredoc. Author identity is
  set per-commit via env vars (see `CLAUDE.md`).
- **Never skip hooks** (`--no-verify`) unless the user has explicitly
  approved that specific commit.

---

## What to NOT touch casually

From the backend audit:

- `lib/prisma.ts` — one wrong tweak breaks every request.
- `lib/auth.ts` — sensitive; low test coverage on this file.
- `lib/access.ts` — 176 consumers; behavioural change = data leak.
- `prisma/schema.prisma` structural changes — only additive columns;
  no drops, no renames, without an accompanying data migration.
- Applied migrations — never edit an already-applied migration file.
- The Purchase → PurchaseItem → Equipment auto-create loop in
  `app/api/projects/[id]/purchases/route.ts` — cross-model invariants
  live here; changes need integration tests first.

---

## History

The backend went through a systematic cleanup pass in mid-2026 that
established these conventions from a codebase that grew organically.
Ordered by phase:

- **Phase 0** — Safety infrastructure: Prettier, husky, Vitest, real
  test DB via Homebrew Postgres, characterisation tests for access +
  permissions, logger seam, quick-login production-guard.
- **Phase 1** — Low-risk cleanup: canonicalised `CUSTODY_STATUS` /
  `EQUIPMENT_STATUS` (caught a 5-vs-8 divergence), extended
  `lib/api.ts` with `ok` / `created` / `conflict` / `unauthorized`,
  standardised the last 4 inline-response routes.
- **Phase 2** — Removed 66 `(prisma as any)` escapes across the app.
  Uncovered a silent bug (`resetDemoProject` was rolling back on
  every run because `Notification` has no `projectId` column).
- **Phase 4** — Split the 794-line `lib/server-data.ts` into 6
  domain files under `lib/queries/`, migrated every consumer to the
  new paths, deleted the shim.

Phases 3 (permission consolidation), 5 (Server Actions everywhere),
6 (background jobs), and 7 (JSON attachment retirement) remain open.
Do not start them without integration-test coverage on the flows
they touch.
