import "server-only";
import { prisma } from "@/lib/prisma";
import { projectAccessFilter } from "@/lib/access";
import type { DateWindow, ProjectScope } from "@/lib/widgets/schema";

/**
 * V0.28 — Shared server helpers for every widget data resolver.
 *
 * SECURITY INVARIANT
 *   Every resolver in `lib/widgets/data/*` MUST route its `where`
 *   clause through `resolveProjectScope()`. This function ALWAYS
 *   intersects the requested scope with `projectAccessFilter(userId)`.
 *   A user cannot configure a widget to reveal projects they don't
 *   otherwise have access to — the access filter is applied last and
 *   is not overridable via widget configuration.
 */

/** Prisma "where" applied against `Project` — the intersection of the
 *  widget's requested scope with the caller's access filter. */
export async function resolveProjectScope(
  userId: string,
  scope: ProjectScope,
): Promise<object> {
  const access = projectAccessFilter(userId);

  switch (scope.kind) {
    case "all":
      return access;

    case "mine":
      // Any project where the user is a member (includes owner).
      return {
        AND: [access, { members: { some: { userId } } }],
      };

    case "assigned":
      // Projects containing a task the user is assigned to.
      return {
        AND: [access, { tasks: { some: { assigneeId: userId } } }],
      };

    case "role": {
      // Projects where the user holds one of the specified roles.
      return {
        AND: [access, { members: { some: { userId, role: { in: scope.roles } } } }],
      };
    }

    case "specific":
      // The caller nominated project IDs — still gated by access.
      return {
        AND: [access, { id: { in: scope.projectIds } }],
      };
  }
}

/**
 * Return the set of project IDs matching the requested scope. Some
 * resolvers need to pre-materialize the ID list (e.g. to filter
 * activities by projectId).
 */
export async function resolveProjectIds(
  userId: string,
  scope: ProjectScope,
): Promise<string[]> {
  const where = await resolveProjectScope(userId, scope);
  const rows = await prisma.project.findMany({
    where,
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * Convert a DateWindow into a Prisma comparator against a Date field
 * (typically Task.dueDate). Returns `null` when the window is "no_due"
 * (which callers should treat as `{ field: null }`).
 */
export function dateWindowToRange(
  window: DateWindow,
  now: Date = new Date(),
): { gte?: Date; lt?: Date } | "no_due" | null {
  if (window === "no_due") return "no_due";

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  if (typeof window === "string") {
    switch (window) {
      case "overdue":
        return { lt: startOfToday };
      case "today":
        return { gte: startOfToday, lt: endOfToday };
      case "tomorrow": {
        const startOfTomorrow = endOfToday;
        const endOfTomorrow = new Date(startOfTomorrow);
        endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
        return { gte: startOfTomorrow, lt: endOfTomorrow };
      }
      case "this_week": {
        const dow = startOfToday.getDay(); // 0 = Sunday
        const end = new Date(startOfToday);
        end.setDate(end.getDate() + (7 - dow));
        return { gte: startOfToday, lt: end };
      }
      case "next_7d": {
        const end = new Date(startOfToday);
        end.setDate(end.getDate() + 7);
        return { gte: startOfToday, lt: end };
      }
      case "next_30d": {
        const end = new Date(startOfToday);
        end.setDate(end.getDate() + 30);
        return { gte: startOfToday, lt: end };
      }
      default:
        return null;
    }
  }

  // Custom {from, to}
  return {
    gte: new Date(window.from),
    lt: new Date(window.to),
  };
}
