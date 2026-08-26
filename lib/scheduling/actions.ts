"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageScene } from "@/lib/permissions";
import { projectAccessFilter } from "@/lib/access";

/**
 * V0.30 — Scheduling: server actions.
 *
 * Every mutation is gated by `canManageScene(userId, projectId)` — same
 * allow-list as scene editing (Director / AD / Producer / EP / Owner).
 */

async function requireCanManageForProject(projectId: string): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthenticated");
  const userId = session.user.id;
  const ok = await canManageScene({ userId, projectId });
  if (!ok) throw new Error("forbidden");
  return userId;
}

async function projectIdOfShootDay(shootDayId: string): Promise<string> {
  const row = await prisma.shootDay.findUnique({
    where: { id: shootDayId },
    select: { projectId: true },
  });
  if (!row) throw new Error("shoot day not found");
  return row.projectId;
}

async function projectIdOfScene(sceneId: string): Promise<string> {
  const row = await prisma.scene.findUnique({
    where: { id: sceneId },
    select: { projectId: true },
  });
  if (!row) throw new Error("scene not found");
  return row.projectId;
}

async function projectIdOfItem(itemId: string): Promise<string> {
  const row = await prisma.shootDayItem.findUnique({
    where: { id: itemId },
    select: { shootDay: { select: { projectId: true } } },
  });
  if (!row) throw new Error("item not found");
  return row.shootDay.projectId;
}

async function nextItemOrder(shootDayId: string): Promise<number> {
  const last = await prisma.shootDayItem.aggregate({
    where: { shootDayId },
    _max: { order: true },
  });
  return (last._max.order ?? -1) + 1;
}

// ─── Shoot day CRUD ─────────────────────────────────────────────────

export async function createShootDayAction(input: {
  projectId: string;
  date: string;
  label?: string;
  generalCallTime?: string;
  locationName?: string;
}): Promise<{ ok: true; id: string }> {
  const userId = await requireCanManageForProject(input.projectId);
  const access = projectAccessFilter(userId);
  const p = await prisma.project.findFirst({
    where: { AND: [access, { id: input.projectId }] },
    select: { id: true },
  });
  if (!p) throw new Error("project not accessible");

  const created = await prisma.shootDay.create({
    data: {
      projectId: input.projectId,
      date: new Date(input.date),
      label: input.label ?? null,
      generalCallTime: input.generalCallTime ?? null,
      locationName: input.locationName ?? null,
      createdByUserId: userId,
    },
    select: { id: true },
  });
  revalidatePath(`/projects/${input.projectId}/scheduling`);
  return { ok: true, id: created.id };
}

export async function updateShootDayAction(input: {
  shootDayId: string;
  patch: {
    date?: string;
    label?: string | null;
    generalCallTime?: string | null;
    wrapTime?: string | null;
    locationName?: string | null;
    locationAddress?: string | null;
    weather?: string | null;
    weatherIcon?: string | null;
    sunrise?: string | null;
    sunset?: string | null;
    hospitalName?: string | null;
    hospitalPhone?: string | null;
    emergencyContact?: string | null;
    mealTimes?: unknown;
    generalNotes?: string | null;
    productionLogoUrl?: string | null;
    clientLogoUrl?: string | null;
  };
}): Promise<void> {
  const projectId = await projectIdOfShootDay(input.shootDayId);
  await requireCanManageForProject(projectId);
  const { date, mealTimes, ...rest } = input.patch;
  await prisma.shootDay.update({
    where: { id: input.shootDayId },
    data: {
      ...rest,
      ...(date ? { date: new Date(date) } : {}),
      ...(mealTimes !== undefined
        ? {
            mealTimes: mealTimes === null ? undefined : (mealTimes as unknown as object),
          }
        : {}),
    },
  });
  revalidatePath(`/projects/${projectId}/scheduling`);
  revalidatePath(`/projects/${projectId}/scheduling/${input.shootDayId}`);
}

export async function deleteShootDayAction(shootDayId: string): Promise<void> {
  const projectId = await projectIdOfShootDay(shootDayId);
  await requireCanManageForProject(projectId);
  // Detach scenes so they show up in the unscheduled list again.
  await prisma.scene.updateMany({
    where: { shootDayId },
    data: { shootDayId: null },
  });
  await prisma.shootDay.delete({ where: { id: shootDayId } });
  revalidatePath(`/projects/${projectId}/scheduling`);
}

// ─── Shoot day items ────────────────────────────────────────────────

export async function addSceneToShootDayAction(input: {
  sceneId: string;
  shootDayId: string;
}): Promise<void> {
  const projectId = await projectIdOfShootDay(input.shootDayId);
  const sceneProject = await projectIdOfScene(input.sceneId);
  if (sceneProject !== projectId) {
    throw new Error("scene and shoot day belong to different projects");
  }
  await requireCanManageForProject(projectId);

  const nextOrder = await nextItemOrder(input.shootDayId);
  await prisma.$transaction([
    prisma.shootDayItem.create({
      data: {
        shootDayId: input.shootDayId,
        order: nextOrder,
        kind: "scene",
        sceneId: input.sceneId,
      },
    }),
    prisma.scene.update({
      where: { id: input.sceneId },
      data: { shootDayId: input.shootDayId, status: "scheduled" },
    }),
  ]);
  revalidatePath(`/projects/${projectId}/scheduling/${input.shootDayId}`);
}

export async function addNonSceneItemAction(input: {
  shootDayId: string;
  kind: "prep" | "break" | "move" | "meal";
  label: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  notes?: string;
}): Promise<{ ok: true; id: string }> {
  const projectId = await projectIdOfShootDay(input.shootDayId);
  await requireCanManageForProject(projectId);
  const nextOrder = await nextItemOrder(input.shootDayId);
  const created = await prisma.shootDayItem.create({
    data: {
      shootDayId: input.shootDayId,
      order: nextOrder,
      kind: input.kind,
      label: input.label,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      durationMinutes: input.durationMinutes ?? null,
      notes: input.notes ?? null,
    },
    select: { id: true },
  });
  revalidatePath(`/projects/${projectId}/scheduling/${input.shootDayId}`);
  return { ok: true, id: created.id };
}

export async function updateShootDayItemAction(input: {
  itemId: string;
  patch: {
    label?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    durationMinutes?: number | null;
    notes?: string | null;
  };
}): Promise<void> {
  const projectId = await projectIdOfItem(input.itemId);
  await requireCanManageForProject(projectId);
  const row = await prisma.shootDayItem.update({
    where: { id: input.itemId },
    data: input.patch,
    select: { shootDayId: true },
  });
  revalidatePath(`/projects/${projectId}/scheduling/${row.shootDayId}`);
}

export async function deleteShootDayItemAction(itemId: string): Promise<void> {
  const projectId = await projectIdOfItem(itemId);
  await requireCanManageForProject(projectId);
  const item = await prisma.shootDayItem.findUnique({
    where: { id: itemId },
    select: { sceneId: true, shootDayId: true },
  });
  if (!item) return;
  await prisma.$transaction(async (tx) => {
    await tx.shootDayItem.delete({ where: { id: itemId } });
    if (item.sceneId) {
      await tx.scene.update({
        where: { id: item.sceneId },
        data: { shootDayId: null },
      });
    }
  });
  revalidatePath(`/projects/${projectId}/scheduling/${item.shootDayId}`);
}

export async function reorderShootDayItemsAction(input: {
  shootDayId: string;
  orderedItemIds: string[];
}): Promise<void> {
  const projectId = await projectIdOfShootDay(input.shootDayId);
  await requireCanManageForProject(projectId);
  const items = await prisma.shootDayItem.findMany({
    where: { id: { in: input.orderedItemIds }, shootDayId: input.shootDayId },
    select: { id: true },
  });
  const validIds = new Set(items.map((i) => i.id));
  const clean = input.orderedItemIds.filter((id) => validIds.has(id));
  await prisma.$transaction(
    clean.map((id, idx) =>
      prisma.shootDayItem.update({
        where: { id },
        data: { order: idx },
      }),
    ),
  );
  revalidatePath(`/projects/${projectId}/scheduling/${input.shootDayId}`);
}

// ─── Scene call-sheet extras ────────────────────────────────────────

export async function updateSceneShootMetaAction(input: {
  sceneId: string;
  estimatedMinutes?: number | null;
  pagesCount?: string | null;
}): Promise<void> {
  const projectId = await projectIdOfScene(input.sceneId);
  await requireCanManageForProject(projectId);
  await prisma.scene.update({
    where: { id: input.sceneId },
    data: {
      ...(input.estimatedMinutes !== undefined
        ? { estimatedMinutes: input.estimatedMinutes }
        : {}),
      ...(input.pagesCount !== undefined ? { pagesCount: input.pagesCount } : {}),
    },
  });
  revalidatePath(`/projects/${projectId}/scheduling`);
}
