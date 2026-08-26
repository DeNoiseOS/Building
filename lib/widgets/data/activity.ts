import "server-only";
import { prisma } from "@/lib/prisma";
import type { ActivityConfig } from "@/lib/widgets/schema";
import { dateWindowToRange, resolveProjectIds } from "./common";

export interface ResolvedActivity {
  id: string;
  type: string;
  message: string;
  actorId: string | null;
  actorName: string | null;
  createdAt: Date;
  project: { id: string; name: string };
}

export interface ActivityResult {
  events: ResolvedActivity[];
  totalCount: number;
}

/**
 * V0.28 — Activity resolver.
 */
export async function resolveActivity(
  userId: string,
  config: ActivityConfig,
  limit = 50,
): Promise<ActivityResult> {
  const projectIds = await resolveProjectIds(userId, config.scope);
  if (projectIds.length === 0) return { events: [], totalCount: 0 };

  const where: Record<string, unknown> = {
    projectId: { in: projectIds },
  };

  if (config.types && config.types.length > 0) {
    where.type = { in: config.types };
  }

  const range = dateWindowToRange(config.dateRange);
  if (range && range !== "no_due") {
    where.createdAt = range;
  }

  // actorFilter
  if (config.actorFilter === "mine") {
    where.actorId = userId;
  } else if (typeof config.actorFilter === "object") {
    where.actorId = { in: config.actorFilter.userIds };
  }

  const [events, totalCount] = await Promise.all([
    prisma.activity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        message: true,
        actorId: true,
        actorName: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.activity.count({ where }),
  ]);

  return { events, totalCount };
}
