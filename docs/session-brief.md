# DeNoise OS — Context Brief for New Claude Sessions

Read this in full before responding to the user.

---

## 🚨 Session Journal Workflow (READ THIS FIRST)

The user maintains a cross-device session journal at
`docs/session-journal.md` in the repo. Two magic phrases trigger
your actions:

### `[start]` — user opens a new session
When the user types `[start]`, you MUST:
1. Read `docs/session-journal.md`.
2. Look at the top 3 entries.
3. Summarize them for the user in 4-6 lines: what shipped, what's
   pending, recommended next action.
4. **Detect device continuity:**
   - If the last entry's device === current device → say
     "picking up where we left off on this device."
   - If different device → say "last work was on [device], here's
     the state."
5. Then wait for the user's actual instruction.

### `[end]` — user closes the current session
When the user types `[end]`, you MUST:
1. Append a NEW entry to the TOP of the "Entries" section in
   `docs/session-journal.md`. Use the format documented at the top
   of that file exactly.
2. Commit the journal + any pending work with message like:
   `docs: session-journal — [device] session wrap ($DATE)`
3. Push to origin.
4. Confirm: "Session wrapped. Journal updated."

**Device detection:** Ask the user what device you're on if you
can't tell. Valid values: `Mac`, `iPad`, `Web`.

**Format** (see the top of `docs/session-journal.md` for the live
template):
```
## YYYY-MM-DD HH:MM UTC — [Mac | iPad | Web]

**Session summary (2-4 lines):**
Plain English about what we worked on.

**Commits pushed this session:** `abc1234`, `def5678`

**Pending (parked for later by the user):**
- ...

**Open questions (things you weren't sure about):**
- ...

**Recommended next action:**
- ...
```

---

## What is DeNoise OS

A Next.js 16 + Prisma 7 production-management system for film / TV /
commercial projects. Deployed on Vercel, backed by Supabase Postgres.
Current version: **V0.26.3** (see git log for detail).

- **Repo:** `github.com:DeNoiseOS/Building.git` (branch: `main`)
- **Deployed to:** Vercel — auto-deploys on push to `main`
- **Live URL:** `building-iota-ashy.vercel.app`
- **Region:** Vercel `bom1` (Mumbai) — matches Supabase `ap-south-1`

---

## User profile

- **Name:** Fares Alhazmi (فارس الحازمي)
- **Email:** faresomaralhazmi@gmail.com
- **Language mix:** Mixes Arabic + English freely. Sometimes says
  explicitly "قولها بالانقلش" or "اكتبلي بالعربي" — obey per-message.
- **Domain:** Film / video production (agency + production side).
  Building this for real productions.
- **Style:** Direct, pragmatic. Doesn't want lectures. Wants options
  with a clear recommendation, not exhaustive surveys.
- **Testing pattern:** Batches multiple features before testing. Says
  "let's build a few things, I'll test later." Trust that.
- **Feedback pattern:** Blunt when things don't work ("why the error
  back?"), silent when things work. Read the silence as approval.

---

## Git conventions (must-obey)

- **Commit author env vars:**
  ```
  GIT_AUTHOR_NAME="Fares alhazmi"
  GIT_AUTHOR_EMAIL="faresalhazmi@Faress-MacBook-Pro.local"
  GIT_COMMITTER_NAME="Fares alhazmi"
  GIT_COMMITTER_EMAIL="faresalhazmi@Faress-MacBook-Pro.local"
  ```
- Always commit with `-c commit.gpgsign=false`
- Commit messages via heredoc (`<<'EOF'`) — multi-line, explains WHY.
- NEVER destructive git ops (no force push, no reset --hard).
- Push to main auto-deploys → don't push broken code.

---

## Prisma migrations

- Applied LOCALLY via `npx prisma migrate deploy` against Supabase
  DIRECT_URL (port 5432).
- **Vercel does NOT auto-migrate.** If new migration added, apply
  manually to Supabase before pushing code that reads it.
- Migration files live in `prisma/migrations/YYYYMMDDHHMMSS_slug/`.
- `prisma.config.ts` handles URLs. Runtime uses pg driver adapter via
  `lib/prisma.ts` (pooled DATABASE_URL port 6543).

---

## Environment variables

- `DATABASE_URL` — Supabase pooled (port 6543, pgbouncer)
- `DIRECT_URL` — Supabase direct (port 5432, for migrations)
- `AUTH_SECRET` — NextAuth session signing
- `NEXT_PUBLIC_SUPABASE_URL` — for Storage (V0.23+)
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, Storage signed URLs
- `NEXT_PUBLIC_QUICK_LOGIN=1` — testing mode toggle (V0.26+)

---

## Code style rules

- Defensive Prisma access: `(prisma as any).modelName` +
  `typeof m.findMany === "function"` — tolerates stale generated client.
- Read `AGENTS.md` — Next.js 16 has breaking changes vs. your training.
  Consult `node_modules/next/dist/docs/` when uncertain.
- Never write more code than the task requires. No premature abstractions.
- Comments only when the WHY is non-obvious.
- Server-only helpers in `lib/*-server.ts` with `import "server-only"`.
  **Never import prisma into a "use client" component** — breaks build
  with "Cannot resolve dns/fs/net".
- Always run `npx tsc --noEmit` + `npx next build` before commit.

---

## Schema — major models

### Core
- **User** — auth + profile (V0.12: primaryRole, additionalRoles,
  contactPhone, portfolioLinks, etc.)
- **Project** — top-level; `userId` = Owner
- **ProjectMember** — user's role on a project
- **ProjectInvitation** — email + role, awaits accept
- **Department** — first-class, `kind` matches registry
- **DepartmentMember** — user's dept assignment

### Tasks + notifications
- **Task** — with departmentId, assigneeId, approverId
- **Notification, Comment, Announcement, Activity**

### Financial (big surface)
- **DepartmentBudget** — allocated/approved amount
- **BudgetRequest** — deprecated but still queried
- **Custody** — cash advance held by a user
- **CustodyRequest** — member asks for cash (V0.14.1)
- **Purchase** — invoice container (V0.13; V0.22 made it multi-line)
- **PurchaseItem** — line item (V0.22)
- **Equipment** — asset registry (V0.10 base, V0.16 lifecycle, V0.18
  added `quantity` for inventory)
- **EquipmentAssignment** — check-out/in
- **MaintenanceRecord, DamageReport**

### Scenes (V0.17+)
- **Scene** — number, title, location, type, timeOfDay, status,
  attachments JSON, coverImageUrl (V0.19)
- **SceneDepartment** — per-dept workspace on a scene
- **SceneAsset** — Scene ↔ Equipment link with quantityNeeded (V0.18)
- **SceneCast** — Scene ↔ Talent (V0.25)
- **SceneComment** — feedback (V0.24)

### Cast (V0.25)
- **Talent** — name, character, bio, headshot, contact, agent, dayRate
- Business fields (contact/rate/agent) STRIPPED server-side from
  agency responses.

### Production Bible (V0.20)
- **BibleEntry** — polymorphic (departmentId nullable = "Direction"),
  URL or body, pinned. Replaces old Workspace tab.

### File uploads (V0.23)
- **Attachment** — polymorphic (ownerType + ownerId), storagePath in
  Supabase bucket `production-files`
- Direct browser → Supabase upload via signed URLs

### Agency access (V0.24)
- **CreativeApproval** — Director/AD/Producer/EP/Owner REQUEST it,
  agency roles APPROVE/REJECT with reason
- Kinds: script_signoff, treatment, casting, wardrobe, location,
  cut_v1, cut_final, other

---

## Role system

### 4 families
1. **Leadership** — Owner, EP, Producer, Director, ADs, Line Producer,
   Coordinators, PAs
2. **Department Heads** — Production Designer, DP, Sound Mixer,
   Casting Director, Location Manager, Post Supervisor
3. **Department Members** — Prop Master, Set Dresser, 1st AC, 2nd AC,
   Boom Op, Colorist
4. **Agency (Client)** — Creative Director, Copywriter, Brand Manager,
   Account Manager (identical permissions)

### Owner mechanic
`Project.userId` = Owner. Not a role you assign. Only role that can
DELETE the project.

### Resolved head mechanic
Each department has `headRoles[]` priority list. RESOLVED head =
highest-priority present role. If Production Designer is on the
project, THEY are Art head. If not, Art Director. If not, Assistant.
`resolveHeadRoleFromPresent` in `lib/department-registry.ts`.

### Client-role TRIPLE-GATE (V0.24 + V0.24.1)
Agency roles never see financials. Enforced at:
1. **Tab layer** — `CLIENT_TAB_LABELS` set filters tabs to 5 only
2. **Page layer** — `redirectClientOff()` redirects `/budget`,
   `/equipment`, `/tasks`, `/departments`, `/reports`, `/members`
3. **API layer** — `denyClientAPI()` returns 403 for financial routes

### Key permission helpers (lib/permissions.ts)
- `canManageScene` — Owner + EP + Producer + Director + AD + 1st AD
- `canApproveSceneDepartment` — same
- `canEditSceneDepartment` — canManageScene OR dept head
- `canManageCast` — canManageScene OR Casting Director/Manager
- `canViewFinancials` — false for client roles
- `canViewAnalytics` — Owner + EP + Producer + Director
- `canRequestCreativeApproval` — canManageScene
- `canDecideCreativeApproval` — client roles ONLY
- `canEditBibleSection(kind | null)` — dept head or leadership; NULL =
  "Direction & Production" section, leadership only
- `isClientCaller` — memberRole in client-role set
- `isResolvedDepartmentHead`, `getMyDepartmentIds`

### Full role reference
`docs/ProductionOS_Roles_Reference.xlsx` — 5 sheets covering every
role, family, permissions matrix, head resolution priorities.

---

## Tabs (V0.21 — 8 crew tabs, +1 in V0.25)

Crew view (9 total after V0.25 added Cast):
```
Overview · Scenes · Cast · Tasks · Departments · Budget · Resources · Production Bible · Calendar
```

Client view (5 tabs):
```
Overview · Scenes · Cast · Production Bible · Calendar
```

- `Resources` route stays `/equipment` (legacy path)
- `Production Bible` route is `/bible` (renamed from `/workspace`)
- Reports is `/reports`, accessed via Overview header button (admin
  only) + sidebar link
- Announcements/Members/Activity/Analytics tabs REMOVED — folded into
  Overview or Departments header

---

## Key versions shipped

- **V0.11** — EP role, dynamic head resolution, currency system, grouped role picker
- **V0.12** — User profiles, completion banner, dept team page
- **V0.13** — Purchases & Rentals with quantity
- **V0.14.x** — Purchase pending workflow, custody isolation, integrity fixes
- **V0.15** — Analytics/Reports dashboard
- **V0.16** — Asset lifecycle (check-out/in, maintenance, damage)
- **V0.17** — Scene Planning + Department Workflow
- **V0.18** — Scene Assets (Props/Equipment/Talent to scenes)
- **V0.19** — Scene List + Gallery view + cover image + row controls
- **V0.20** — Production Bible (replaces Workspace)
- **V0.21** — Tabs cleanup 12→8 + CSV exports + print stylesheet
- **V0.22** — Multi-line invoices (PurchaseItem back-fill)
- **V0.23** — File uploads via Supabase Storage
- **V0.24** — Agency Access: 4 client roles + Scene comments + CreativeApproval
- **V0.24.1** — Client-role hardening (Members redirect + API gates)
- **V0.25** — Cast/Talent module
- **V0.26** — Quick Login (testing mode)
- **V0.26.1** — Role personas (shared "The [Role]" accounts)
- **V0.26.2** — Full Fledge sandbox project (auto-seeded)
- **V0.26.3** — Sandbox reset (Producer only, confirm dialog)

---

## Testing mode (V0.26 family)

When `NEXT_PUBLIC_QUICK_LOGIN=1`:
- Login page shows role picker cards → click to sign in as "The
  [Role]" persona (shared, email `<role-slug>@personas.local`).
- Members page gets "Add teammate" button → attach role persona
  instantly without invite flow.
- "Full Fledge Production Project" auto-created + all 30+ personas
  auto-attached.
- Producer can RESET the sandbox (wipes content, keeps owner).
- Delete-protected while testing mode on.

Turn OFF by removing `NEXT_PUBLIC_QUICK_LOGIN` env → all quick-login
endpoints return 404; login reverts to email/password only.

---

## Known gaps (V0.27+ candidates)

1. **Scheduling / ShootDay model** — Scenes have status but no date
   assignment. No auto-generated call sheets.
2. **Location entity** — Scene.location is a string. No permits.
3. **Post-production module** — Cuts/versions/VFX/deliverables absent.
4. **Email notifications** — In-app only.
5. **Global search** — Nothing at project level.
6. **Templates** — Every new project starts empty.
7. **Mobile receipt capture** — Would be huge on set.
8. **Vendor management** — Vendor is free text on Purchase.

---

## Recent session

The user was preparing to migrate from Mac Claude Code to iPad Claude
app. They chose to work from iPad via Claude's GitHub integration
(session against `DeNoiseOS/Building` repo). They understand:
- Code syncs via GitHub
- Conversation history does NOT
- They should NEVER run Mac + iPad Claude simultaneously (git conflict)
- Migrations applied via Mac OR Supabase SQL Editor manually

---

## Common pitfalls to avoid

1. **Don't import `prisma` into a "use client" component** — breaks
   build. Split into `lib/{feature}-data.ts` (client-safe) +
   `lib/{feature}-server.ts` (`import "server-only"`).

2. **Don't forget cascade behavior** — deleting a Project cascades to
   basically everything through FK. Sandbox Reset (V0.26.3) explicitly
   avoids deleting the Project row itself.

3. **Don't skip the `?? []` fallback on optional Prisma models**:
   `(prisma as any).newModel?.findMany?.() ?? []`.

4. **Don't commit with wrong author** — always set the env vars above.

5. **Don't push without `tsc --noEmit` + `next build` passing**.

6. **AGENTS.md warns** — Next.js 16 breaking changes vs. training data.

---

## First things to do in a fresh session

If the user's first message is NOT `[start]`, run in this order:

```bash
cat docs/session-journal.md | head -80    # last few sessions
git log --oneline -30
git status
cat AGENTS.md
```

If the user's first message IS `[start]`, follow the Session Journal
Workflow at the top of this brief.

Then respond to the user based on their actual question, not this brief.

---

END OF BRIEF
