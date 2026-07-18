@AGENTS.md

# Project conventions from the user (Fares)

These are standing directives for every Claude session in this repo,
established by the user, not by any Claude. Honor them.

## Session-journal workflow — `[start]` / `[end]`

The user works across devices (Mac Claude Code + iPad Claude app +
occasionally Web). They maintain a shared journal at
`docs/session-journal.md` to sync context between devices.

Two magic phrases they type in chat:

### `[start]`
When you see this on its own, you MUST:
1. Read `docs/session-journal.md`.
2. Summarize the top 3 entries for the user in 4-6 lines: what
   shipped, what's pending, recommended next action.
3. Detect device continuity — if the last entry's device === your
   current device, say "picking up where we left off on this
   device." Otherwise, say "last work was on [device]."
4. Wait for the user's actual instruction.

### `[end]`
When you see this on its own, you MUST:
1. Append a NEW entry to the TOP of the "Entries" section in
   `docs/session-journal.md`, using the format documented at the
   top of that file.
2. Commit the journal + any pending work with a message like
   `docs: session-journal — [device] session wrap ($DATE)`.
3. Push to origin.
4. Confirm: "Session wrapped. Journal updated."

Device values: `Mac`, `iPad`, `Web`. Ask if unsure.

## Git conventions

Commits use this author (set via env vars before commit):
- `GIT_AUTHOR_NAME="Fares alhazmi"`
- `GIT_AUTHOR_EMAIL="faresalhazmi@Faress-MacBook-Pro.local"`
- `GIT_COMMITTER_NAME="Fares alhazmi"`
- `GIT_COMMITTER_EMAIL="faresalhazmi@Faress-MacBook-Pro.local"`
- Always commit with `-c commit.gpgsign=false`
- Commit messages are multi-line via heredoc, explain WHY not just
  WHAT (see recent commits for the pattern).
- Never destructive git ops (no force push, no reset --hard).

## Context

Full project brief lives at `docs/session-brief.md` — read it if you
need architecture, schema, role system, or version history.
