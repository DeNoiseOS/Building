import { NextResponse } from "next/server";
import {
  requireUser,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api";
import { userHasProjectAccess } from "@/lib/access";
import { canViewAnalytics } from "@/lib/permissions";
import { getProjectAnalytics } from "@/lib/analytics";

/**
 * V0.15 — GET /api/projects/[id]/analytics
 *
 * Project-wide analytics payload. Gated by canViewAnalytics
 * (Owner / Executive Producer / Producer only). Returns the same
 * payload the dashboard renders so future export endpoints (PDF /
 * Excel / CSV) can reuse it without duplicating the aggregation.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  const allowed = await canViewAnalytics({
    userId: guard.userId,
    projectId: id,
  });
  if (!allowed) {
    return forbidden(
      "Analytics are restricted to project owner, executive producer, and producer."
    );
  }

  try {
    const data = await getProjectAnalytics(id);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[analytics.GET]", err);
    return serverError("Failed to load analytics.");
  }
}
