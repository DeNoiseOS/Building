import "server-only";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/roles";
import { projectAccessFilter } from "@/lib/access";

/**
 * V1.0A Department readers.
 *
 * A Department is a first-class entity under a Project. The Workspace tab
 * (presentation-only) keeps reading by section key for backwards compat;
 * everything new — counts, dashboards, listings — goes through these
 * department-scoped helpers.
 */

export interface DepartmentSummary {
  id: string;
  projectId: string;
  key: string;
  name: string;
  kind: string;
  order: number;
  createdAt: string;
  memberCount: number;
  openTaskCount: number;
  noteCount: number;
  referenceCount: number;
}

export interface DepartmentDetail extends DepartmentSummary {
  members: Array<{
    id: string;
    userId: string;
    name: string;
    email: string;
    role: string;
    joinedAt: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    assignee: { id: string; name: string } | null;
  }>;
  notes: Array<{
    id: string;
    title: string;
    section: string;
    updatedAt: string;
  }>;
  references: Array<{
    id: string;
    title: string;
    imageUrl: string | null;
    link: string | null;
    section: string;
    createdAt: string;
  }>;
}

export function defaultDepartmentName(kind: string): string {
  // Department display labels — Art Director's department is "Art
  // Department" rather than the personal title, etc. Fall through to the
  // role label for kinds that don't need rewording.
  switch (kind) {
    case "art_director":
      return "Art Department";
    case "editor":
      return "Editorial";
    case "location_manager":
      return "Locations";
    case "casting_manager":
      return "Casting";
    default:
      return ROLE_LABELS[kind] ?? kind;
  }
}

/**
 * Returns the user's per-project access — needed by API guards that gate
 * on project-level access rather than department membership (V1.0A keeps
 * visibility flat across the project; departments are organizational).
 */
export async function getProjectIfAccessible(
  userId: string,
  projectId: string
) {
  return prisma.project.findFirst({
    where: { id: projectId, ...projectAccessFilter(userId) },
    select: { id: true, userId: true },
  });
}

export async function listDepartmentsForProject(
  userId: string,
  projectId: string
): Promise<DepartmentSummary[] | null> {
  const project = await getProjectIfAccessible(userId, projectId);
  if (!project) return null;

  const departments = await prisma.department.findMany({
    where: { projectId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      _count: {
        select: { members: true, notes: true, references: true },
      },
      tasks: {
        where: { status: { not: "done" } },
        select: { id: true },
      },
    },
  });

  return departments.map((d) => ({
    id: d.id,
    projectId: d.projectId,
    key: d.key,
    name: d.name,
    kind: d.kind,
    order: d.order,
    createdAt: d.createdAt.toISOString(),
    memberCount: d._count.members,
    openTaskCount: d.tasks.length,
    noteCount: d._count.notes,
    referenceCount: d._count.references,
  }));
}

export async function getDepartmentDetail(
  userId: string,
  projectId: string,
  departmentId: string
): Promise<DepartmentDetail | null> {
  const project = await getProjectIfAccessible(userId, projectId);
  if (!project) return null;

  const department = await prisma.department.findFirst({
    where: { id: departmentId, projectId },
    include: {
      members: {
        orderBy: { joinedAt: "asc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      tasks: {
        orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        include: { assignee: { select: { id: true, name: true } } },
        take: 25,
      },
      notes: {
        orderBy: { updatedAt: "desc" },
        take: 10,
      },
      references: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      _count: {
        select: { members: true, notes: true, references: true },
      },
    },
  });
  if (!department) return null;

  const openTaskCount = department.tasks.filter((t) => t.status !== "done")
    .length;

  return {
    id: department.id,
    projectId: department.projectId,
    key: department.key,
    name: department.name,
    kind: department.kind,
    order: department.order,
    createdAt: department.createdAt.toISOString(),
    memberCount: department._count.members,
    openTaskCount,
    noteCount: department._count.notes,
    referenceCount: department._count.references,
    members: department.members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
    tasks: department.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? null,
      assignee: t.assignee,
    })),
    notes: department.notes.map((n) => ({
      id: n.id,
      title: n.title,
      section: n.section,
      updatedAt: n.updatedAt.toISOString(),
    })),
    references: department.references.map((r) => ({
      id: r.id,
      title: r.title,
      imageUrl: r.imageUrl,
      link: r.link,
      section: r.section,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
