# lib/queries/

Per-domain read helpers for server components. Extracted from the
former monolithic `lib/server-data.ts` in Phase 4 of the backend
cleanup.

Files here own the DTO shape their consumers see. Every reader
goes through `projectAccessFilter(userId)` so members see the same
data as owners.

## Layout

| File           | Reads about               |
| -------------- | ------------------------- |
| `projects.ts`  | Project list + detail + workspace choices |
| `dashboard.ts` | Home dashboard aggregate                  |
| `tasks.ts`     | Task list + per-row edit authority        |
| `filters.ts`   | URL-driven filter contexts (departments)  |
| `activity.ts`  | Activity feed                             |
| `calendar.ts`  | Calendar events (project + task dates)    |

## Migration status

`lib/server-data.ts` is a thin shim that re-exports everything
here. New consumers should import directly from `@/lib/queries/*`.
Old imports (`@/lib/server-data`) keep working — a follow-up
commit will migrate them.
