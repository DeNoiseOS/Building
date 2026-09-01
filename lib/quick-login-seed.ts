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
    4,
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
export async function isProtectedDemoProject(projectId: string): Promise<boolean> {
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

  await prisma.$transaction(async (tx) => {
    // Scoped by scene (cascade covers SceneDepartment/SceneAsset/
    // SceneCast/SceneComment via schema).
    await tx.creativeApproval.deleteMany({ where: { projectId } });
    await tx.sceneComment.deleteMany({ where: { scene: { projectId } } });
    await tx.sceneAsset.deleteMany({ where: { scene: { projectId } } });
    await tx.sceneCast.deleteMany({ where: { scene: { projectId } } });
    await tx.sceneDepartment.deleteMany({ where: { scene: { projectId } } });
    await tx.scene.deleteMany({ where: { projectId } });

    // Cast members.
    await tx.talent.deleteMany({ where: { projectId } });

    // Bible + attachments (they store projectId directly).
    await tx.bibleEntry.deleteMany({ where: { projectId } });
    await tx.attachment.deleteMany({ where: { projectId } });

    // Financials. PurchaseItem cascades from Purchase; Equipment
    // cascades its assignments + damage + maintenance.
    await tx.purchaseItem.deleteMany({ where: { purchase: { projectId } } });
    await tx.purchase.deleteMany({ where: { projectId } });
    await tx.custodyRequest.deleteMany({ where: { projectId } });
    await tx.custody.deleteMany({ where: { projectId } });
    await tx.budgetRequest.deleteMany({ where: { projectId } });
    await tx.departmentBudget.deleteMany({ where: { projectId } });

    // Resources.
    await tx.maintenanceRecord.deleteMany({
      where: { equipment: { projectId } },
    });
    await tx.damageReport.deleteMany({
      where: { equipment: { projectId } },
    });
    await tx.equipmentAssignment.deleteMany({
      where: { equipment: { projectId } },
    });
    await tx.equipment.deleteMany({ where: { projectId } });

    // Departments. Their memberships cascade.
    await tx.departmentMember.deleteMany({
      where: { department: { projectId } },
    });
    await tx.department.deleteMany({ where: { projectId } });

    // Communication.
    await tx.announcement.deleteMany({ where: { projectId } });
    await tx.comment.deleteMany({ where: { projectId } });
    // NOTE: Notification has no projectId column — it's per-user, not
    // per-project. Any notifications this user received about the demo
    // project remain in their inbox with (now) dead deep-links. This
    // was silently broken in the pre-Phase-2 code (`if (t.notification?
    // .deleteMany)` always ran the call, which then failed at the
    // Prisma layer with "Unknown arg `projectId`" and rolled back the
    // whole transaction). Removing the line restores a working reset.
    await tx.activity.deleteMany({ where: { projectId } });

    // Tasks + workspace legacy.
    await tx.task.deleteMany({ where: { projectId } });
    await tx.note.deleteMany({ where: { projectId } });
    await tx.reference.deleteMany({ where: { projectId } });

    // Invitations.
    await tx.projectInvitation.deleteMany({ where: { projectId } });

    // Members — keep the owner only. Every other role re-attaches on
    // their next quick-login sign-in.
    await tx.projectMember.deleteMany({
      where: { projectId, userId: { not: project.userId } },
    });
  });
}
