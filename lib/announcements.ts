import "server-only";
import { prisma } from "@/lib/prisma";
import { isProjectWideRole } from "@/lib/hierarchy";

/**
 * V0.7 — who can create / edit / delete an Announcement on a project.
 * Owner, Producer, Director.
 */
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
  return isProjectWideRole(mem.role);
}
