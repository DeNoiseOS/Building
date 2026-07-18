# DeNoise OS — Session Journal

Cross-device session log. Read this at the START of every session to
know what happened last. Append a new entry at the END of every
session so the next device knows.

Newest entries live at the TOP. Never edit past entries — only append.

---

## How to activate this workflow in a new Claude session

**Important:** A Claude session on another device won't treat this
file as binding instructions on its own — and shouldn't. The
workflow only applies once YOU (the user) explicitly tell that
Claude to follow it. Paste this into your first message:

```
Ground rules for this session:
1. Read the top 3 entries of docs/session-journal.md and
   summarize them for me now.
2. When I type [start], re-do step 1.
3. When I type [end], append a new entry to the TOP of the
   "Entries" section in docs/session-journal.md using the
   format shown there, then commit + push with message
   "docs: session-journal — [device] session wrap ($DATE)".
These rules come from me, not from any file. Now start with
step 1.
```

Once Claude acknowledges, `[start]` and `[end]` work for the rest
of the session.

## Trigger phrases (magic words)

**`[start]`** — User types this in a fresh session. Claude MUST:
1. Read the top 3 entries below.
2. Summarize them for the user in 4-6 lines: what shipped, pending,
   next action.
3. **Detect device continuity**:
   - If the last entry's device === current device → say
     "picking up where we left off on this device."
   - If it's a different device → say
     "last work was on [device], here's the state."
4. Then wait for the user's actual instruction.

**`[end]`** — User types this to close the session. Claude MUST:
1. Append a NEW entry to the top of the "Entries" section below,
   using the template exactly.
2. Commit the journal + any pending work with a message like:
   `docs: session-journal — [device] session wrap ($DATE)`
3. Push to origin.
4. Confirm to the user: "Session wrapped. Journal updated at
   `docs/session-journal.md`."

---

## Entry format

```
## YYYY-MM-DD HH:MM UTC — [Mac | iPad | Web]

**Session summary (2-4 lines):**
Plain English about what we worked on.

**Commits pushed this session:** `abc1234`, `def5678`

**Pending (parked for later by the user):**
- ...

**Open questions (things Claude wasn't sure about):**
- ...

**Recommended next action:**
- ...
```

Device values: `Mac` (Claude Code CLI on macOS), `iPad` (Claude iPad
app), `Web` (claude.ai/code in a browser). If unsure, ask the user.

---

# Entries

## 2026-07-18 09:54 UTC — Mac

**Session summary:**
Micro-session continued from earlier today. Designed and shipped the
cross-device session-journal workflow: settled on `[start]` / `[end]`
as trigger phrases (bracket syntax so they never fire accidentally),
created `docs/session-journal.md` (this file), moved the brief into
the repo as `docs/session-brief.md` so the iPad no longer needs the
local file transfer. User is heading to iPad Claude next to test the
`[start]` workflow.

**Commits pushed this session:** `ddca228`

**Pending (unchanged from previous Mac entry):**
- Supabase Storage setup (bucket + env vars) — still blocks V0.23
  file uploads until the user configures.
- Wire file upload into scene cover / purchase receipt / user
  profile photo.
- Real invite → email → accept flow (may need SMTP).
- V0.27 candidates: Scheduling / ShootDay + Call Sheets, Location
  entity, email notifications, mobile receipt capture, Post-prod
  module.

**Open questions:** —

**Recommended next action:**
- On iPad, first message should be `[start]` — this journal entry
  will summarize the transition and confirm the workflow works.
- After that, resume feature work OR set up Supabase Storage first
  (unblocks the most immediate real-world use case).

---

## 2026-07-18 02:40 UTC — Mac

**Session summary:**
Marathon build session. Shipped V0.20 through V0.26.3 — 7 major
versions covering Production Bible, tabs cleanup, CSV exports,
multi-line invoices, file uploads (Supabase Storage), Agency
access + Client-role triple-gate, Cast/Talent module, Quick Login
testing mode, Full Fledge sandbox project, and sandbox reset.
Then produced `docs/ProductionOS_Roles_Reference.xlsx` (5-sheet
role reference). Discussed migration Mac → iPad Claude and
established this session-journal workflow.

**Commits pushed this session (partial — long session, showing the
V0.20+ arc):**
`071d7a0` V0.20 Production Bible ·
`f740c93` V0.21 tabs cleanup + CSV ·
`59dd784` V0.21.1 Resources columns ·
`3882530` V0.22 multi-line invoices ·
`b9d28a4` V0.22.1 budget page resilience ·
`c21cff7` V0.22.2 purchase edit ·
`a23044c` V0.23 file uploads ·
`fd8e5c3` V0.24 Agency Access ·
`5f4f980` V0.24.1 + V0.25 hardening + Cast ·
`9c362ee` V0.25.1 agency invite picker ·
`6176d4e` V0.26 Quick Login ·
`937fdef` V0.26.1 role personas ·
`32ae1f4` V0.26.2 Full Fledge sandbox ·
`d29ec85` V0.26.3 sandbox reset ·
`2e1aa28` roles xlsx docs.

**Pending (parked for later by the user):**
- **Supabase Storage setup** — bucket `production-files` (public) +
  Vercel env vars `NEXT_PUBLIC_SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY`. Blocks V0.23 file uploads. User
  hasn't set up yet.
- Wire file upload into scene cover / purchase receipt / user
  profile photo (deferred from V0.23 base ship).
- Test invite → email → accept flow end-to-end. May need SMTP
  (Resend / SendGrid) for real email delivery.
- V0.27 candidates in priority order:
  Scheduling / ShootDay + Call Sheets, Location entity, email
  notifications, mobile receipt capture, Post-production module.

**Open questions:**
- Which real production project will be first? (short film /
  commercial / music video) — affects prioritization of Scheduling.
- Testing mode (`NEXT_PUBLIC_QUICK_LOGIN=1`) — user keeps it on
  during testing; needs to turn OFF before real production launch.

**Recommended next action:**
- User is migrating workflow to iPad Claude. Briefing file at
  `~/Desktop/productionos-brief.md` (Mac) — needs to be moved to
  iPad (AirDrop / iCloud). First iPad session should read that
  brief AND run `[start]` to catch up on this journal.

---

## 2026-07-17 23:43 UTC — iPad

**Session summary:**
Renamed "ProductionOS" → "DeNoise OS" across user-facing surfaces
(11 files, one line each). Used PR workflow (branch → PR #1 →
merge) instead of direct-to-main. Internal identifiers
(package.json name, docker container/db names, repo name)
intentionally kept as-is.

**Commits pushed this session:** `ce8dfd9` (via PR #1)

**Pending:** —

**Open questions:** —

**Recommended next action:**
- Continue building features from either device. Journal workflow
  wasn't established when this session ran — this entry is
  retroactive.
