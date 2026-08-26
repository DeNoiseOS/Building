import "server-only";
import { prisma } from "@/lib/prisma";
import { projectAccessFilter } from "@/lib/access";

/**
 * V0.30 — Scheduling / Call Sheets: server-side data helpers.
 *
 * Access is always intersected with `projectAccessFilter(userId)`.
 */

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface MealBreak {
  label: string;
  time: string;
  durationMinutes: number;
}

export interface ShootDaySummary {
  id: string;
  date: Date;
  label: string | null;
  generalCallTime: string | null;
  wrapTime: string | null;
  locationName: string | null;
  productionLogoUrl: string | null;
  clientLogoUrl: string | null;
  sceneCount: number;
  estimatedTotalMinutes: number;
}

// ─────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────

async function assertProjectAccess(userId: string, projectId: string): Promise<void> {
  const access = projectAccessFilter(userId);
  const p = await prisma.project.findFirst({
    where: { AND: [access, { id: projectId }] },
    select: { id: true },
  });
  if (!p) throw new Error("project not accessible");
}

export async function getShootDaysForProject(
  userId: string,
  projectId: string,
): Promise<ShootDaySummary[]> {
  await assertProjectAccess(userId, projectId);
  const rows = await prisma.shootDay.findMany({
    where: { projectId },
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      label: true,
      generalCallTime: true,
      wrapTime: true,
      locationName: true,
      productionLogoUrl: true,
      clientLogoUrl: true,
      scenes: {
        select: { estimatedMinutes: true },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    label: r.label,
    generalCallTime: r.generalCallTime,
    wrapTime: r.wrapTime,
    locationName: r.locationName,
    productionLogoUrl: r.productionLogoUrl,
    clientLogoUrl: r.clientLogoUrl,
    sceneCount: r.scenes.length,
    estimatedTotalMinutes: r.scenes.reduce((s, x) => s + (x.estimatedMinutes ?? 0), 0),
  }));
}

/** Full ShootDay + every item (ordered) + every scene's full call-sheet
 *  data (cast, assets, departments). */
export async function getShootDayFull(userId: string, shootDayId: string) {
  const row = await prisma.shootDay.findUnique({
    where: { id: shootDayId },
    include: {
      project: {
        select: { id: true, name: true, currency: true, userId: true },
      },
      items: {
        orderBy: { order: "asc" },
        include: {
          scene: {
            include: {
              cast: {
                include: {
                  talent: {
                    select: {
                      id: true,
                      name: true,
                      characterName: true,
                      headshotUrl: true,
                    },
                  },
                },
              },
              assets: {
                include: {
                  equipment: {
                    include: {
                      department: {
                        select: { id: true, name: true, kind: true },
                      },
                    },
                  },
                },
              },
              departments: {
                include: {
                  department: {
                    select: { id: true, name: true, kind: true },
                  },
                },
              },
            },
          },
        },
      },
      createdBy: { select: { name: true } },
    },
  });
  if (!row) return null;
  await assertProjectAccess(userId, row.project.id);
  return row;
}

/** Scenes NOT yet on any shoot day. */
export async function getUnscheduledScenes(userId: string, projectId: string) {
  await assertProjectAccess(userId, projectId);
  return prisma.scene.findMany({
    where: { projectId, shootDayId: null },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      title: true,
      location: true,
      type: true,
      timeOfDay: true,
      status: true,
    },
  });
}

/** Departments that own equipment (for the export dialog dept filter). */
export async function getProjectAssetDepartments(
  userId: string,
  projectId: string,
): Promise<{ id: string; name: string; kind: string; count: number }[]> {
  await assertProjectAccess(userId, projectId);
  const rows = await prisma.department.findMany({
    where: { projectId, equipment: { some: {} } },
    select: {
      id: true,
      name: true,
      kind: true,
      _count: { select: { equipment: true } },
    },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    count: r._count.equipment,
  }));
}

/** Full crew list for the call sheet: every project member with role
 *  + phone + department memberships. Grouped client-side by dept. */
export async function getProjectCrewForCallSheet(userId: string, projectId: string) {
  await assertProjectAccess(userId, projectId);
  const rows = await prisma.projectMember.findMany({
    where: { projectId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          primaryRole: true,
          contactPhone: true,
          profileImage: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    name: r.user.name,
    role: r.role,
    phone: r.user.contactPhone,
    profileImage: r.user.profileImage,
  }));
}
