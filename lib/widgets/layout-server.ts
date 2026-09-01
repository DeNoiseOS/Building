import "server-only";
import { prisma } from "@/lib/prisma";
import { HomeLayoutSchema, parseHomeLayoutJson, type HomeLayout } from "./schema";
import { defaultHomeLayout } from "./default-layout";

/**
 * V0.28 — Home layout persistence (read + write).
 *
 * getHomeLayoutForUser() ALWAYS returns a valid HomeLayout — falling
 * back to the default when the row is missing or the persisted JSON
 * fails Zod validation (defensive: a corrupt row cannot break the
 * page, and the invalid content is logged).
 *
 * saveHomeLayoutForUser() validates before write and upserts by
 * userId.
 */
export async function getHomeLayoutForUser(userId: string): Promise<HomeLayout> {
  const row = await prisma.homeLayout.findUnique({
    where: { userId },
    select: { widgets: true, version: true },
  });

  if (!row) return defaultHomeLayout();

  // The `widgets` column stores just the array; wrap it back into the
  // full HomeLayout shape before validation.
  const parsed = parseHomeLayoutJson({
    version: row.version,
    widgets: row.widgets,
  });
  if (!parsed) {
    console.warn(
      "[widgets] HomeLayout for user %s failed validation — falling back to default.",
      userId,
    );
    return defaultHomeLayout();
  }
  return parsed;
}

export async function saveHomeLayoutForUser(
  userId: string,
  layout: HomeLayout,
): Promise<void> {
  const validated = HomeLayoutSchema.parse(layout);
  await prisma.homeLayout.upsert({
    where: { userId },
    create: {
      userId,
      widgets: validated.widgets as unknown as object,
      version: validated.version,
    },
    update: {
      widgets: validated.widgets as unknown as object,
      version: validated.version,
    },
  });
}

/** Delete the user's layout row → next read returns the default. */
export async function resetHomeLayoutForUser(userId: string): Promise<void> {
  await prisma.homeLayout.deleteMany({
    where: { userId },
  });
}
