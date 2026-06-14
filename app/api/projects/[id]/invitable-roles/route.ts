import { NextResponse } from "next/server";
import { requireUser, notFound, serverError } from "@/lib/api";
import { userHasProjectAccess } from "@/lib/access";
import { invitableRoles } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/invitable-roles
 * Returns the list of roles the calling user is allowed to invite into
 * this project. Empty array = nothing invitable.
 */
export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const hasAccess = await userHasProjectAccess(guard.userId, id);
  if (!hasAccess) return notFound("Project not found.");

  try {
    const roles = await invitableRoles({ userId: guard.userId, projectId: id });
    return NextResponse.json({
      roles: roles.map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r })),
    });
  } catch (err) {
    console.error("[invitable-roles.GET]", err);
    return serverError("Failed to load invitable roles.");
  }
}
