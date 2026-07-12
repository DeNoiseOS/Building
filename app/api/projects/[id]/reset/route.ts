import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api";
import { userHasProjectAccess } from "@/lib/access";
import {
  isProtectedDemoProject,
  resetDemoProject,
} from "@/lib/quick-login-seed";
import { logActivity } from "@/lib/activity";

/**
 * V0.26.3 — Reset the sandbox project.
 *
 * Gates in order:
 *   1. Testing mode must be on (NEXT_PUBLIC_QUICK_LOGIN=1).
 *   2. Caller must have access to the project.
 *   3. Project must be the Full Fledge sandbox.
 *   4. Caller's role on the project must be "producer".
 *
 * On success everything scoped to the project is wiped; the project
 * row + owner survive. Every other role persona rejoins on their
 * next quick-login sign-in via ensureDemoProject().
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (process.env.NEXT_PUBLIC_QUICK_LOGIN !== "1") {
    return NextResponse.json(
      { error: "Testing mode isn't enabled." },
      { status: 404 }
    );
  }

  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id } = await ctx.params;

  if (!(await userHasProjectAccess(guard.userId, id))) {
    return notFound("Project not found.");
  }

  if (!(await isProtectedDemoProject(id))) {
    return forbidden("Only the sandbox project can be reset.");
  }

  const membership = await prisma.projectMember.findFirst({
    where: { projectId: id, userId: guard.userId },
    select: { role: true },
  });
  if (membership?.role !== "producer") {
    return forbidden("Only the Producer can reset the sandbox.");
  }

  try {
    await resetDemoProject(id);
    // Log after the wipe — otherwise the activity row gets deleted
    // by the same transaction it was written in.
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "project_reset",
      message: `reset the Full Fledge sandbox project.`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[project.reset]", err);
    return serverError(
      err instanceof Error ? err.message : "Failed to reset."
    );
  }
}
