import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { projectAccessFilter } from "@/lib/access";
import { decorateProjectsWithStats, computeProjectStats } from "@/lib/project-stats";
import type { ProjectStats } from "@/lib/project-stats";

/**
 * Direct DB readers for the Project domain.
 *
 * V0.2: every read goes through `projectAccessFilter(userId)` so
 * members see the same data as owners.
 */

export async function getProjectsForUser(userId: string, statusFilter?: string) {
  const accessFilter = projectAccessFilter(userId);
  const where = statusFilter
    ? { AND: [accessFilter, { status: statusFilter }] }
    : accessFilter;

  const rows = await prisma.project.findMany({
    where,
    orderBy: [{ status: "asc" }, { endDate: "asc" }],
    include: {
      tasks: { select: { status: true, dueDate: true } },
      // V0.4: pull the caller's ProjectMember row so every project DTO
      // surfaces `memberRole` — the displayed role for the current viewer.
      members: { where: { userId }, select: { role: true } },
    },
  });

  return decorateProjectsWithStats(rows).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    role: p.role,
    memberRole: p.members[0]?.role ?? p.role,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString(),
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    stats: p.stats,
  }));
}

export interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  /** Legacy: the project's headline role (Project.role, owner's original). */
  role: string;
  /** V0.4: the displayed role for the current viewer (ProjectMember.role). */
  memberRole: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  stats: ProjectStats;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    completedAt: string | null;
  }>;
  activities: Array<{
    id: string;
    type: string;
    message: string;
    createdAt: string;
    actorId: string | null;
    actorName: string | null;
  }>;
}

/**
 * Memoized per-request via React's cache() — Phase 3A's project layout and the
 * tab pages both call this within a single render. cache() ensures one DB hit
 * per (userId, projectId) per request.
 */
export const getProjectForUser = cache(_getProjectForUser);

async function _getProjectForUser(
  userId: string,
  projectId: string,
): Promise<ProjectDetail | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...projectAccessFilter(userId) },
    include: {
      tasks: {
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          completedAt: true,
        },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 15,
      },
      members: { where: { userId }, select: { role: true } },
    },
  });

  if (!project) return null;

  const stats = computeProjectStats({
    startDate: project.startDate,
    endDate: project.endDate,
    tasks: project.tasks.map((t) => ({ status: t.status, dueDate: t.dueDate })),
  });

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    role: project.role,
    memberRole: project.members[0]?.role ?? project.role,
    startDate: project.startDate.toISOString(),
    endDate: project.endDate.toISOString(),
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    stats,
    tasks: project.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
    })),
    activities: project.activities.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
      actorId: a.actorId,
      actorName: a.actorName,
    })),
  };
}

/**
 * Distinct projects available as filter options / sidebar workspaces.
 * V0.3: surfaces the caller's ProjectMember role so the sidebar
 * (department highlight) and other shell-level UI render the right
 * workspace for the current user instead of the project's headline role.
 */
export async function getProjectChoicesForUser(
  userId: string,
): Promise<Array<{ id: string; name: string; role: string; memberRole: string }>> {
  const rows = await prisma.project.findMany({
    where: { AND: [projectAccessFilter(userId), { status: "active" }] },
    orderBy: { endDate: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      userId: true,
      members: {
        where: { userId },
        select: { role: true },
      },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    memberRole: p.members[0]?.role ?? p.role,
  }));
}
