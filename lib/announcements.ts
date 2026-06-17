import "server-only";
import { prisma } from "@/lib/prisma";
import { isProjectWideRole } from "@/lib/hierarchy";

/**
 * V0.12.3 — Who can create / edit / delete an Announcement.
 *
 *   Owner
 *   Executive Producer
 *   Producer
 *   Director
 *   Assistant Director  (1st AD also qualifies — they own call sheets
 *                        + on-set comms, which is what announcements are)
 *
 * Everyone else is read-only.
 */
const ANNOUNCEMENT_AUTHOR_ROLES = new Set([
  "executive_producer",
  "producer",
  "director",
  "assistant_director",
  "first_assistant_director",
]);

export async function canManageAnnouncement(c: {
  userId: string;
  projectId: string;
}): Promise<boolean> {
  const [owner, mem] = await Promise.all([
    prisma.project.findFirst({
      where: { id: c.projectId, userId: c.userId },
      select: { id: true },
    }),
    prisma.projectMember.findFirst({
      where: { projectId: c.projectId, userId: c.userId },
      select: { role: true },
    }),
  ]);
  if (owner) return true;
  if (!mem) return false;
  return (
    isProjectWideRole(mem.role) || ANNOUNCEMENT_AUTHOR_ROLES.has(mem.role)
  );
}
