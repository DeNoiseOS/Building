import "server-only";
import { prisma } from "@/lib/prisma";
import { getSectionsForRole, type SectionDef } from "@/lib/sections";
import type { TaskSummary } from "@/lib/server-data";
import { projectAccessFilter } from "@/lib/access";
import {
  taskVisibilityFilter,
  workspaceItemDepartmentFilter,
} from "@/lib/permissions";

export interface NoteSummary {
  id: string;
  projectId: string;
  title: string;
  body: string;
  section: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceSummary {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  link: string | null;
  section: string;
  createdAt: string;
}

export type SectionItems =
  | { type: "notes"; items: NoteSummary[] }
  | { type: "references"; items: ReferenceSummary[] }
  | { type: "tasks"; items: TaskSummary[] };

export interface WorkspaceSection {
  def: SectionDef;
  data: SectionItems;
}

export interface WorkspaceData {
  project: {
    id: string;
    name: string;
    role: string;
    status: string;
  };
  /**
   * V0.3: the caller's role on this project — derived from ProjectMember.role
   * for the authenticated user. This drives workspace composition so a
   * member sees their own department's sections regardless of who owns
   * the project. Owners also resolve through their auto-created membership
   * row.
   */
  memberRole: string;
  sections: WorkspaceSection[];
  /** Sections defined but missing icons / unmapped role yields empty []. */
  hasComposition: boolean;
}

/**
 * Loads everything the Workspace tab needs for a single project in one shot.
 * The composition (which sections to show, in what order) is driven by
 * `lib/sections.ts` — strictly a presentation choice that future versions
 * can replace without touching this reader.
 */
export async function getWorkspaceForProject(
  userId: string,
  projectId: string
): Promise<WorkspaceData | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...projectAccessFilter(userId) },
    select: {
      id: true,
      name: true,
      role: true,
      status: true,
      userId: true,
      members: {
        where: { userId },
        select: { role: true },
      },
    },
  });
  if (!project) return null;

  // V0.3: resolve sections from the caller's ProjectMember role. The owner
  // is auto-membered at project creation so this path covers them too; we
  // still fall back to Project.role defensively if a legacy project has
  // no membership row yet.
  const memberRole =
    project.members[0]?.role ??
    (project.userId === userId ? project.role : project.role);

  const projectInfo = {
    id: project.id,
    name: project.name,
    role: project.role,
    status: project.status,
  };

  const sectionDefs = getSectionsForRole(memberRole);
  if (sectionDefs.length === 0) {
    return {
      project: projectInfo,
      memberRole,
      sections: [],
      hasComposition: false,
    };
  }

  const sectionKeys = sectionDefs.map((s) => s.key);

  // V0.5 — apply workflow-layer visibility on top of the section filter.
  // Producers / directors / owner see everything; everyone else sees only
  // items in departments they belong to (or untagged).
  const ctx = { userId, projectId };
  const [deptItemFilter, taskFilter] = await Promise.all([
    workspaceItemDepartmentFilter(ctx),
    taskVisibilityFilter(ctx),
  ]);

  // Load notes, references, and tasks across the sections in parallel.
  const [notes, references, tasks] = await Promise.all([
    prisma.note.findMany({
      where: {
        projectId: project.id,
        section: { in: sectionKeys },
        ...(deptItemFilter ?? {}),
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.reference.findMany({
      where: {
        projectId: project.id,
        section: { in: sectionKeys },
        ...(deptItemFilter ?? {}),
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({
      where: {
        projectId: project.id,
        section: { in: sectionKeys },
        ...(taskFilter ?? {}),
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        assignee: { select: { id: true, name: true } },
      },
    }),
  ]);

  const notesBySection = groupBy(notes, (n) => n.section);
  const refsBySection = groupBy(references, (r) => r.section);
  const tasksBySection = groupBy(tasks, (t) => t.section ?? "");

  const sections: WorkspaceSection[] = sectionDefs.map((def) => {
    switch (def.type) {
      case "notes":
        return {
          def,
          data: {
            type: "notes",
            items: (notesBySection.get(def.key) ?? []).map((n) => ({
              id: n.id,
              projectId: n.projectId,
              title: n.title,
              body: n.body,
              section: n.section,
              createdAt: n.createdAt.toISOString(),
              updatedAt: n.updatedAt.toISOString(),
            })),
          },
        };
      case "references":
        return {
          def,
          data: {
            type: "references",
            items: (refsBySection.get(def.key) ?? []).map((r) => ({
              id: r.id,
              projectId: r.projectId,
              title: r.title,
              description: r.description,
              imageUrl: r.imageUrl,
              link: r.link,
              section: r.section,
              createdAt: r.createdAt.toISOString(),
            })),
          },
        };
      case "tasks":
        return {
          def,
          data: {
            type: "tasks",
            items: (tasksBySection.get(def.key) ?? []).map((t) => ({
              id: t.id,
              projectId: t.projectId,
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              section: t.section,
              dueDate: t.dueDate?.toISOString() ?? null,
              completedAt: t.completedAt?.toISOString() ?? null,
              createdAt: t.createdAt.toISOString(),
              updatedAt: t.updatedAt.toISOString(),
              assigneeId: t.assigneeId,
              assignee: t.assignee,
              project: {
                id: project.id,
                name: project.name,
                role: project.role,
              },
              // V0.6 — workspace tasks are presentation only; treat all
              // as editable from this surface (server still enforces).
              canEdit: true,
              departmentId: t.departmentId ?? null,
            })),
          },
        };
    }
  });

  return {
    project: projectInfo,
    memberRole,
    sections,
    hasComposition: true,
  };
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}
