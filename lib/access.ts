import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * V0.2 collaboration access layer.
 *
 * In V0.1 a project was visible only to its `userId` (the owner). V0.2 keeps
 * the owner concept but adds ProjectMembers — owner *or* member counts as
 * "having access". This module centralizes that distinction so query call
 * sites stay tiny and the policy lives in one place.
 *
 * - `projectAccessFilter(userId)` — Prisma `where` fragment that matches
 *   projects the user can see (owns or is a member of).
 * - `userHasProjectAccess` / `userIsProjectOwner` — booleans for guard logic.
 * - `getProjectMembership` — full membership snapshot (used by member/role
 *   pickers in the UI).
 *
 * Mutation-side guarding pattern:
 *   - Owner-only mutations (delete project, archive, invite, remove member,
 *     change member role) call `userIsProjectOwner`.
 *   - Member-or-owner mutations (create/edit/delete tasks/notes/references)
 *     call `userHasProjectAccess`.
 */

export function projectAccessFilter(userId: string) {
  return {
    OR: [
      { userId },
      { members: { some: { userId } } },
    ],
  };
}

export async function userHasProjectAccess(
  userId: string,
  projectId: string
): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...projectAccessFilter(userId) },
    select: { id: true },
  });
  return !!project;
}

export async function userIsProjectOwner(
  userId: string,
  projectId: string
): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  return !!project;
}

export interface ProjectMembership {
  isOwner: boolean;
  isMember: boolean;
  /** Role on the project — owner uses Project.role, members use their own. */
  role: string | null;
}

export async function getProjectMembership(
  userId: string,
  projectId: string
): Promise<ProjectMembership> {
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: {
      userId: true,
      role: true,
      members: {
        where: { userId },
        select: { role: true },
      },
    },
  });
  if (!project) return { isOwner: false, isMember: false, role: null };

  const isOwner = project.userId === userId;
  const memberRecord = project.members[0];
  return {
    isOwner,
    isMember: isOwner || !!memberRecord,
    role: isOwner ? project.role : (memberRecord?.role ?? null),
  };
}
