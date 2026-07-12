import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ROLES, ROLE_LABELS } from "@/lib/roles";

/**
 * V0.26.2 — Full Fledge sandbox project.
 *
 * A canonical demo project that every role persona is a member of.
 * Signing in as any role gets you into this project with the right
 * perspective.
 *
 * The name is the identifier — user can rename it, but then the
 * delete-protection logic (checked by name in the DELETE handler)
 * stops applying. That is intentional: renaming = "this isn't the
 * demo anymore."
 */

export const DEMO_PROJECT_NAME = "Full Fledge Production Project";

async function ensureRolePersona(role: string): Promise<string> {
  const label = ROLE_LABELS[role] ?? role;
  const email = `${role.replace(/_/g, "-")}@personas.local`;
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) return existing.id;
  const password = await bcrypt.hash(
    Math.random().toString(36) + Date.now().toString(36),
    4
  );
  const created = await prisma.user.create({
    data: {
      name: `The ${label}`,
      email,
      password,
      primaryRole: role,
    },
  });
  return created.id;
}

/**
 * Idempotent. Creates the sandbox project on first call, keeps it in
 * sync on later calls: every role persona is added as a ProjectMember
 * with their role. Owner = "The Director" persona.
 */
export async function ensureDemoProject(): Promise<{
  projectId: string;
  created: boolean;
}> {
  if (process.env.NEXT_PUBLIC_QUICK_LOGIN !== "1") {
    throw new Error("Quick login is not enabled.");
  }

  // Owner is the Director persona.
  const directorId = await ensureRolePersona("director");

  // Get existing demo project (there might be > 1 if renamed then
  // re-created; keep the first).
  const existingProject = await prisma.project.findFirst({
    where: { name: DEMO_PROJECT_NAME },
    select: { id: true },
  });

  let projectId: string;
  let created = false;
  if (existingProject) {
    projectId = existingProject.id;
  } else {
    // Seed dates: a shoot window that starts a week ago and ends in
    // three weeks. Makes the "days remaining" widget look alive.
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    const end = new Date(now);
    end.setDate(end.getDate() + 21);

    const project = await prisma.project.create({
      data: {
        userId: directorId,
        name: DEMO_PROJECT_NAME,
        description:
          "Shared sandbox project. Sign in as any role and you're already a member here — use it to test how roles interact. Deleting this project is disabled while quick-login is on.",
        role: "director",
        startDate: start,
        endDate: end,
        status: "active",
        currency: "SAR",
      },
    });
    projectId = project.id;
    created = true;

    // Owner also needs a ProjectMember row per V0.2 conventions.
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: { projectId, userId: directorId },
      },
      create: { projectId, userId: directorId, role: "director" },
      update: {},
    });
  }

  // Ensure every role persona is a member with the right role.
  for (const r of ROLES) {
    const personaId = await ensureRolePersona(r.value);
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: { projectId, userId: personaId },
      },
      create: { projectId, userId: personaId, role: r.value },
      update: { role: r.value },
    });
  }

  return { projectId, created };
}

/**
 * Called by the project DELETE handler. When quick-login is on AND
 * the target is the demo sandbox, refuses the delete.
 */
export async function isProtectedDemoProject(
  projectId: string
): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_QUICK_LOGIN !== "1") return false;
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  return p?.name === DEMO_PROJECT_NAME;
}

/**
 * V0.26.3 — Wipe the sandbox project back to an empty slate.
 *
 * Deletes every child of the project (scenes, cast, purchases,
 * budget, resources, bible, attachments, custody, tasks, activity,
 * announcements, notifications, invitations) and clears the member
 * list except the owner. Cascades on the FK relations take care of
 * the transitive rows (SceneDepartment/SceneAsset/PurchaseItem/…).
 *
 * The project row itself is preserved (id, name, dates, currency).
 * The next role-persona sign-in re-attaches everyone via
 * ensureDemoProject().
 */
export async function resetDemoProject(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, userId: true, name: true },
  });
  if (!project) throw new Error("Project not found.");
  if (project.name !== DEMO_PROJECT_NAME) {
    throw new Error("Only the sandbox project can be reset.");
  }

  // Optional models (added in later versions) — accessed defensively.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;

  await prisma.$transaction(async (tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = tx as any;

    // Scoped by scene (cascade covers SceneDepartment/SceneAsset/
    // SceneCast/SceneComment via schema).
    if (t.creativeApproval?.deleteMany)
      await t.creativeApproval.deleteMany({ where: { projectId } });
    if (t.sceneComment?.deleteMany)
      await t.sceneComment.deleteMany({ where: { scene: { projectId } } });
    if (t.sceneAsset?.deleteMany)
      await t.sceneAsset.deleteMany({ where: { scene: { projectId } } });
    if (t.sceneCast?.deleteMany)
      await t.sceneCast.deleteMany({ where: { scene: { projectId } } });
    if (t.sceneDepartment?.deleteMany)
      await t.sceneDepartment.deleteMany({ where: { scene: { projectId } } });
    if (t.scene?.deleteMany)
      await t.scene.deleteMany({ where: { projectId } });

    // Cast members.
    if (t.talent?.deleteMany)
      await t.talent.deleteMany({ where: { projectId } });

    // Bible + attachments (they store projectId directly).
    if (t.bibleEntry?.deleteMany)
      await t.bibleEntry.deleteMany({ where: { projectId } });
    if (t.attachment?.deleteMany)
      await t.attachment.deleteMany({ where: { projectId } });

    // Financials. PurchaseItem cascades from Purchase; Equipment
    // cascades its assignments + damage + maintenance.
    if (t.purchaseItem?.deleteMany)
      await t.purchaseItem.deleteMany({ where: { purchase: { projectId } } });
    if (t.purchase?.deleteMany)
      await t.purchase.deleteMany({ where: { projectId } });
    if (t.custodyRequest?.deleteMany)
      await t.custodyRequest.deleteMany({ where: { projectId } });
    if (t.custody?.deleteMany)
      await t.custody.deleteMany({ where: { projectId } });
    if (t.budgetRequest?.deleteMany)
      await t.budgetRequest.deleteMany({ where: { projectId } });
    if (t.departmentBudget?.deleteMany)
      await t.departmentBudget.deleteMany({ where: { projectId } });

    // Resources.
    if (t.maintenanceRecord?.deleteMany)
      await t.maintenanceRecord.deleteMany({
        where: { equipment: { projectId } },
      });
    if (t.damageReport?.deleteMany)
      await t.damageReport.deleteMany({
        where: { equipment: { projectId } },
      });
    if (t.equipmentAssignment?.deleteMany)
      await t.equipmentAssignment.deleteMany({
        where: { equipment: { projectId } },
      });
    if (t.equipment?.deleteMany)
      await t.equipment.deleteMany({ where: { projectId } });

    // Departments. Their memberships cascade.
    if (t.departmentMember?.deleteMany)
      await t.departmentMember.deleteMany({
        where: { department: { projectId } },
      });
    if (t.department?.deleteMany)
      await t.department.deleteMany({ where: { projectId } });

    // Communication.
    if (t.announcement?.deleteMany)
      await t.announcement.deleteMany({ where: { projectId } });
    if (t.comment?.deleteMany)
      await t.comment.deleteMany({ where: { projectId } });
    if (t.notification?.deleteMany)
      await t.notification.deleteMany({ where: { projectId } });
    if (t.activity?.deleteMany)
      await t.activity.deleteMany({ where: { projectId } });

    // Tasks + workspace legacy.
    if (t.task?.deleteMany)
      await t.task.deleteMany({ where: { projectId } });
    if (t.note?.deleteMany)
      await t.note.deleteMany({ where: { projectId } });
    if (t.reference?.deleteMany)
      await t.reference.deleteMany({ where: { projectId } });

    // Invitations.
    if (t.projectInvitation?.deleteMany)
      await t.projectInvitation.deleteMany({ where: { projectId } });

    // Members — keep the owner only. Every other role re-attaches on
    // their next quick-login sign-in.
    if (t.projectMember?.deleteMany)
      await t.projectMember.deleteMany({
        where: { projectId, userId: { not: project.userId } },
      });
  });

  void p; // eslint pacifier — we typed p above for readability.
}
