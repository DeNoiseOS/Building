# lib/queries/

Per-domain read helpers for server components. Every reader goes
through `projectAccessFilter(userId)` so members see the same data
as owners.

## Layout

| File           | Reads about                               |
| -------------- | ----------------------------------------- |
| `projects.ts`  | Project list + detail + workspace choices |
| `dashboard.ts` | Home dashboard aggregate                  |
| `tasks.ts`     | Task list + per-row edit authority        |
| `filters.ts`   | URL-driven filter contexts (departments)  |
| `activity.ts`  | Activity feed                             |
| `calendar.ts`  | Calendar events (project + task dates)    |

## History

Phase 4 of the backend cleanup extracted these files out of the
former monolithic `lib/server-data.ts` (804 lines, 14 exports
across 5 domains). A follow-up commit migrated every consumer to
import from `@/lib/queries/*` directly and deleted the shim, so
there is no other path to reach these functions.
